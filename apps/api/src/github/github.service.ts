import { Injectable } from '@nestjs/common';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import { getPrivateKeyPath } from '../utils/pem';

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
      console.error('Error authenticating with GitHub:', error);
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
    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    });
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
}
