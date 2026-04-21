import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AIService } from './ai.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AIRefineRequest,
  AICompleteTestRequest,
  CreateGenerationJobDto,
} from '../../shared-types';

@Controller('ai')
@UseGuards(SupabaseAuthGuard)
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('generate-tests')
  async generateTests(
    @Body() body: CreateGenerationJobDto & { project_id: string },
    @CurrentUser('id') userId: string,
  ) {
    // Create a job record with status='pending' and return immediately.
    // The actual AI generation is handled by the agent, not this endpoint.
    const job = await this.aiService.createGenerationJob(
      body.project_id,
      userId,
      body.test_types,
    );
    return job;
  }

  @Post('complete-test-case')
  async completeTestCase(@Body() request: AICompleteTestRequest) {
    return this.aiService.completeSingleTest(request);
  }

  @Post('refine-test')
  async refineTest(@Body() request: AIRefineRequest) {
    return this.aiService.refineTest(request);
  }

  @Post('analyze-url')
  async analyzeUrl(
    @Body() body: { url: string; page_data: string },
  ) {
    return this.aiService.analyzeUrl(body.url, body.page_data);
  }

  @Get('generation-jobs/project/:projectId')
  async getJobsByProject(@Param('projectId') projectId: string) {
    return this.aiService.getJobsByProject(projectId);
  }

  @Get('generation-jobs/:id')
  async getJob(@Param('id') id: string) {
    return this.aiService.getJob(id);
  }

  @Patch('generation-jobs/:id/cancel')
  async cancelJob(@Param('id') id: string) {
    return this.aiService.cancelJob(id);
  }
}
