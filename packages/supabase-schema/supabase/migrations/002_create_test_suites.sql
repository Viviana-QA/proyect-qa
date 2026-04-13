-- Test Suites: groupings of test cases by type
CREATE TABLE public.test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  test_type TEXT NOT NULL CHECK (test_type IN (
    'e2e', 'regression', 'visual', 'accessibility',
    'performance', 'api', 'cross_browser', 'responsive'
  )),
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_suites_project_id ON public.test_suites(project_id);

CREATE TRIGGER test_suites_updated_at
  BEFORE UPDATE ON public.test_suites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
