import { RealtimeChannel } from '@supabase/supabase-js';
import { ApiClient } from './api-client';
import { PlaywrightRunner } from '../runner/playwright-runner';
import { GeminiClient } from '../ai/gemini-client';
import { GenerationWorker } from '../worker/generation-worker';
import type { TestRun } from '@qa/shared-types';

/**
 * RealtimeService replaces the old 5-second HTTP polling loop.
 *
 * Primary mechanism: Supabase Realtime WebSocket subscription on the
 * `test_runs` table filtered to `status=eq.pending`.  The agent is
 * notified instantly when a new pending run appears -- zero Vercel
 * invocations consumed.
 *
 * Fallback: a single HTTP poll every 60 seconds catches anything that
 * the Realtime channel might have missed (e.g. during a brief
 * reconnect window).
 */
export class RealtimeService {
  private running = false;
  private channel: RealtimeChannel | null = null;
  private generationChannel: RealtimeChannel | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private processing = new Set<string>();
  private processingJobs = new Set<string>();
  private generationWorker: GenerationWorker | null = null;

  // 15s for faster detection during development, increase to 60s for production
  private static readonly FALLBACK_INTERVAL_MS = 15_000;

  constructor(
    private apiClient: ApiClient,
    private runner: PlaywrightRunner,
    private geminiClient?: GeminiClient,
  ) {
    if (geminiClient) {
      this.generationWorker = new GenerationWorker(apiClient, geminiClient);
    }
  }

  // ----- public API -----

  async start(): Promise<void> {
    this.running = true;

    console.log('🔌 Setting up Supabase Realtime subscriptions...');
    this.subscribeRealtime();
    if (this.generationWorker) {
      this.subscribeGenerationJobs();
      console.log('🤖 AI generation worker: ENABLED');
    } else {
      console.log('⚠️  AI generation worker: DISABLED (no Gemini API key)');
    }
    this.startFallbackPolling();

    console.log('👂 Agent listening via Supabase Realtime (fallback poll every 60s)');
    console.log('');

    // Do an immediate poll on startup to catch any pending jobs
    console.log('🔍 Running initial check for pending jobs...');
    await this.immediateCheck();

    // Keep the process alive until stop() is called.
    await this.waitUntilStopped();
  }

  private async immediateCheck(): Promise<void> {
    try {
      const supabase = this.apiClient.getSupabase();

      // Check for pending test runs
      const { data: pendingRuns, error: runsError } = await supabase
        .from('test_runs')
        .select('id, status, project_id')
        .eq('status', 'pending')
        .limit(5);

      if (runsError) {
        console.error(`❌ Error querying test_runs: ${runsError.message} (code: ${runsError.code})`);
        console.error('   This likely means RLS is blocking or the table does not exist.');
      } else {
        console.log(`   test_runs pending: ${pendingRuns?.length ?? 0}`);
      }

      // Check for pending generation jobs
      const { data: pendingJobs, error: jobsError } = await supabase
        .from('ai_generation_jobs')
        .select('id, status, project_id')
        .eq('status', 'pending')
        .limit(5);

      if (jobsError) {
        console.error(`❌ Error querying ai_generation_jobs: ${jobsError.message} (code: ${jobsError.code})`);
        console.error('   Possible causes:');
        console.error('   1. Table "ai_generation_jobs" does not exist (run the SQL migration!)');
        console.error('   2. RLS policies are blocking access');
        console.error('   3. Supabase credentials are wrong');
      } else {
        console.log(`   ai_generation_jobs pending: ${pendingJobs?.length ?? 0}`);
        if (pendingJobs && pendingJobs.length > 0) {
          console.log(`🎯 Found ${pendingJobs.length} pending job(s)! Processing...`);
          for (const job of pendingJobs) {
            this.enqueueJob(job);
          }
        }
      }

      console.log('✅ Initial check complete.\n');
    } catch (err: any) {
      console.error(`❌ Initial check failed: ${err.message}`);
    }
  }

  stop(): void {
    this.running = false;
    console.log('Agent stopping...');

    if (this.channel) {
      this.apiClient.getSupabase().removeChannel(this.channel);
      this.channel = null;
    }

    if (this.generationChannel) {
      this.apiClient.getSupabase().removeChannel(this.generationChannel);
      this.generationChannel = null;
    }

    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  // ----- Realtime subscription -----

  private subscribeRealtime(): void {
    const supabase = this.apiClient.getSupabase();

    this.channel = supabase
      .channel('test-runs-pending')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'test_runs',
          filter: 'status=eq.pending',
        },
        (payload) => {
          const run = payload.new as TestRun;
          console.log(`[realtime] New pending run detected: ${run.id}`);
          this.enqueueRun(run);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'test_runs',
          filter: 'status=eq.pending',
        },
        (payload) => {
          const run = payload.new as TestRun;
          console.log(`[realtime] Run updated to pending: ${run.id}`);
          this.enqueueRun(run);
        },
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[realtime] Subscribed to test_runs changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[realtime] Channel error: ${err?.message ?? 'unknown'}`);
        } else if (status === 'TIMED_OUT') {
          console.warn('[realtime] Subscription timed out, will rely on fallback polling');
        }
      });
  }

  // ----- Generation jobs subscription -----

  private subscribeGenerationJobs(): void {
    const supabase = this.apiClient.getSupabase();

    this.generationChannel = supabase
      .channel('generation-jobs-pending')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_generation_jobs',
          filter: 'status=eq.pending',
        },
        (payload) => {
          const job = payload.new as any;
          console.log(`[realtime] New pending generation job detected: ${job.id}`);
          this.enqueueJob(job);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_generation_jobs',
          filter: 'status=eq.pending',
        },
        (payload) => {
          const job = payload.new as any;
          console.log(`[realtime] Generation job updated to pending: ${job.id}`);
          this.enqueueJob(job);
        },
      )
      .subscribe((status, err) => {
        console.log(`[realtime] ai_generation_jobs subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [realtime] Subscribed to ai_generation_jobs changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ [realtime] Generation jobs channel error: ${err?.message ?? 'unknown'}`);
          console.error('   Check: Is Realtime enabled on ai_generation_jobs in Supabase?');
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️  [realtime] Generation jobs subscription timed out');
        } else if (status === 'CLOSED') {
          console.warn('⚠️  [realtime] Generation jobs channel closed');
        }
      });
  }

  private enqueueJob(job: any): void {
    if (!this.running || !this.generationWorker) return;
    if (this.processingJobs.has(job.id)) return;

    this.processingJobs.add(job.id);
    this.generationWorker.processJob(job).finally(() => {
      this.processingJobs.delete(job.id);
    });
  }

  // ----- Fallback polling (60 s) -----

  private startFallbackPolling(): void {
    this.fallbackTimer = setInterval(async () => {
      if (!this.running) return;

      const timestamp = new Date().toLocaleTimeString();
      console.log(`\n⏱️  [${timestamp}] Fallback poll running...`);

      try {
        const pendingRuns = await this.apiClient.getPendingRuns();
        console.log(`   test_runs pending: ${pendingRuns.length}`);
        if (pendingRuns.length > 0) {
          for (const run of pendingRuns) {
            this.enqueueRun(run);
          }
        }
      } catch (error: any) {
        console.error(`   ❌ test_runs poll error: ${error.message}`);
      }

      // Also poll for pending generation jobs
      if (this.generationWorker) {
        try {
          const supabase = this.apiClient.getSupabase();
          const { data: pendingJobs, error: jobsErr } = await supabase
            .from('ai_generation_jobs')
            .select('*')
            .eq('status', 'pending')
            .limit(5);

          if (jobsErr) {
            console.error(`   ❌ ai_generation_jobs poll error: ${jobsErr.message} (${jobsErr.code})`);
          } else {
            console.log(`   ai_generation_jobs pending: ${pendingJobs?.length ?? 0}`);
            if (pendingJobs && pendingJobs.length > 0) {
              console.log(`   🎯 Processing ${pendingJobs.length} job(s)...`);
              for (const job of pendingJobs) {
                this.enqueueJob(job);
              }
            }
          }
        } catch (error: any) {
          console.error(`   ❌ Generation jobs poll error: ${error.message}`);
        }
      }
    }, RealtimeService.FALLBACK_INTERVAL_MS);
  }

  // ----- Run processing -----

  private enqueueRun(run: TestRun): void {
    if (!this.running) return;
    if (this.processing.has(run.id)) return; // already being handled

    this.processing.add(run.id);
    this.processRun(run).finally(() => {
      this.processing.delete(run.id);
    });
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

  // ----- Helpers -----

  private waitUntilStopped(): Promise<void> {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!this.running) {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  }
}
