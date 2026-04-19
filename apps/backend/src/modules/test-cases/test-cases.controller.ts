import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TestCasesService } from './test-cases.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';
import { CreateTestCaseDto, UpdateTestCaseDto } from '../../shared-types';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class TestCasesController {
  constructor(
    private readonly testCasesService: TestCasesService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get('projects/:projectId/test-cases')
  async findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
    @Query('test_type') testType?: string,
    @Query('status') status?: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.testCasesService.findByProject(projectId, {
      test_type: testType,
      status,
    });
  }

  @Get('test-cases/:id')
  async findOne(@Param('id') id: string) {
    return this.testCasesService.findOne(id);
  }

  @Post('projects/:projectId/test-cases')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTestCaseDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.projectsService.findOne(projectId, userId);
    return this.testCasesService.create(projectId, dto);
  }

  @Patch('test-cases/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateTestCaseDto) {
    return this.testCasesService.update(id, dto);
  }

  @Delete('test-cases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.testCasesService.remove(id);
  }
}
