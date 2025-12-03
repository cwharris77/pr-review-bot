import { Injectable, Logger } from '@nestjs/common';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import { getPrivateKeyPath } from '../utils/pem';

@Injectable()
export class GithubService {
  private octokit: Octokit;
  private readonly logger = new Logger(GithubService.name);

  async authenticate(installationId: number) {
    try {
      if (!process.env.GITHUB_APP_ID) {
        throw new Error('GITHUB_APP_ID is not defined');
      }
      if (!process.env.GITHUB_PRIVATE_KEY_FILE_PATH) {
        throw new Error('GITHUB_PRIVATE_KEY_FILE_PATH is not defined');
      }

      const privateKeyPath = getPrivateKeyPath();
      const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');

      const auth = createAppAuth({
        appId: parseInt(process.env.GITHUB_APP_ID),
        privateKey,
        installationId,
      });
      const installationAuth = await auth({ type: 'installation' });
      this.octokit = new Octokit({ auth: installationAuth.token });
    } catch (error) {
      this.logger.error('Error authenticating with GitHub:', error);
      throw error;
    }
  }

  async getPRFiles(owner: string, repo: string, pull_number: number) {
    if (!this.octokit) {
      throw new Error('Octokit not initialized. Call authenticate() first.');
    }
    const { data } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    return data;
  }

  async postPRComment(
    owner: string,
    repo: string,
    issue_number: number,
    body: string,
  ) {
    if (!this.octokit) {
      throw new Error('Octokit not initialized. Call authenticate() first.');
    }
    const { data } = await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    });
    return data;
  }

  async updateComment(
    owner: string,
    repo: string,
    comment_id: number,
    body: string,
  ) {
    if (!this.octokit) {
      throw new Error('Octokit not initialized. Call authenticate() first.');
    }
    await this.octokit.issues.updateComment({
      owner,
      repo,
      comment_id,
      body,
    });
  }

  async createCheckRun(
    owner: string,
    repo: string,
    head_sha: string,
    name: string = 'AI Code Review',
  ) {
    if (!this.octokit) {
      throw new Error('Octokit not initialized. Call authenticate() first.');
    }

    try {
      this.logger.log(`Creating check run for ${owner}/${repo} @ ${head_sha}`);
      const { data } = await this.octokit.checks.create({
        owner,
        repo,
        name,
        head_sha,
        status: 'in_progress',
        output: {
          title: 'Analyzing your code...',
          summary:
            '🔍 Our AI is reviewing your changes. This may take a moment...',
        },
      });
      this.logger.log(`Check run created successfully: ${data.id}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create check run:', error);
      // Log the specific error message
      if (error.status) {
        this.logger.error(`GitHub API error status: ${error.status}`);
        if (error.status === 403) {
          this.logger.error(
            'Check permissions: Ensure the GitHub App has "checks: write" permission.',
          );
        }
      }
      return undefined;
    }
  }

  async updateCheckRun(
    owner: string,
    repo: string,
    check_run_id: number,
    status: 'completed',
    conclusion:
      | 'success'
      | 'failure'
      | 'neutral'
      | 'cancelled'
      | 'skipped'
      | 'timed_out'
      | 'action_required',
    title: string,
    summary: string,
    text?: string,
    annotations?: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: 'notice' | 'warning' | 'failure';
      message: string;
    }>,
  ) {
    if (!this.octokit) {
      throw new Error('Octokit not initialized. Call authenticate() first.');
    }

    try {
      await this.octokit.checks.update({
        owner,
        repo,
        check_run_id,
        status,
        conclusion,
        output: {
          title,
          summary,
          text,
          annotations: annotations?.slice(0, 50), // GitHub limits to 50 annotations per request
        },
      });
    } catch (error) {
      this.logger.warn('Failed to update check run:', error);
    }
  }

  async postLoadingComment(owner: string, repo: string, pull_number: number) {
    const body = `## 🔍 AI Review In Progress

⏳ Analyzing your changes... This may take a moment.

**Status:**
- ⏳ Fetching and analyzing code changes
- ⏳ Generating review comments
- ⏳ Creating test recommendations

Please wait...`;

    return this.postPRComment(owner, repo, pull_number, body);
  }

  async updateCommentWithProgress(
    owner: string,
    repo: string,
    comment_id: number,
    step: 'analyzing' | 'reviewing' | 'testing',
  ) {
    const steps = {
      analyzing: {
        status: '✅ Code changes analyzed',
        next: '⏳ Generating review comments\n- ⏳ Creating test recommendations',
      },
      reviewing: {
        status: '✅ Code changes analyzed\n- ✅ Review comments generated',
        next: '⏳ Creating test recommendations',
      },
      testing: {
        status:
          '✅ Code changes analyzed\n- ✅ Review comments generated\n- ⏳ Creating test recommendations',
        next: '',
      },
    };

    const body = `## 🔍 AI Review In Progress

**Status:**
- ${steps[step].status}${steps[step].next ? `\n- ${steps[step].next}` : ''}

Please wait...`;

    await this.updateComment(owner, repo, comment_id, body);
  }

  async updateCommentWithResults(
    owner: string,
    repo: string,
    comment_id: number,
    markdown: string,
  ) {
    const body = `## ✅ AI Review Complete

${markdown}

---
*Powered by AI Code Review Bot*`;

    await this.updateComment(owner, repo, comment_id, body);
  }

  async updateCommentWithError(
    owner: string,
    repo: string,
    comment_id: number,
    error?: string,
  ) {
    const body = `## ❌ Review Failed

Sorry, we encountered an error while analyzing your PR.

${error ? `**Error details:** ${error}` : ''}

Please try again or contact support if the issue persists.`;

    await this.updateComment(owner, repo, comment_id, body);
  }

  async postReviewComment(
    owner: string,
    repo: string,
    pull_number: number,
    commit_id: string,
    path: string,
    line: number,
    body: string,
  ) {
    if (!this.octokit) {
      throw new Error('Octokit not initialized. Call authenticate() first.');
    }
    await this.octokit.pulls.createReviewComment({
      owner,
      repo,
      pull_number,
      commit_id,
      path,
      line,
      body,
    });
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
  ): Promise<string | undefined> {
    if (!this.octokit) {
      throw new Error('Octokit not initialized. Call authenticate() first.');
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      // Check if it's a file (not a directory)
      if ('content' in data && data.type === 'file') {
        // Content is base64 encoded
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return undefined;
    } catch (error: any) {
      // File not found is expected when config doesn't exist
      if (error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  convertInlineCommentsToAnnotations(inlineComments: any[]) {
    return inlineComments.map((comment) => ({
      path: comment.path,
      start_line: comment.line,
      end_line: comment.line,
      annotation_level: 'warning' as const,
      message: comment.body,
    }));
  }
}
