-- Artifacts: metadata for files stored in Supabase Storage
CREATE TABLE public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID REFERENCES public.test_results(id) ON DELETE CASCADE,
  test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'screenshot', 'trace', 'video', 'diff_image', 'html_report', 'log'
  )),
  storage_path TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artifacts_test_result_id ON public.artifacts(test_result_id);
CREATE INDEX idx_artifacts_test_run_id ON public.artifacts(test_run_id);
