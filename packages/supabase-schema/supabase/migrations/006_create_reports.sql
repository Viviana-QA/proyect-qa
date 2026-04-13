-- Reports: generated from completed test runs
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary JSONB NOT NULL,
  report_data JSONB NOT NULL,
  html_report_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_project_id ON public.reports(project_id);
CREATE INDEX idx_reports_test_run_id ON public.reports(test_run_id);
