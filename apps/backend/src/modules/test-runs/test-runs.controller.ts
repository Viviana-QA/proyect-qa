import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TestRunsService } from './test-runs.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';
import { CreateTestRunDto, SubmitTestResultDto } from '../../shared-types';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class TestRunsController {
  constructor(
    private readonly testRunsService: TestRunsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get('projects/:projectId/test-runs')
  async findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.testRunsService.findByProject(projectId);
  }

  @Post('projects/:projectId/test-runs')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestRunDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.testRunsService.create(projectId, dto, userId);
  }

  @Get('test-runs/pending')
  async findPending(@Query('agent_id') agentId: string) {
    return this.testRunsService.findPending();
  }

  @Get('test-runs/:id')
  async findOne(@Param('id') id: string) {
    const run = await this.testRunsService.findOne(id);
    const results = await this.testRunsService.getResults(id);
    return { ...run, results };
  }

  @Get('test-runs/:id/test-cases')
  async getTestCases(@Param('id') id: string) {
    return this.testRunsService.getRunTestCases(id);
  }

  @Post('test-runs/:id/claim')
  async claimRun(
    @Param('id') id: string,
    @Body('agent_id') agentId: string,
  ) {
    return this.testRunsService.claimRun(id, agentId);
  }

  @Post('test-runs/:id/results')
  async submitResult(
    @Param('id') id: string,
    @Body() dto: SubmitTestResultDto,
  ) {
    return this.testRunsService.submitResult(id, dto);
  }

  @Post('test-runs/:id/complete')
  async completeRun(
    @Param('id') id: string,
    @Body('duration_ms') durationMs: number,
  ) {
    return this.testRunsService.completeRun(id, durationMs);
  }
}
