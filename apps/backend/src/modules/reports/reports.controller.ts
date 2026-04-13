import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get('projects/:projectId/reports')
  async findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.reportsService.findByProject(projectId);
  }

  @Get('reports/:id')
  async findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Post('test-runs/:runId/report')
  async generate(@Param('runId') runId: string) {
    return this.reportsService.generateFromRun(runId);
  }
}
