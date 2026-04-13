import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { GeminiProvider } from './providers/gemini.provider';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { TestSuitesModule } from '../test-suites/test-suites.module';
import { TestCasesModule } from '../test-cases/test-cases.module';

@Module({
  imports: [AuthModule, ProjectsModule, TestSuitesModule, TestCasesModule],
  controllers: [AIController],
  providers: [AIService, GeminiProvider],
  exports: [AIService],
})
export class AIModule {}
