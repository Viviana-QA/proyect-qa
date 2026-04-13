import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JiraService } from './jira.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';
import { CreateJiraConfigDto } from '@qa/shared-types';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class JiraController {
  constructor(
    private readonly jiraService: JiraService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get('projects/:projectId/jira-config')
  async getConfig(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.jiraService.getConfig(projectId);
  }

  @Post('projects/:projectId/jira-config')
  async saveConfig(
    @Param('projectId') projectId: string,
    @Body() dto: CreateJiraConfigDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.jiraService.saveConfig(projectId, dto);
  }

  @Post('jira/test-connection')
  async testConnection(
    @Body() body: { jira_base_url: string; jira_email: string; jira_api_token: string },
  ) {
    return this.jiraService.testConnection(
      body.jira_base_url,
      body.jira_email,
      body.jira_api_token,
    );
  }
}
