import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../config/supabase.module';
import {
  TestRun,
  TestResult,
  CreateTestRunDto,
  SubmitTestResultDto,
} from '@qa/shared-types';
import { TestCasesService } from '../test-cases/test-cases.service';

@Injectable()
export class TestRunsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly testCasesService: TestCasesService,
  ) {}

  async findByProject(projectId: string): Promise<TestRun[]> {
    const { data, error } = await this.supabase
      .from('test_runs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: string): Promise<TestRun> {
    const { data, error } = await this.supabase
      .from('test_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Test run not found');
    return data;
  }

  async findPending(): Promise<TestRun[]> {
    const { data, error } = await this.supabase
      .from('test_runs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;
    return data;
  }

  async create(
    projectId: string,
    dto: CreateTestRunDto,
    userId: string,
  ): Promise<TestRun> {
    // Determine which test cases to include
    let testCaseIds: string[] = [];
    if (dto.test_case_ids?.length) {
      testCaseIds = dto.test_case_ids;
    } else if (dto.suite_id) {
      const cases = await this.testCasesService.findBySuite(dto.suite_id);
      testCaseIds = cases
        .filter((c) => c.status === 'active')
        .map((c) => c.id);
    } else {
      const cases = await this.testCasesService.findByProject(projectId, {
        status: 'active',
      });
      testCaseIds = cases.map((c) => c.id);
    }

    const { data: run, error: runError } = await this.supabase
      .from('test_runs')
      .insert({
        project_id: projectId,
        suite_id: dto.suite_id || null,
        triggered_by: userId,
        status: 'pending',
        total_tests: testCaseIds.length,
        browser: dto.browser || 'chromium',
      })
      .select()
      .single();

    if (runError) throw runError;

    // Link test cases to the run
    if (testCaseIds.length > 0) {
      const junctionRecords = testCaseIds.map((tcId) => ({
        test_run_id: run.id,
        test_case_id: tcId,
      }));

      const { error: junctionError } = await this.supabase
        .from('test_run_cases')
        .insert(junctionRecords);

      if (junctionError) throw junctionError;
    }

    return run;
  }

  async claimRun(runId: string, agentId: string): Promise<TestRun> {
    const { data, error } = await this.supabase
      .from('test_runs')
      .update({
        status: 'running',
        agent_id: agentId,
        started_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Run not available');
    return data;
  }

  async getRunTestCases(runId: string) {
    const { data, error } = await this.supabase
      .from('test_run_cases')
      .select('test_case_id, test_cases(*)')
      .eq('test_run_id', runId);

    if (error) throw error;
    return data.map((r: any) => r.test_cases);
  }

  async submitResult(
    runId: string,
    dto: SubmitTestResultDto,
  ): Promise<TestResult> {
    const { data, error } = await this.supabase
      .from('test_results')
      .insert({ ...dto, test_run_id: runId })
      .select()
      .single();

    if (error) throw error;

    // Update run counters
    const statusField =
      dto.status === 'passed'
        ? 'passed'
        : dto.status === 'failed'
          ? 'failed'
          : 'skipped';

    const run = await this.findOne(runId);
    await this.supabase
      .from('test_runs')
      .update({ [statusField]: run[statusField] + 1 })
      .eq('id', runId);

    return data;
  }

  async completeRun(
    runId: string,
    durationMs: number,
  ): Promise<TestRun> {
    const run = await this.findOne(runId);
    const status = run.failed > 0 ? 'failed' : 'completed';

    const { data, error } = await this.supabase
      .from('test_runs')
      .update({
        status,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getResults(runId: string): Promise<TestResult[]> {
    const { data, error } = await this.supabase
      .from('test_results')
      .select('*')
      .eq('test_run_id', runId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }
}
