import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AIService } from './ai.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { AIGenerateRequest, AIRefineRequest } from '../../shared-types';

@Controller('ai')
@UseGuards(SupabaseAuthGuard)
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('generate-tests')
  async generateTests(@Body() request: AIGenerateRequest) {
    return this.aiService.generateTests(request);
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
}
