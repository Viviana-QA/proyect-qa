import { ApiClient } from '../connection/api-client';
import { GeminiClient } from '../ai/gemini-client';
import { crawlPage, crawlMultiplePages } from '../runner/page-crawler';

export class GenerationWorker {
  constructor(
    private apiClient: ApiClient,
    private geminiClient: GeminiClient,
  ) {}

  async processJob(job: any): Promise<void> {
    const projectId = job.project_id;

    try {
      // 1. Update status to 'crawling'
      await this.updateJobStatus(job.id, 'crawling', 'Exploring the website...');

      // 2. Fetch project details
      const project = await this.apiClient.getProject(projectId);

      // 3. Crawl the site
      console.log(`[generation] Crawling ${project.base_url}...`);
      const mainAnalysis = await crawlPage(project.base_url);

      // Crawl additional pages (up to 5 from discovered routes)
      const additionalUrls = mainAnalysis.page_routes
        .slice(0, 5)
        .map((route) => {
          try {
            return new URL(route, project.base_url).href;
          } catch {
            return null;
          }
        })
        .filter((u): u is string => u !== null);

      let allAnalyses = [mainAnalysis];
      if (additionalUrls.length > 0) {
        console.log(`[generation] Crawling ${additionalUrls.length} additional page(s)...`);
        const additional = await crawlMultiplePages(additionalUrls, { maxPages: 5 });
        allAnalyses = [...allAnalyses, ...additional];
      }

      console.log(`[generation] Crawled ${allAnalyses.length} page(s) total`);

      // 4. Update status to 'analyzing'
      await this.updateJobStatus(job.id, 'analyzing', 'AI is analyzing the application structure...');

      // 5. Send to Gemini for module identification + test generation
      const testTypes = job.test_types || ['e2e'];
      const prompt = this.buildModuleAnalysisPrompt(project, allAnalyses, testTypes);
      console.log('[generation] Sending crawl data to Gemini for analysis...');
      const response = await this.geminiClient.generateModulesAndTests(prompt);

      // 6. Update status to 'generating'
      await this.updateJobStatus(job.id, 'generating', 'Creating test cases...');

      // 7. Save modules and test cases to Supabase
      let modulesCreated = 0;
      let testCasesCreated = 0;

      for (const module of response.modules) {
        // Create app_module
        const createdModule = await this.createModule(projectId, module);
        modulesCreated++;

        // Create test_suite linked to module
        const suite = await this.apiClient.createTestSuite(projectId, {
          name: `${module.name} Tests`,
          description: `AI-generated tests for ${module.name}`,
          test_type: 'e2e',
        });

        // Link suite to the module via direct Supabase call
        if (createdModule?.id) {
          const supabase = this.apiClient.getSupabase();
          await supabase
            .from('test_suites')
            .update({ module_id: createdModule.id })
            .eq('id', suite.id);
        }

        // Create test_cases
        for (const testCase of module.test_cases) {
          await this.apiClient.createTestCase(projectId, {
            suite_id: suite.id,
            title: testCase.title,
            description: testCase.description,
            test_type: (testCase.test_type || 'e2e') as any,
            playwright_code: testCase.code,
            tags: testCase.tags || [],
            priority: (testCase.priority || 'medium') as any,
          });
          testCasesCreated++;
        }

        console.log(`[generation] Module "${module.name}": ${module.test_cases.length} test case(s)`);
      }

      // 8. Mark as completed
      await this.updateJobStatus(job.id, 'completed', 'Generation complete!', {
        modules_found: modulesCreated,
        test_cases_generated: testCasesCreated,
        result_summary: {
          modules: response.modules.map((m: any) => ({
            name: m.name,
            test_count: m.test_cases.length,
          })),
        },
      });

      console.log(
        `[generation] Job ${job.id} completed: ${modulesCreated} module(s), ${testCasesCreated} test case(s)`,
      );
    } catch (error: any) {
      console.error(`[generation] Job ${job.id} failed: ${error.message}`);
      await this.updateJobStatus(job.id, 'failed', null, {
        error_message: error.message,
      });
    }
  }

  private buildModuleAnalysisPrompt(
    project: any,
    analyses: any[],
    testTypes: string[],
  ): string {
    const pagesData = analyses.map((a) => ({
      url: a.url,
      title: a.title,
      headings: a.headings,
      interactive_elements: a.interactive_elements?.slice(0, 40),
      navigation_links: a.navigation_links?.slice(0, 20),
      forms: a.forms,
      aria_landmarks: a.aria_landmarks,
      api_endpoints: a.api_endpoints,
      page_routes: a.page_routes,
      detected_frameworks: a.detected_frameworks,
    }));

    let prompt = `You are a senior QA architect. Analyze the following web application and:
1. Identify the logical MODULES of the application (e.g., Authentication, Dashboard, User Management, Settings, etc.)
2. For EACH module, generate Playwright test cases.

## Project Information
- Base URL: ${project.base_url}
- Project Name: ${project.name || 'N/A'}
`;

    if (project.test_config) {
      prompt += `- Test Config: ${JSON.stringify(project.test_config)}\n`;
    }
    if (project.business_context) {
      prompt += `\n## Business Context\n${JSON.stringify(project.business_context, null, 2)}\n`;
    }

    prompt += `
## Crawled Pages (${analyses.length} pages)
${JSON.stringify(pagesData, null, 2)}

## Test Types Requested
${testTypes.join(', ')}

## Instructions
- Group related pages and functionality into logical modules.
- Each module should have a descriptive name and description.
- For each module, generate 2-5 Playwright test cases covering the key user flows.
- Use accessible selectors: prefer getByRole(), getByLabel(), getByText(), getByPlaceholder().
- Include proper assertions using expect().
- Navigate to the correct URL using the base URL: ${project.base_url}
- Each test must be a complete, self-contained Playwright test.

## Output Format
Return ONLY valid JSON matching this exact structure (no markdown fences, no extra text):
{
  "modules": [
    {
      "name": "Module Name",
      "description": "What this module covers",
      "urls": ["/path1", "/path2"],
      "element_count": 10,
      "test_cases": [
        {
          "title": "Test title",
          "description": "What this test verifies",
          "code": "import { test, expect } from '@playwright/test';\\ntest('test name', async ({ page }) => {\\n  // test code\\n});",
          "test_type": "e2e",
          "priority": "high",
          "tags": ["smoke", "auth"]
        }
      ]
    }
  ]
}
`;

    return prompt;
  }

  private async updateJobStatus(
    jobId: string,
    status: string,
    message?: string | null,
    extraData?: Record<string, any>,
  ): Promise<void> {
    const supabase = this.apiClient.getSupabase();
    const update: Record<string, any> = { status };

    if (message) update.progress_message = message;
    if (status === 'crawling') update.started_at = new Date().toISOString();
    if (status === 'completed') update.completed_at = new Date().toISOString();
    if (extraData) Object.assign(update, extraData);

    const { error } = await supabase
      .from('ai_generation_jobs')
      .update(update)
      .eq('id', jobId);

    if (error) {
      console.error(`[generation] Failed to update job ${jobId} status: ${error.message}`);
    }
  }

  private async createModule(
    projectId: string,
    moduleData: any,
  ): Promise<any> {
    const supabase = this.apiClient.getSupabase();
    const { data, error } = await supabase
      .from('app_modules')
      .insert({
        project_id: projectId,
        name: moduleData.name,
        description: moduleData.description,
        discovered_urls: moduleData.urls || [],
        element_count: moduleData.element_count || 0,
      })
      .select()
      .single();

    if (error) {
      console.error(`[generation] Failed to create module "${moduleData.name}": ${error.message}`);
      return null;
    }

    return data;
  }
}
