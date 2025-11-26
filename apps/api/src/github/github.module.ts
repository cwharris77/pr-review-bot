import { Module } from '@nestjs/common';
import { AiModule } from 'src/ai/ai.module';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

@Module({
  imports: [AiModule],
  providers: [GithubService],
  controllers: [GithubController],
})
export class GithubModule {}
