import type { RawBodyRequest } from '@nestjs/common';
import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { AiService } from '../ai/ai.service';
import { ConfigService } from '../config/config.service';
import { verifyWebhook } from '../utils/webhook';
import { GithubService } from './github.service';

@Controller('webhooks')
export class GithubController {
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
    if (
      !verifyWebhook(
        (req.rawBody as Buffer).toString(),
        signature,
        process.env.GITHUB_WEBHOOK_SECRET || '',
      )
    ) {
      return { status: 'invalid signature' };
    }

    const { action, pull_request, repository } = payload;
    const { owner, name: repoName } = repository;
    const installationId = payload.installation.id;

    // Authenticate with GitHub
    await this.githubService.authenticate(installationId);

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
        console.log(`Loaded config from ${configPath}`);
        break;
      }
    }

    // Check if we should review based on config
    if (!this.configService.shouldReview(config, action)) {
      return { status: 'ignored - disabled or action not in reviewOn list' };
    }

    // Get PR files
    const files = await this.githubService.getPRFiles(
      owner.login,
      repoName,
      pull_request.number,
    );

    // Filter files based on include/exclude patterns
    const filesToReview = files.filter((file) =>
      this.configService.shouldReviewFile(config, file.filename),
    );

    if (filesToReview.length === 0) {
      return { status: 'no files to review after filtering' };
    }

    // Analyze the PR
    const analysis = await this.aiService.analyzePR(filesToReview);

    // Post inline comments if enabled and present
    if (
      config.comments?.inline &&
      analysis.inlineComments &&
      analysis.inlineComments.length > 0
    ) {
      const maxComments = config.comments.maxInlineComments || 10;
      const commentsToPost = analysis.inlineComments.slice(0, maxComments);

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
          console.error('Error posting inline comment:', error);
        }
      }
    }

    // Post overall summary if enabled
    if (config.comments?.summary) {
      await this.githubService.postPRComment(
        owner.login,
        repoName,
        pull_request.number,
        this.aiService.formatAnalysisAsMarkdown(analysis),
      );
    }

    return { status: 'ok' };
  }
}
