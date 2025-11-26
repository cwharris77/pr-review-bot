import { Injectable } from '@nestjs/common';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';

@Injectable()
export class GithubService {
  private octokit: Octokit;

  async authenticate(installationId: number) {
    try {
      if (!process.env.GITHUB_APP_ID) {
        throw new Error('GITHUB_APP_ID is not defined');
      }
      if (!process.env.GITHUB_PRIVATE_KEY_FILE_PATH) {
        throw new Error('GITHUB_PRIVATE_KEY_FILE_PATH is not defined');
      }

      const privateKey = fs.readFileSync(
        process.env.GITHUB_PRIVATE_KEY_FILE_PATH,
        'utf-8',
      );
      const auth = createAppAuth({
        appId: parseInt(process.env.GITHUB_APP_ID),
        privateKey,
        installationId,
      });
      const installationAuth = await auth({ type: 'installation' });
      this.octokit = new Octokit({ auth: installationAuth.token });
    } catch (error) {
      console.error('Error authenticating with GitHub:', error);
    }
  }

  async getPRFiles(owner: string, repo: string, pull_number: number) {
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
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    });
  }
}
