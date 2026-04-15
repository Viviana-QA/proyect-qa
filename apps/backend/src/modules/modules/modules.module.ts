import { Module } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
