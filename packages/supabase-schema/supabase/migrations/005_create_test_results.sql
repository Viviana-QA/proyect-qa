-- Test Results: individual test outcomes
CREATE TABLE public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
  error_message TEXT,
  error_stack TEXT,
  duration_ms INT,
  screenshot_paths TEXT[] NOT NULL DEFAULT '{}',
  trace_path TEXT,
  diff_screenshot_path TEXT,
  accessibility_violations JSONB,
  performance_metrics JSONB,
  jira_issue_key TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_results_run_id ON public.test_results(test_run_id);
CREATE INDEX idx_test_results_test_case_id ON public.test_results(test_case_id);
CREATE INDEX idx_test_results_status ON public.test_results(status);

-- Enable realtime for live test result updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_runs;
