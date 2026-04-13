export interface Report {
  id: string;
  test_run_id: string;
  project_id: string;
  title: string;
  summary: ReportSummary;
  report_data: ReportData;
  html_report_path: string | null;
  created_at: string;
}

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  error: number;
  duration_ms: number;
  pass_rate: number;
  browser: string;
  test_types: string[];
}

export interface ReportData {
  suites: ReportSuiteData[];
  accessibility_summary?: AccessibilitySummary;
  performance_summary?: PerformanceSummaryData;
}

export interface ReportSuiteData {
  suite_name: string;
  test_type: string;
  results: ReportResultData[];
}

export interface ReportResultData {
  test_case_id: string;
  title: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  screenshot_urls: string[];
  jira_issue_key: string | null;
}

export interface AccessibilitySummary {
  total_violations: number;
  by_impact: Record<string, number>;
  top_violations: { id: string; count: number; impact: string }[];
}

export interface PerformanceSummaryData {
  avg_lcp_ms: number | null;
  avg_fcp_ms: number | null;
  avg_cls: number | null;
  avg_ttfb_ms: number | null;
}
