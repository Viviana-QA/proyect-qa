import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../config/supabase.module';
import { Report, ReportSummary } from '@qa/shared-types';
import { TestRunsService } from '../test-runs/test-runs.service';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly testRunsService: TestRunsService,
  ) {}

  async findByProject(projectId: string): Promise<Report[]> {
    const { data, error } = await this.supabase
      .from('reports')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: string): Promise<Report> {
    const { data, error } = await this.supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Report not found');
    return data;
  }

  async generateFromRun(runId: string): Promise<Report> {
    const run = await this.testRunsService.findOne(runId);
    const results = await this.testRunsService.getResults(runId);

    const passRate =
      run.total_tests > 0
        ? Math.round((run.passed / run.total_tests) * 100)
        : 0;

    const testTypes = [...new Set(results.map((r: any) => r.test_type).filter(Boolean))];

    const summary: ReportSummary = {
      total: run.total_tests,
      passed: run.passed,
      failed: run.failed,
      skipped: run.skipped,
      error: results.filter((r) => r.status === 'error').length,
      duration_ms: run.duration_ms || 0,
      pass_rate: passRate,
      browser: run.browser,
      test_types: testTypes,
    };

    // Build accessibility summary if applicable
    const a11yViolations = results
      .filter((r) => r.accessibility_violations?.length)
      .flatMap((r) => r.accessibility_violations || []);

    const accessibilitySummary = a11yViolations.length
      ? {
          total_violations: a11yViolations.length,
          by_impact: a11yViolations.reduce(
            (acc: Record<string, number>, v: any) => {
              acc[v.impact] = (acc[v.impact] || 0) + 1;
              return acc;
            },
            {},
          ),
          top_violations: [],
        }
      : undefined;

    // Build performance summary if applicable
    const perfMetrics = results
      .filter((r) => r.performance_metrics)
      .map((r) => r.performance_metrics!);

    const performanceSummary = perfMetrics.length
      ? {
          avg_lcp_ms: avg(perfMetrics.map((m) => m.lcp_ms)),
          avg_fcp_ms: avg(perfMetrics.map((m) => m.fcp_ms)),
          avg_cls: avg(perfMetrics.map((m) => m.cls)),
          avg_ttfb_ms: avg(perfMetrics.map((m) => m.ttfb_ms)),
        }
      : undefined;

    const reportData = {
      suites: [],
      accessibility_summary: accessibilitySummary,
      performance_summary: performanceSummary,
    };

    const title = `Test Report - ${new Date().toISOString().split('T')[0]} - ${run.browser}`;

    const { data, error } = await this.supabase
      .from('reports')
      .insert({
        test_run_id: runId,
        project_id: run.project_id,
        title,
        summary,
        report_data: reportData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

function avg(values: (number | undefined | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}
