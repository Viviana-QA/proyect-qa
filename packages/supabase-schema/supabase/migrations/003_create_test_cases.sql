-- Test Cases: individual Playwright test scripts
CREATE TABLE public.test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES public.test_suites(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  test_type TEXT NOT NULL CHECK (test_type IN (
    'e2e', 'regression', 'visual', 'accessibility',
    'performance', 'api', 'cross_browser', 'responsive'
  )),
  playwright_code TEXT NOT NULL,
  ai_prompt_used TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'disabled', 'archived')),
  browser_targets TEXT[] NOT NULL DEFAULT '{chromium}',
  viewport_config JSONB,
  expected_screenshot_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_cases_suite_id ON public.test_cases(suite_id);
CREATE INDEX idx_test_cases_project_id ON public.test_cases(project_id);
CREATE INDEX idx_test_cases_test_type ON public.test_cases(test_type);
CREATE INDEX idx_test_cases_status ON public.test_cases(status);

CREATE TRIGGER test_cases_updated_at
  BEFORE UPDATE ON public.test_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
