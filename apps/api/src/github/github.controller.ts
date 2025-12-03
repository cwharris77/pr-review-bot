import type { RawBodyRequest } from '@nestjs/common';
import { Body, Controller, Headers, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { RestEndpointMethodTypes } from '@octokit/rest';
import { AiService } from '../ai/ai.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { verifyWebhook } from '../utils/webhook';
import { GithubService } from './github.service';

type Comment =
  RestEndpointMethodTypes['issues']['createComment']['response']['data'];
type CheckRun = RestEndpointMethodTypes['checks']['create']['response']['data'];

@Controller('webhooks')
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(
    private githubService: GithubService,
    private aiService: AiService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  @Post('pr-created')
  async handlePR(
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log('Received webhook event');

    if (
      !verifyWebhook(
        (req.rawBody as Buffer).toString(),
        signature,
        process.env.GITHUB_WEBHOOK_SECRET || '',
      )
    ) {
      this.logger.error('Invalid webhook signature');
      return { status: 'invalid signature' };
    }

    const { action, pull_request, repository } = payload;
    this.logger.log(
      `Processing action: ${action} for PR #${pull_request?.number}`,
    );

    if (!pull_request) {
      this.logger.warn('No pull_request object in payload');
      return { status: 'ignored - not a PR event' };
    }

    const { owner, name: repoName } = repository;
    const installationId = payload.installation?.id;

    if (!installationId) {
      this.logger.error('No installation ID found in payload');
      return { status: 'error - no installation id' };
    }

    // Authenticate with GitHub
    await this.githubService.authenticate(installationId);
    this.logger.log('Authenticated with GitHub');

    // Check if we've already reviewed this commit
    const existingReview = await this.prisma.review.findUnique({
      where: {
        repoOwner_repoName_prNumber_commitSha: {
          repoOwner: owner.login,
          repoName,
          prNumber: pull_request.number,
          commitSha: pull_request.head.sha,
        },
      },
    });

    if (existingReview) {
      this.logger.log(
        `Already reviewed commit ${pull_request.head.sha} for PR #${pull_request.number}`,
      );
      return { status: 'already reviewed' };
    }

    // Try to load configuration
    let config = this.configService.getDefaultConfig();
    const configPaths = ['.github/diff-dragon.yaml', '.github/diff-dragon.yml'];

    for (const configPath of configPaths) {
      const configContent = await this.githubService.getFileContent(
        owner.login,
        repoName,
        configPath,
      );

      if (configContent) {
        config = this.configService.parseConfig(configContent);
        this.logger.log(`Loaded config from ${configPath}`);
        break;
      }
    }

    // Check if we should review based on config
    if (!this.configService.shouldReview(config, action)) {
      this.logger.log(
        `Skipping review: action '${action}' not in reviewOn list or bot disabled`,
      );
      return { status: 'ignored - disabled or action not in reviewOn list' };
    }

    // Get PR files
    this.logger.log('Fetching PR files...');
    const files = await this.githubService.getPRFiles(
      owner.login,
      repoName,
      pull_request.number,
    );
    this.logger.log(`Fetched ${files.length} files`);

    // Filter files based on include/exclude patterns
    const filesToReview = files.filter((file) =>
      this.configService.shouldReviewFile(config, file.filename),
    );
    this.logger.log(`Files to review after filtering: ${filesToReview.length}`);

    if (filesToReview.length === 0) {
      return { status: 'no files to review after filtering' };
    }

    // ===== NEW: Post loading state =====
    let loadingComment: Comment | undefined;
    let checkRun: CheckRun | undefined;

    if (config.comments?.summary) {
      loadingComment = await this.githubService.postLoadingComment(
        owner.login,
        repoName,
        pull_request.number,
      );
      this.logger.log('Posted loading comment');
    }

    // Create check run (will gracefully fail if permissions aren't set)
    checkRun = await this.githubService.createCheckRun(
      owner.login,
      repoName,
      pull_request.head.sha,
    );
    if (checkRun) {
      this.logger.log('Created check run');
    } else {
      this.logger.warn('Failed to create check run - check permissions');
    }

    try {
      // Analyze the PR
      this.logger.log('Starting AI analysis...');

      // Optional: Update progress
      if (loadingComment) {
        await this.githubService.updateCommentWithProgress(
          owner.login,
          repoName,
          loadingComment.id,
          'analyzing',
        );
      }

      const analysis = await this.aiService.analyzePR(filesToReview, config);
      this.logger.log('AI analysis completed');

      // Optional: Update progress again
      if (loadingComment) {
        await this.githubService.updateCommentWithProgress(
          owner.login,
          repoName,
          loadingComment.id,
          'reviewing',
        );
      }

      // Post inline comments if enabled and present
      if (
        config.comments?.inline &&
        analysis.inlineComments &&
        analysis.inlineComments.length > 0
      ) {
        const maxComments = config.comments.maxInlineComments || 10;
        const commentsToPost = analysis.inlineComments.slice(0, maxComments);
        this.logger.log(`Posting ${commentsToPost.length} inline comments...`);

        for (const comment of commentsToPost) {
          try {
            await this.githubService.postReviewComment(
              owner.login,
              repoName,
              pull_request.number,
              pull_request.head.sha,
              comment.path,
              comment.line,
              comment.body,
            );
          } catch (error) {
            this.logger.error(
              `Error posting inline comment on ${comment.path}:${comment.line}`,
              error,
            );
          }
        }
      }

      // Format the analysis
      const markdown = this.aiService.formatAnalysisAsMarkdown(analysis);

      // ===== NEW: Update with results =====
      const updatePromises: Promise<Comment | void>[] = [];

      // Update comment with results
      if (loadingComment) {
        updatePromises.push(
          this.githubService.updateCommentWithResults(
            owner.login,
            repoName,
            loadingComment.id,
            markdown,
          ),
        );
      } else if (config.comments?.summary) {
        // If no loading comment was created, post summary now
        updatePromises.push(
          this.githubService.postPRComment(
            owner.login,
            repoName,
            pull_request.number,
            markdown,
          ),
        );
      }

      // Update check run with results
      if (checkRun) {
        updatePromises.push(
          this.githubService.updateCheckRun(
            owner.login,
            repoName,
            checkRun.id,
            'completed',
            'success',
            '✅ AI Review Complete',
            analysis.summary,
            markdown,
            this.githubService.convertInlineCommentsToAnnotations(
              analysis.inlineComments || [],
            ),
          ),
        );
      }

      await Promise.all(updatePromises);

      // Record this review in the database
      await this.prisma.review.create({
        data: {
          installationId,
          repoOwner: owner.login,
          repoName,
          prNumber: pull_request.number,
          commitSha: pull_request.head.sha,
        },
      });

      this.logger.log('PR review completed successfully');
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Error during PR review:', error);

      // ===== NEW: Update with error state =====
      const errorPromises: Promise<Comment | void>[] = [];

      if (loadingComment) {
        errorPromises.push(
          this.githubService.updateCommentWithError(
            owner.login,
            repoName,
            loadingComment.id,
            error.message,
          ),
        );
      }

      if (checkRun) {
        errorPromises.push(
          this.githubService.updateCheckRun(
            owner.login,
            repoName,
            checkRun.id,
            'completed',
            'failure',
            '❌ Review Failed',
            'An error occurred during the AI review.',
          ),
        );
      }

      await Promise.allSettled(errorPromises);

      throw error;
    }
  }
}
