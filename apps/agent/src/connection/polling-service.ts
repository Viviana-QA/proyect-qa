import { ApiClient } from './api-client';
import { PlaywrightRunner } from '../runner/playwright-runner';
import type { TestRun } from '@qa/shared-types';

export class PollingService {
  private running = false;
  private pollIntervalMs = 5000;

  constructor(
    private apiClient: ApiClient,
    private runner: PlaywrightRunner,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    console.log(`Polling for test runs every ${this.pollIntervalMs / 1000}s...`);

    while (this.running) {
      try {
        const pendingRuns = await this.apiClient.getPendingRuns();

        if (pendingRuns.length > 0) {
          console.log(`Found ${pendingRuns.length} pending run(s)`);
          for (const run of pendingRuns) {
            if (!this.running) break;
            await this.processRun(run);
          }
        }
      } catch (error: any) {
        console.error(`Polling error: ${error.message}`);
      }

      if (this.running) {
        await sleep(this.pollIntervalMs);
      }
    }
  }

  stop(): void {
    this.running = false;
    console.log('Agent stopping...');
  }

  private async processRun(run: TestRun): Promise<void> {
    console.log(`\nProcessing run ${run.id} (${run.browser})`);

    try {
      // Claim the run
      await this.apiClient.claimRun(run.id);
      console.log('Run claimed successfully');

      // Get test cases
      const testCases = await this.apiClient.getRunTestCases(run.id);
      console.log(`Found ${testCases.length} test case(s) to execute`);

      // Execute tests
      const startTime = Date.now();
      await this.runner.executeRun(run, testCases, this.apiClient);
      const durationMs = Date.now() - startTime;

      // Mark run as complete
      await this.apiClient.completeRun(run.id, durationMs);
      console.log(`Run completed in ${(durationMs / 1000).toFixed(1)}s`);
    } catch (error: any) {
      console.error(`Run ${run.id} failed: ${error.message}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
