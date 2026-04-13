import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { chromium, firefox, webkit, Browser, Page } from '@playwright/test';
import { AgentConfig } from '../config/agent-config';
import { ApiClient } from '../connection/api-client';
import type {
  TestRun,
  TestCase,
  TestResultStatus,
  SubmitTestResultDto,
} from '@qa/shared-types';

export class PlaywrightRunner {
  private tempDir: string;

  constructor(private config: AgentConfig) {
    this.tempDir = path.join(os.tmpdir(), 'qa-agent-tests');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async executeRun(
    run: TestRun,
    testCases: TestCase[],
    apiClient: ApiClient,
  ): Promise<void> {
    const browserType = this.getBrowserType(run.browser);
    const browser = await browserType.launch({ headless: this.config.headless });

    try {
      for (const testCase of testCases) {
        console.log(`  Running: ${testCase.title}`);
        const result = await this.executeTestCase(browser, testCase, run);
        await apiClient.submitResult(run.id, result);

        const icon = result.status === 'passed' ? '  ✓' : '  ✗';
        console.log(
          `${icon} ${testCase.title} (${result.duration_ms}ms) [${result.status}]`,
        );
      }
    } finally {
      await browser.close();
    }
  }

  private async executeTestCase(
    browser: Browser,
    testCase: TestCase,
    run: TestRun,
  ): Promise<SubmitTestResultDto> {
    const startTime = Date.now();
    const context = await browser.newContext({
      viewport: testCase.viewport_config
        ? {
            width: testCase.viewport_config.width,
            height: testCase.viewport_config.height,
          }
        : { width: 1280, height: 720 },
    });

    if (this.config.traceOnFailure) {
      await context.tracing.start({ screenshots: true, snapshots: true });
    }

    const page = await context.newPage();
    let status: TestResultStatus = 'passed';
    let errorMessage: string | undefined;
    let errorStack: string | undefined;
    const screenshotPaths: string[] = [];

    try {
      // Execute the test using Function constructor
      await this.runPlaywrightCode(testCase.playwright_code, page);
    } catch (error: any) {
      status = 'failed';
      errorMessage = error.message;
      errorStack = error.stack;

      // Take failure screenshot
      if (this.config.screenshotsOnFailure) {
        const ssPath = path.join(
          this.tempDir,
          `${testCase.id}-${Date.now()}.png`,
        );
        await page.screenshot({ path: ssPath, fullPage: true });
        screenshotPaths.push(ssPath);
      }
    } finally {
      if (this.config.traceOnFailure && status === 'failed') {
        const tracePath = path.join(
          this.tempDir,
          `${testCase.id}-trace.zip`,
        );
        await context.tracing.stop({ path: tracePath });
      } else {
        await context.tracing.stop();
      }
      await context.close();
    }

    const durationMs = Date.now() - startTime;

    return {
      test_case_id: testCase.id,
      status,
      error_message: errorMessage,
      error_stack: errorStack,
      duration_ms: durationMs,
      screenshot_paths: screenshotPaths,
    };
  }

  private async runPlaywrightCode(code: string, page: Page): Promise<void> {
    // Strip import statements and test() wrappers, extract the body
    const cleanCode = code
      .replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, '')
      .replace(/import\s*\{[^}]*\}\s*from\s*['"].*?['"];?\n?/g, '')
      .replace(
        /test\s*\(\s*['"].*?['"]\s*,\s*async\s*\(\s*\{[^}]*\}\s*\)\s*=>\s*\{/,
        '',
      )
      .replace(/\}\s*\)\s*;?\s*$/, '');

    // Create a function with page, expect available
    const { expect } = await import('@playwright/test');
    const fn = new Function(
      'page',
      'expect',
      `return (async () => { ${cleanCode} })()`,
    );
    await fn(page, expect);
  }

  private getBrowserType(browser: string) {
    switch (browser) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      default:
        return chromium;
    }
  }
}
