import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

@Module({
  imports: [AiModule],
  providers: [GithubService],
  controllers: [GithubController],
  exports: [GithubService],
})
export class GithubModule {}
