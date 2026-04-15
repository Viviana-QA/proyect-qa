import { loadConfig } from '../config/agent-config';
import { ApiClient } from '../connection/api-client';
import { GeminiClient, BusinessContext } from '../ai/gemini-client';
import { crawlPage } from '../runner/page-crawler';
import type {
  Project,
  TestType,
  AIGeneratedTestCase,
  CreateTestCaseDto,
} from '@qa/shared-types';

export async function generateCommand(projectId: string): Promise<void> {
  const config = loadConfig();

  // Validate Gemini API key
  if (!config.geminiApiKey) {
    console.error(
      '\nError: Gemini API key not configured.',
    );
    console.error(
      'Set QA_GEMINI_API_KEY environment variable or add "geminiApiKey" to .qa-agent.json\n',
    );
    process.exit(1);
  }

  const apiClient = new ApiClient(config);
  const hasSession = await apiClient.restoreSession();
  if (!hasSession) {
    console.error('\nNot authenticated. Run "qa-agent login" first.\n');
    process.exit(1);
  }

  try {
    // Step 1: Fetch project details from backend
    console.log('\nFetching project details...');
    const project = await apiClient.getProject(projectId);
    console.log(`  Project: ${project.name}`);
    console.log(`  Base URL: ${project.base_url}`);

    // Step 2: Determine which test types to generate
    const testTypes = getEnabledTestTypes(project.test_config);
    if (testTypes.length === 0) {
      console.error('\nNo test types enabled for this project.\n');
      process.exit(1);
    }
    console.log(`  Test types: ${testTypes.join(', ')}`);

    // Step 3: Crawl the project URL
    console.log(`\nCrawling ${project.base_url}...`);
    const pageAnalysis = await crawlPage(project.base_url);
    console.log(`  Found ${pageAnalysis.interactive_elements.length} interactive elements`);
    console.log(`  Found ${pageAnalysis.forms.length} forms`);
    console.log(`  Found ${pageAnalysis.navigation_links.length} navigation links`);

    // Step 4: Build business context from project data
    const businessContext: BusinessContext = {
      project_type: project.project_type,
      industry: project.industry,
      target_audience: project.target_audience,
      key_flows: project.key_flows,
      compliance: project.compliance,
    };

    // Step 5: Generate tests with Gemini (locally, no timeout!)
    console.log('\nGenerating test cases with Gemini AI...');
    const gemini = new GeminiClient(config.geminiApiKey);
    const generatedTests = await gemini.generateTests(
      pageAnalysis,
      testTypes,
      project.base_url,
      businessContext,
    );
    console.log(`  Generated ${generatedTests.length} test cases`);

    // Step 6: Create a test suite and POST test cases to backend
    console.log('\nSaving test cases to backend...');
    const suite = await apiClient.createTestSuite(projectId, {
      name: `AI Generated - ${new Date().toISOString().split('T')[0]}`,
      description: `Auto-generated tests for ${project.name} by local agent`,
      test_type: testTypes[0],
    });

    let savedCount = 0;
    for (const tc of generatedTests) {
      try {
        const dto: CreateTestCaseDto = {
          suite_id: suite.id,
          title: tc.title,
          description: tc.description,
          test_type: tc.test_type,
          playwright_code: tc.playwright_code,
          tags: tc.tags,
          priority: tc.priority,
          browser_targets: tc.browser_targets,
          viewport_config: tc.viewport_config,
        };
        await apiClient.createTestCase(projectId, dto);
        savedCount++;
      } catch (err: any) {
        console.error(`  Failed to save "${tc.title}": ${err.message}`);
      }
    }

    // Step 7: Print summary
    console.log('\n--- Generation Summary ---');
    console.log(`  Project:        ${project.name}`);
    console.log(`  Suite:          ${suite.name}`);
    console.log(`  Tests generated: ${generatedTests.length}`);
    console.log(`  Tests saved:     ${savedCount}`);
    console.log(`  Test types:      ${testTypes.join(', ')}`);

    if (savedCount > 0) {
      console.log('\nTest cases by type:');
      const byType: Record<string, number> = {};
      for (const tc of generatedTests) {
        byType[tc.test_type] = (byType[tc.test_type] || 0) + 1;
      }
      for (const [type, count] of Object.entries(byType)) {
        console.log(`  ${type}: ${count}`);
      }
    }

    console.log('\nDone! Run "qa-agent start" to execute the generated tests.\n');
  } catch (error: any) {
    console.error(`\nGeneration failed: ${error.message}\n`);
    process.exit(1);
  }
}

function getEnabledTestTypes(
  testConfig?: Project['test_config'],
): TestType[] {
  if (!testConfig) return ['e2e'];

  const mapping: Record<string, TestType> = {
    e2e: 'e2e',
    regression: 'regression',
    visual_regression: 'visual',
    accessibility: 'accessibility',
    performance: 'performance',
    api_testing: 'api',
    cross_browser: 'cross_browser',
    responsive: 'responsive',
  };

  const types: TestType[] = [];
  for (const [key, testType] of Object.entries(mapping)) {
    if ((testConfig as any)[key] === true) {
      types.push(testType);
    }
  }

  return types.length > 0 ? types : ['e2e'];
}
