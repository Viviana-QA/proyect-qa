import { AIGenerateRequest, AIGeneratedTestCase } from '../../../shared-types';

export interface AIProvider {
  generateTestCases(request: AIGenerateRequest): Promise<AIGeneratedTestCase[]>;
  refineTestCase(currentCode: string, feedback: string): Promise<string>;
  analyzeUrl(url: string, pageData: string): Promise<string>;
}

export const AI_PROVIDER = 'AI_PROVIDER';
