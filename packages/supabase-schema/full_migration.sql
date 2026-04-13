-- QA Platform - Full Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- 001_create_projects.sql
-- ============================================
-- Projects: applications under test
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'staging' CHECK (environment IN ('development', 'staging', 'production')),
  auth_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================
-- 002_create_test_suites.sql
-- ============================================
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


-- ============================================
-- 003_create_test_cases.sql
-- ============================================
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


-- ============================================
-- 004_create_test_runs.sql
-- ============================================
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


-- ============================================
-- 005_create_test_results.sql
-- ============================================
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


-- ============================================
-- 006_create_reports.sql
-- ============================================
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


-- ============================================
-- 007_create_jira_configs.sql
-- ============================================
-- Jira Configurations: per-project Jira integration settings
CREATE TABLE public.jira_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  jira_base_url TEXT NOT NULL,
  jira_email TEXT NOT NULL,
  jira_api_token_encrypted TEXT NOT NULL,
  jira_project_key TEXT NOT NULL,
  issue_type TEXT NOT NULL DEFAULT 'Bug',
  auto_create_on_failure BOOLEAN NOT NULL DEFAULT false,
  label_prefix TEXT NOT NULL DEFAULT 'qa-auto',
  priority_mapping JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

CREATE TRIGGER jira_configs_updated_at
  BEFORE UPDATE ON public.jira_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================
-- 008_create_artifacts.sql
-- ============================================
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


-- ============================================
-- 009_enable_rls.sql
-- ============================================
-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_run_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jira_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

-- Projects: users can only access their own
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Helper function: check project ownership
CREATE OR REPLACE FUNCTION public.user_owns_project(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test Suites
CREATE POLICY "Users can view own test_suites"
  ON public.test_suites FOR SELECT
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can insert own test_suites"
  ON public.test_suites FOR INSERT
  WITH CHECK (public.user_owns_project(project_id));
CREATE POLICY "Users can update own test_suites"
  ON public.test_suites FOR UPDATE
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can delete own test_suites"
  ON public.test_suites FOR DELETE
  USING (public.user_owns_project(project_id));

-- Test Cases
CREATE POLICY "Users can view own test_cases"
  ON public.test_cases FOR SELECT
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can insert own test_cases"
  ON public.test_cases FOR INSERT
  WITH CHECK (public.user_owns_project(project_id));
CREATE POLICY "Users can update own test_cases"
  ON public.test_cases FOR UPDATE
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can delete own test_cases"
  ON public.test_cases FOR DELETE
  USING (public.user_owns_project(project_id));

-- Test Runs
CREATE POLICY "Users can view own test_runs"
  ON public.test_runs FOR SELECT
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can insert own test_runs"
  ON public.test_runs FOR INSERT
  WITH CHECK (public.user_owns_project(project_id));
CREATE POLICY "Users can update own test_runs"
  ON public.test_runs FOR UPDATE
  USING (public.user_owns_project(project_id));

-- Test Run Cases (junction)
CREATE POLICY "Users can view own test_run_cases"
  ON public.test_run_cases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.test_runs tr
    WHERE tr.id = test_run_id AND public.user_owns_project(tr.project_id)
  ));
CREATE POLICY "Users can insert own test_run_cases"
  ON public.test_run_cases FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.test_runs tr
    WHERE tr.id = test_run_id AND public.user_owns_project(tr.project_id)
  ));

-- Test Results
CREATE POLICY "Users can view own test_results"
  ON public.test_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.test_runs tr
    WHERE tr.id = test_run_id AND public.user_owns_project(tr.project_id)
  ));
CREATE POLICY "Users can insert own test_results"
  ON public.test_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.test_runs tr
    WHERE tr.id = test_run_id AND public.user_owns_project(tr.project_id)
  ));
CREATE POLICY "Users can update own test_results"
  ON public.test_results FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.test_runs tr
    WHERE tr.id = test_run_id AND public.user_owns_project(tr.project_id)
  ));

-- Reports
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can insert own reports"
  ON public.reports FOR INSERT
  WITH CHECK (public.user_owns_project(project_id));

-- Jira Configs
CREATE POLICY "Users can view own jira_configs"
  ON public.jira_configs FOR SELECT
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can insert own jira_configs"
  ON public.jira_configs FOR INSERT
  WITH CHECK (public.user_owns_project(project_id));
CREATE POLICY "Users can update own jira_configs"
  ON public.jira_configs FOR UPDATE
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can delete own jira_configs"
  ON public.jira_configs FOR DELETE
  USING (public.user_owns_project(project_id));

-- Artifacts
CREATE POLICY "Users can view own artifacts"
  ON public.artifacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.test_runs tr
    WHERE tr.id = test_run_id AND public.user_owns_project(tr.project_id)
  ));
CREATE POLICY "Users can insert own artifacts"
  ON public.artifacts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.test_runs tr
    WHERE tr.id = test_run_id AND public.user_owns_project(tr.project_id)
  ));

-- Service role bypass for backend operations
-- The NestJS backend uses the service_role key which bypasses RLS


