import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  PageAnalysis,
  AIGeneratedTestCase,
  TestType,
} from '@qa/shared-types';
import { validateAndFixTestCode } from './utils/test-validator';

export interface BusinessContext {
  project_type?: string;
  industry?: string;
  target_audience?: string;
  key_flows?: string;
  compliance?: string[];
}

export interface ModuleAnalysisResponse {
  modules: Array<{
    name: string;
    description: string;
    urls: string[];
    element_count: number;
    test_cases: Array<{
      title: string;
      description: string;
      code: string;
      test_type: string;
      priority: string;
      tags: string[];
    }>;
  }>;
}

export class GeminiClient {
  private model;
  private jsonModel;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.jsonModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });
  }

  async generateTests(
    pageAnalysis: PageAnalysis,
    testTypes: TestType[],
    baseUrl: string,
    businessContext?: BusinessContext,
  ): Promise<AIGeneratedTestCase[]> {
    const prompt = this.buildGeneratePrompt(
      pageAnalysis,
      testTypes,
      baseUrl,
      businessContext,
    );

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();

    return this.parseGeneratedTests(text);
  }

  async generateModulesAndTests(prompt: string): Promise<ModuleAnalysisResponse> {
    const result = await this.jsonModel.generateContent(prompt);
    const text = result.response.text();

    return this.parseModuleAnalysisResponse(text);
  }

  async healTest(
    failedCode: string,
    errorMessage: string,
    currentDom: string,
    screenshot?: string,
  ): Promise<string> {
    const prompt = this.buildHealPrompt(failedCode, errorMessage, currentDom);

    const result = await this.model.generateContent(prompt);
    const text = result.response.text();

    return this.parseHealedCode(text);
  }

  private buildGeneratePrompt(
    pageAnalysis: PageAnalysis,
    testTypes: TestType[],
    baseUrl: string,
    businessContext?: BusinessContext,
  ): string {
    let prompt = `You are a QA test generation expert. Generate Playwright test cases based on the following page analysis.

## Page Information
- URL: ${pageAnalysis.url}
- Title: ${pageAnalysis.title}
- Base URL: ${baseUrl}

## Page Structure
### Headings
${JSON.stringify(pageAnalysis.headings, null, 2)}

### Interactive Elements (${pageAnalysis.interactive_elements.length} found)
${JSON.stringify(pageAnalysis.interactive_elements.slice(0, 50), null, 2)}

### Navigation Links (${pageAnalysis.navigation_links.length} found)
${JSON.stringify(pageAnalysis.navigation_links.slice(0, 30), null, 2)}

### Forms (${pageAnalysis.forms.length} found)
${JSON.stringify(pageAnalysis.forms, null, 2)}

### ARIA Landmarks
${JSON.stringify(pageAnalysis.aria_landmarks, null, 2)}

### API Endpoints Detected
${JSON.stringify(pageAnalysis.api_endpoints, null, 2)}

### Page Routes
${JSON.stringify(pageAnalysis.page_routes, null, 2)}

## Test Types Requested
${testTypes.join(', ')}
`;

    if (businessContext) {
      prompt += `
## Business Context
- Project Type: ${businessContext.project_type || 'N/A'}
- Industry: ${businessContext.industry || 'N/A'}
- Target Audience: ${businessContext.target_audience || 'N/A'}
- Key Flows: ${businessContext.key_flows || 'N/A'}
- Compliance Requirements: ${businessContext.compliance?.join(', ') || 'None'}
`;
    }

    prompt += `
## Instructions
Generate Playwright test cases for EACH requested test type. For each test case, produce valid Playwright code that:
1. Uses accessible selectors: prefer getByRole(), getByLabel(), getByText(), getByPlaceholder() over CSS selectors
2. Includes proper assertions using expect()
3. Handles loading states with waitFor or appropriate timeouts
4. Navigates to the correct URL using the base URL: ${baseUrl}

## SYNTAX RULES (STRICT — invalid tests are parsed by the TypeScript compiler and DROPPED)
- Regex literals must be valid JavaScript. NEVER put characters after the closing /. WRONG: /.*foo/.*/  CORRECT: /.*foo.*/
- Escape forward slashes inside regex patterns. WRONG: /path/to/ CORRECT: /path\\/to/
- Balance every quote, backtick, paren, brace, and bracket. Never leave \${ unclosed in a template literal.
- No markdown fences inside playwright_code.
- No export statements in the test code.
- Each playwright_code MUST contain at least one test(...) call.
- Prefer plain strings or getByRole over regex whenever possible.

## Output Format
Return a JSON array of test case objects. Each object must have:
- title: string (descriptive test name)
- description: string (what the test verifies)
- test_type: string (one of: ${testTypes.join(', ')})
- priority: string (low, medium, high, or critical)
- tags: string[] (relevant tags)
- playwright_code: string (complete Playwright test code)
- browser_targets: string[] (default: ["chromium"])

IMPORTANT: Return ONLY the JSON array, no markdown code fences, no extra text.
`;

    return prompt;
  }

  private buildHealPrompt(
    failedCode: string,
    errorMessage: string,
    currentDom: string,
  ): string {
    // Truncate DOM to avoid exceeding token limits
    const truncatedDom =
      currentDom.length > 15000
        ? currentDom.substring(0, 15000) + '\n... (DOM truncated)'
        : currentDom;

    return `You are a Playwright test self-healing expert. A test has failed and you need to fix it.

## Failed Test Code
\`\`\`typescript
${failedCode}
\`\`\`

## Error Message
${errorMessage}

## Current Page DOM (may have changed since test was written)
\`\`\`html
${truncatedDom}
\`\`\`

## Instructions
Analyze the error and the current DOM to fix the test. Common issues include:
- Changed CSS selectors or IDs
- Modified text content
- Restructured DOM elements
- Changed element roles or attributes

Fix the test by:
1. Using accessible selectors (getByRole, getByLabel, getByText) when possible
2. Updating selectors to match the current DOM
3. Adjusting assertions if the expected behavior changed
4. Keeping the original test intent intact

## Output Format
Return ONLY the fixed Playwright test code. No markdown fences, no explanations, just the code.
`;
  }

  private parseGeneratedTests(text: string): AIGeneratedTestCase[] {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) {
        throw new Error('Expected JSON array of test cases');
      }
      const raw = parsed.map((tc: any) => ({
        title: tc.title || 'Untitled Test',
        description: tc.description || '',
        test_type: tc.test_type || 'e2e',
        priority: tc.priority || 'medium',
        tags: tc.tags || [],
        playwright_code: tc.playwright_code || '',
        browser_targets: tc.browser_targets || ['chromium'],
        viewport_config: tc.viewport_config,
      }));
      const validated: AIGeneratedTestCase[] = [];
      for (const tc of raw) {
        const result = validateAndFixTestCode(tc.playwright_code);
        if (result.valid && result.fixed) {
          validated.push({ ...tc, playwright_code: result.fixed });
        } else {
          console.warn(
            `[AI] Dropping invalid test "${tc.title}": ${result.errors.join('; ')}`,
          );
        }
      }
      return validated;
    } catch (error: any) {
      console.error('Failed to parse AI response as JSON:', error.message);
      console.error('Raw response (first 500 chars):', cleaned.substring(0, 500));
      throw new Error(
        `Failed to parse generated test cases: ${error.message}`,
      );
    }
  }

  private parseHealedCode(text: string): string {
    let cleaned = text.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:typescript|ts|javascript|js)?\n?/, '').replace(/\n?```$/, '');
    }
    if (!cleaned) {
      throw new Error('AI returned empty healed code');
    }
    return cleaned;
  }

  private parseModuleAnalysisResponse(text: string): ModuleAnalysisResponse {
    let cleaned = text.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);

      // Handle case where response is the modules array directly
      const modules = Array.isArray(parsed) ? parsed : parsed.modules;

      if (!Array.isArray(modules)) {
        throw new Error('Expected "modules" array in response');
      }

      return {
        modules: modules.map((m: any) => ({
          name: m.name || 'Unnamed Module',
          description: m.description || '',
          urls: m.urls || [],
          element_count: m.element_count || 0,
          test_cases: Array.isArray(m.test_cases)
            ? m.test_cases.map((tc: any) => ({
                title: tc.title || 'Untitled Test',
                description: tc.description || '',
                code: tc.code || tc.playwright_code || '',
                test_type: tc.test_type || 'e2e',
                priority: tc.priority || 'medium',
                tags: tc.tags || [],
              }))
            : [],
        })),
      };
    } catch (error: any) {
      console.error('Failed to parse module analysis response:', error.message);
      console.error('Raw response (first 500 chars):', cleaned.substring(0, 500));
      throw new Error(`Failed to parse module analysis response: ${error.message}`);
    }
  }
}
