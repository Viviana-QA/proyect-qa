import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TestSuitesService } from './test-suites.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';
import { CreateTestSuiteDto } from '../../shared-types';

@Controller('projects/:projectId/test-suites')
@UseGuards(SupabaseAuthGuard)
export class TestSuitesController {
  constructor(
    private readonly testSuitesService: TestSuitesService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.testSuitesService.findByProject(projectId);
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestSuiteDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.testSuitesService.create(projectId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Body() dto: Partial<CreateTestSuiteDto>,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.testSuitesService.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.testSuitesService.remove(id);
  }
}
