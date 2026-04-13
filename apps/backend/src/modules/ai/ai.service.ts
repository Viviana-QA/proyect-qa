import { Injectable } from '@nestjs/common';
import { GeminiProvider } from './providers/gemini.provider';
import { TestSuitesService } from '../test-suites/test-suites.service';
import { TestCasesService } from '../test-cases/test-cases.service';
import {
  AIGenerateRequest,
  AIGenerateResponse,
  AIRefineRequest,
  AIRefineResponse,
  TestType,
} from '../../shared-types';

@Injectable()
export class AIService {
  constructor(
    private readonly gemini: GeminiProvider,
    private readonly testSuitesService: TestSuitesService,
    private readonly testCasesService: TestCasesService,
  ) {}

  async generateTests(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const generatedCases = await this.gemini.generateTestCases(request);

    // Group by test type and create suites + test cases
    const byType = new Map<TestType, typeof generatedCases>();
    for (const tc of generatedCases) {
      const list = byType.get(tc.test_type) || [];
      list.push(tc);
      byType.set(tc.test_type, list);
    }

    const savedCases = [];

    for (const [testType, cases] of byType) {
      // Create or find a suite for this type
      const suite = await this.testSuitesService.create(
        request.project_id,
        {
          name: `AI Generated - ${testType.toUpperCase()} - ${new Date().toISOString().split('T')[0]}`,
          description: `Auto-generated ${testType} tests for ${request.base_url}`,
          test_type: testType,
        },
        true,
      );

      const dtos = cases.map((c) => ({
        suite_id: suite.id,
        title: c.title,
        description: c.description,
        test_type: c.test_type,
        playwright_code: c.playwright_code,
        tags: c.tags,
        priority: c.priority,
        browser_targets: c.browser_targets || ['chromium'],
        viewport_config: c.viewport_config,
      }));

      const created = await this.testCasesService.createMany(
        request.project_id,
        dtos,
      );
      savedCases.push(...created);
    }

    return {
      test_cases: generatedCases,
      analysis_summary: `Generated ${generatedCases.length} test cases across ${byType.size} test types`,
      suggestions: [
        'Review generated tests before running',
        'Customize selectors if the AI used generic ones',
        'Add authentication steps if the app requires login',
      ],
    };
  }

  async refineTest(request: AIRefineRequest): Promise<AIRefineResponse> {
    const refinedCode = await this.gemini.refineTestCase(
      request.current_code,
      request.feedback,
    );

    // Update the test case in the database
    await this.testCasesService.update(request.test_case_id, {
      playwright_code: refinedCode,
    });

    return {
      refined_code: refinedCode,
      changes_summary: 'Test case refined based on feedback',
    };
  }

  async analyzeUrl(
    url: string,
    pageData: string,
  ): Promise<string> {
    return this.gemini.analyzeUrl(url, pageData);
  }
}
