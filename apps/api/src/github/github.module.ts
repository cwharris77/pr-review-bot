import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '../config/config.module';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

@Module({
  imports: [AiModule, ConfigModule],
  providers: [GithubService],
  controllers: [GithubController],
  exports: [GithubService],
})
export class GithubModule {}
