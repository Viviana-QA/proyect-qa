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
