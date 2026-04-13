-- Test Runs: execution sessions
CREATE TABLE public.test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  suite_id UUID REFERENCES public.test_suites(id) ON DELETE SET NULL,
  triggered_by UUID NOT NULL REFERENCES auth.users(id),
  agent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'running', 'completed', 'failed', 'cancelled'
  )),
  total_tests INT NOT NULL DEFAULT 0,
  passed INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  duration_ms INT,
  browser TEXT NOT NULL DEFAULT 'chromium',
  environment JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_runs_project_id ON public.test_runs(project_id);
CREATE INDEX idx_test_runs_status ON public.test_runs(status);
CREATE INDEX idx_test_runs_triggered_by ON public.test_runs(triggered_by);

-- Junction table for test runs with specific test cases
CREATE TABLE public.test_run_cases (
  test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  PRIMARY KEY (test_run_id, test_case_id)
);
