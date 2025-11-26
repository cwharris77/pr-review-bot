import { Body, Controller, Headers, Post } from '@nestjs/common';

import { AiService } from 'src/ai/ai.service';
import { verifyWebhook } from 'src/utils/webhook';
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
  ) {
    if (
      !verifyWebhook(
        JSON.stringify(payload),
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
    await this.githubService.postPRComment(
      owner.login,
      repoName,
      pull_request.number,
      this.aiService.formatAnalysisAsMarkdown(analysis),
    );

    return { status: 'ok' };
  }
}
