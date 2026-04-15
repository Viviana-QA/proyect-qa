export type TestRunStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TestResultStatus = 'passed' | 'failed' | 'skipped' | 'error';

export interface TestRun {
  id: string;
  project_id: string;
  suite_id: string | null;
  triggered_by: string;
  agent_id: string | null;
  status: TestRunStatus;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number | null;
  browser: string;
  environment: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TestResult {
  id: string;
  test_run_id: string;
  test_case_id: string;
  status: TestResultStatus;
  error_message: string | null;
  error_stack: string | null;
  duration_ms: number | null;
  screenshot_paths: string[];
  trace_path: string | null;
  diff_screenshot_path: string | null;
  accessibility_violations: AccessibilityViolation[] | null;
  performance_metrics: PerformanceMetrics | null;
  jira_issue_key: string | null;
  retry_count: number;
  created_at: string;
}

export interface AccessibilityViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  help_url: string;
  nodes: { html: string; target: string[] }[];
}

export interface PerformanceMetrics {
  lcp_ms?: number;
  fcp_ms?: number;
  cls?: number;
  ttfb_ms?: number;
  tti_ms?: number;
  total_blocking_time_ms?: number;
  dom_content_loaded_ms?: number;
  load_event_ms?: number;
}

export interface CreateTestRunDto {
  suite_id?: string;
  test_case_ids?: string[];
  browser?: string;
}

export interface SubmitTestResultDto {
  test_case_id: string;
  status: TestResultStatus;
  error_message?: string;
  error_stack?: string;
  duration_ms?: number;
  screenshot_paths?: string[];
  trace_path?: string;
  diff_screenshot_path?: string;
  accessibility_violations?: AccessibilityViolation[];
  performance_metrics?: PerformanceMetrics;
  retry_count?: number;
  healed?: boolean;
  original_error?: string;
}
