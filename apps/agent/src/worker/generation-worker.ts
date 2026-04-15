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
    console.log(`\n🤖 ════════════════════════════════════════`);
    console.log(`   Processing generation job: ${job.id}`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Test types: ${JSON.stringify(job.test_types)}`);
    console.log(`   ════════════════════════════════════════\n`);

    try {
      // 1. Fetch project details
      await this.updateJobStep(job.id, 'crawling', 'Fetching project details...');
      const project = await this.apiClient.getProject(projectId);
      console.log(`   Project: ${project.name} (${project.base_url})`);

      // --- Kill switch check: before crawling ---
      if (await this.isJobCancelled(job.id)) {
        console.log('⛔ Job cancelled by user, aborting...');
        await this.updateJobStep(job.id, 'cancelled', 'Job cancelled by user');
        return;
      }

      // 2. Crawl the site
      let mainAnalysis: any;
      let allAnalyses: any[];
      try {
        await this.updateJobStep(job.id, 'crawling', 'Launching Playwright browser...');
        await this.updateJobStep(job.id, 'crawling', `Navigating to ${project.base_url}...`);
        mainAnalysis = await crawlPage(project.base_url);

        const additionalUrls = mainAnalysis.page_routes
          .slice(0, 5)
          .map((route: string) => {
            try {
              return new URL(route, project.base_url).href;
            } catch {
              return null;
            }
          })
          .filter((u: string | null): u is string => u !== null);

        allAnalyses = [mainAnalysis];

        const routeCount = mainAnalysis.page_routes?.length || 0;
        await this.updateJobStep(
          job.id,
          'crawling',
          `Main page analyzed. Found ${routeCount} routes. Crawling additional pages...`,
        );

        if (additionalUrls.length > 0) {
          const additional = await crawlMultiplePages(additionalUrls, { maxPages: 5 });
          allAnalyses = [...allAnalyses, ...additional];
        }

        await this.updateJobStep(
          job.id,
          'crawling',
          `Crawl complete. ${allAnalyses.length} page(s) analyzed.`,
        );
      } catch (crawlError: any) {
        await this.updateJobStep(job.id, 'failed', `Failed to crawl site: ${crawlError.message}`);
        throw crawlError;
      }

      // --- Kill switch check: after crawling, before analyzing ---
      if (await this.isJobCancelled(job.id)) {
        console.log('⛔ Job cancelled by user, aborting...');
        await this.updateJobStep(job.id, 'cancelled', 'Job cancelled by user');
        return;
      }

      // 3. Send to Gemini for analysis
      let response: any;
      try {
        await this.updateJobStep(
          job.id,
          'analyzing',
          'Sending page structure to Gemini AI for analysis...',
        );

        const testTypes = job.test_types || ['e2e'];
        const prompt = this.buildModuleAnalysisPrompt(project, allAnalyses, testTypes);

        // --- Kill switch check: before calling Gemini ---
        if (await this.isJobCancelled(job.id)) {
          console.log('⛔ Job cancelled by user, aborting...');
          await this.updateJobStep(job.id, 'cancelled', 'Job cancelled by user');
          return;
        }

        response = await this.geminiClient.generateModulesAndTests(prompt);

        await this.updateJobStep(
          job.id,
          'analyzing',
          `AI identified ${response.modules.length} modules. Preparing test cases...`,
        );
      } catch (geminiError: any) {
        await this.updateJobStep(job.id, 'failed', `Gemini AI error: ${geminiError.message}`);
        throw geminiError;
      }

      // --- Kill switch check: before saving modules/test cases ---
      if (await this.isJobCancelled(job.id)) {
        console.log('⛔ Job cancelled by user, aborting...');
        await this.updateJobStep(job.id, 'cancelled', 'Job cancelled by user');
        return;
      }

      // 4. Save modules and test cases to Supabase
      let modulesCreated = 0;
      let testCasesCreated = 0;

      try {
        const totalModules = response.modules.length;

        for (const [index, module] of response.modules.entries()) {
          await this.updateJobStep(
            job.id,
            'generating',
            `Creating tests for module: ${module.name} (${index + 1}/${totalModules})...`,
          );

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

          console.log(
            `   [generating] Module "${module.name}": ${module.test_cases.length} test case(s)`,
          );
        }
      } catch (dbError: any) {
        await this.updateJobStep(job.id, 'failed', `Failed to save results: ${dbError.message}`);
        throw dbError;
      }

      // 5. Mark as completed
      await this.updateJobStep(
        job.id,
        'completed',
        `Done! ${modulesCreated} modules, ${testCasesCreated} test cases generated.`,
        {
          modules_found: modulesCreated,
          test_cases_generated: testCasesCreated,
          result_summary: {
            modules: response.modules.map((m: any) => ({
              name: m.name,
              test_count: m.test_cases.length,
            })),
          },
        },
      );

      console.log(
        `[generation] Job ${job.id} completed: ${modulesCreated} module(s), ${testCasesCreated} test case(s)`,
      );
    } catch (error: any) {
      console.error(`[generation] Job ${job.id} failed: ${error.message}`);
      // Only update to failed if not already marked by a specific catch block
      const supabase = this.apiClient.getSupabase();
      const { data } = await supabase
        .from('ai_generation_jobs')
        .select('status')
        .eq('id', job.id)
        .single();
      if (data?.status !== 'failed') {
        await this.updateJobStep(job.id, 'failed', `Error: ${error.message}`, {
          error_message: error.message,
        });
      }
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

  private async updateJobStep(
    jobId: string,
    status: string,
    step: string,
    extraData?: Record<string, any>,
  ): Promise<void> {
    const supabase = this.apiClient.getSupabase();
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, status, step };

    const update: any = {
      status,
      current_step: step,
    };
    if (status === 'crawling' && !extraData?.started_at) {
      update.started_at = timestamp;
    }
    if (status === 'completed' || status === 'failed') {
      update.completed_at = timestamp;
    }
    if (extraData) Object.assign(update, extraData);

    // Append to logs array: fetch current logs and append the new entry
    const { data: current } = await supabase
      .from('ai_generation_jobs')
      .select('logs')
      .eq('id', jobId)
      .single();

    const currentLogs = (current?.logs as any[]) || [];
    currentLogs.push(logEntry);
    update.logs = currentLogs;

    await supabase.from('ai_generation_jobs').update(update).eq('id', jobId);
    console.log(`   [${status}] ${step}`);
  }

  private async isJobCancelled(jobId: string): Promise<boolean> {
    const supabase = this.apiClient.getSupabase();
    const { data } = await supabase
      .from('ai_generation_jobs')
      .select('status')
      .eq('id', jobId)
      .single();
    return data?.status === 'cancelled';
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
