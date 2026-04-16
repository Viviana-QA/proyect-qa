import { Module } from '@nestjs/common';
import { TestSuitesController, TestSuitesFlatController } from './test-suites.controller';
import { TestSuitesService } from './test-suites.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [TestSuitesController, TestSuitesFlatController],
  providers: [TestSuitesService],
  exports: [TestSuitesService],
})
export class TestSuitesModule {}
