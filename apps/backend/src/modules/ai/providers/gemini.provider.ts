import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './ai-provider.interface';
import {
  AIGenerateRequest,
  AIGeneratedTestCase,
} from '../../../shared-types';
import {
  buildTestGenerationPrompt,
  buildRefinePrompt,
  buildAnalyzePrompt,
} from '../prompts/test-generation.prompt';

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly model;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  }

  async generateTestCases(
    request: AIGenerateRequest,
  ): Promise<AIGeneratedTestCase[]> {
    const prompt = buildTestGenerationPrompt(request);

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.response.text();

    try {
      const parsed = JSON.parse(responseText);
      const testCases: AIGeneratedTestCase[] = Array.isArray(parsed)
        ? parsed
        : parsed.test_cases || [];
      return testCases;
    } catch {
      throw new Error(
        `Failed to parse AI response as JSON: ${responseText.substring(0, 200)}`,
      );
    }
  }

  async refineTestCase(
    currentCode: string,
    feedback: string,
  ): Promise<string> {
    const prompt = buildRefinePrompt(currentCode, feedback);

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    });

    return result.response.text();
  }

  async analyzeUrl(url: string, pageData: string): Promise<string> {
    const prompt = buildAnalyzePrompt(url, pageData);

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    });

    return result.response.text();
  }
}
