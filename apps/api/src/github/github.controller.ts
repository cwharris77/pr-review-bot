import type { RawBodyRequest } from '@nestjs/common';
import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { AiService } from '../ai/ai.service';
import { verifyWebhook } from '../utils/webhook';
import { GithubService } from './github.service';

@Controller('webhooks')
export class GithubController {
  constructor(
    private githubService: GithubService,
    private aiService: AiService,
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

    if (action !== 'opened' && action !== 'reopened')
      return { status: 'ignored' };

    const { owner, name: repoName } = repository;
    const installationId = payload.installation.id;

    await this.githubService.authenticate(installationId);
    const files = await this.githubService.getPRFiles(
      owner.login,
      repoName,
      pull_request.number,
    );

    const analysis = await this.aiService.analyzePR(files);

    // Post inline comments on specific lines
    if (analysis.inlineComments && analysis.inlineComments.length > 0) {
      for (const comment of analysis.inlineComments) {
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

    // Post overall summary as a general comment
    await this.githubService.postPRComment(
      owner.login,
      repoName,
      pull_request.number,
      this.aiService.formatAnalysisAsMarkdown(analysis),
    );

    return { status: 'ok' };
  }
}
