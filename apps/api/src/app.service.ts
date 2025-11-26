import { Injectable } from '@nestjs/common';
import { GithubService } from './github/github.service';

@Injectable()
export class AppService {
  constructor(private readonly githubService: GithubService) {}

  getHello(): string {
    return 'Hello World!';
  }

  getGithubInfo(): string {
    return `Github Service is available: ${!!this.githubService}`;
  }
}
