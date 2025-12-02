import type { RawBodyRequest } from '@nestjs/common';
import { Body, Controller, Headers, Logger, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { AiService } from '../ai/ai.service';
import { ConfigService } from '../config/config.service';
import { verifyWebhook } from '../utils/webhook';
import { GithubService } from './github.service';

@Controller('webhooks')
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(
    private githubService: GithubService,
    private aiService: AiService,
    private configService: ConfigService,
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

    // Try to load configuration from .github/diff-dragon.yaml or .github/diff-dragon.yml
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

    // Analyze the PR
    this.logger.log('Starting AI analysis...');
    const analysis = await this.aiService.analyzePR(filesToReview, config);
    this.logger.log('AI analysis completed');

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

    // Post overall summary if enabled
    if (config.comments?.summary) {
      this.logger.log('Posting summary comment...');
      await this.githubService.postPRComment(
        owner.login,
        repoName,
        pull_request.number,
        this.aiService.formatAnalysisAsMarkdown(analysis),
      );
    }

    this.logger.log('PR review completed successfully');
    return { status: 'ok' };
  }
}
