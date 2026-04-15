import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { chromium, firefox, webkit, Browser, Page } from '@playwright/test';
import { AgentConfig } from '../config/agent-config';
import { ApiClient } from '../connection/api-client';
import { CodeSanitizer } from './code-sanitizer';
import { GeminiClient } from '../ai/gemini-client';
import type {
  TestRun,
  TestCase,
  TestResultStatus,
  SubmitTestResultDto,
} from '@qa/shared-types';

export class PlaywrightRunner {
  private tempDir: string;
  private geminiClient: GeminiClient | null = null;

  constructor(private config: AgentConfig) {
    this.tempDir = path.join(os.tmpdir(), 'qa-agent-tests');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Initialize Gemini client for self-healing if API key is available
    const geminiApiKey =
      this.config.geminiApiKey || process.env.QA_GEMINI_API_KEY;
    if (geminiApiKey) {
      this.geminiClient = new GeminiClient(geminiApiKey);
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
        const result = await this.executeTestCase(browser, testCase, run, apiClient);
        await apiClient.submitResult(run.id, result);

        const icon = result.status === 'passed' ? '  ✓' : '  ✗';
        const healedTag = result.healed ? ' [HEALED]' : '';
        console.log(
          `${icon} ${testCase.title} (${result.duration_ms}ms) [${result.status}]${healedTag}`,
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
    apiClient?: ApiClient,
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
    let healed = false;
    let originalError: string | undefined;
    const screenshotPaths: string[] = [];

    try {
      // Execute the test using Function constructor
      await this.runPlaywrightCode(testCase.playwright_code, page);
    } catch (error: any) {
      status = 'failed';
      errorMessage = error.message;
      errorStack = error.stack;
      originalError = error.message;

      // Take failure screenshot
      if (this.config.screenshotsOnFailure) {
        const ssPath = path.join(
          this.tempDir,
          `${testCase.id}-${Date.now()}.png`,
        );
        await page.screenshot({ path: ssPath, fullPage: true });
        screenshotPaths.push(ssPath);
      }

      // Self-healing: attempt to fix and retry the test (max 1 retry)
      if (this.geminiClient) {
        try {
          console.log(`    Attempting self-healing for "${testCase.title}"...`);

          // Capture current DOM for healing context
          const currentDom = await page.content();

          // Ask Gemini to fix the test
          const healedCode = await this.geminiClient.healTest(
            testCase.playwright_code,
            errorMessage || 'Unknown error',
            currentDom,
          );

          // Close old context, create fresh one for retry
          if (this.config.traceOnFailure) {
            await context.tracing.stop();
          }
          await context.close();

          // Retry with healed code in a fresh context
          const retryResult = await this.retryWithHealedCode(
            browser,
            testCase,
            healedCode,
          );

          if (retryResult.passed) {
            status = 'passed';
            healed = true;
            errorMessage = undefined;
            errorStack = undefined;
            console.log(`    Self-healing succeeded!`);

            // Update the test case in the backend with healed code
            if (apiClient) {
              try {
                await apiClient.updateTestCase(
                  testCase.project_id,
                  testCase.id,
                  { playwright_code: healedCode },
                );
                console.log(`    Test case updated with healed code.`);
              } catch (updateErr: any) {
                console.error(
                  `    Warning: Failed to update test case: ${updateErr.message}`,
                );
              }
            }
          } else {
            // Healing retry also failed
            console.log(`    Self-healing failed - test still broken.`);
            errorMessage = `Original: ${originalError} | Healed retry: ${retryResult.error}`;
            if (retryResult.screenshotPath) {
              screenshotPaths.push(retryResult.screenshotPath);
            }
          }

          const durationMs = Date.now() - startTime;
          return {
            test_case_id: testCase.id,
            status,
            error_message: errorMessage,
            error_stack: errorStack,
            duration_ms: durationMs,
            screenshot_paths: screenshotPaths,
            healed,
            original_error: originalError,
          };
        } catch (healError: any) {
          console.error(
            `    Self-healing error: ${healError.message}`,
          );
          // Fall through to normal failure result
        }
      }
    } finally {
      // Only stop tracing/close context if not already handled by self-healing
      if (!healed) {
        try {
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
        } catch {
          // Context may already be closed by self-healing path
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      test_case_id: testCase.id,
      status,
      error_message: errorMessage,
      error_stack: errorStack,
      duration_ms: durationMs,
      screenshot_paths: screenshotPaths,
      healed,
      original_error: originalError,
    };
  }

  private async retryWithHealedCode(
    browser: Browser,
    testCase: TestCase,
    healedCode: string,
  ): Promise<{ passed: boolean; error?: string; screenshotPath?: string }> {
    const context = await browser.newContext({
      viewport: testCase.viewport_config
        ? {
            width: testCase.viewport_config.width,
            height: testCase.viewport_config.height,
          }
        : { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    try {
      await this.runPlaywrightCode(healedCode, page);
      return { passed: true };
    } catch (retryError: any) {
      // Capture screenshot of the retry failure
      let screenshotPath: string | undefined;
      if (this.config.screenshotsOnFailure) {
        screenshotPath = path.join(
          this.tempDir,
          `${testCase.id}-healed-retry-${Date.now()}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }
      return {
        passed: false,
        error: retryError.message,
        screenshotPath,
      };
    } finally {
      await context.close();
    }
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

    // Sanitize code before execution to block dangerous patterns
    const sanitizeResult = CodeSanitizer.sanitize(cleanCode);
    if (!sanitizeResult.safe) {
      const violationList = sanitizeResult.violations.join('; ');
      throw new Error(
        `Code sanitization failed — execution blocked. Violations: ${violationList}`,
      );
    }

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
