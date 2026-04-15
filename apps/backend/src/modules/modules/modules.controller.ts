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
import { ModulesService } from './modules.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateModuleDto, UpdateModuleDto } from '../../shared-types';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get('projects/:projectId/modules')
  findByProject(@Param('projectId') projectId: string) {
    return this.modulesService.findByProject(projectId);
  }

  @Post('projects/:projectId/modules')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateModuleDto,
    @CurrentUser('id') _userId: string,
  ) {
    return this.modulesService.create(projectId, dto);
  }

  @Get('modules/:id')
  findOne(@Param('id') id: string) {
    return this.modulesService.findOne(id);
  }

  @Patch('modules/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser('id') _userId: string,
  ) {
    return this.modulesService.update(id, dto);
  }

  @Delete('modules/:id')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') _userId: string,
  ) {
    return this.modulesService.remove(id);
  }
}
