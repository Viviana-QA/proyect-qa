-- App Modules: logical groupings of application features discovered by AI
CREATE TABLE public.app_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discovered_urls TEXT[] DEFAULT '{}',
  element_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_modules_project_id ON public.app_modules(project_id);

CREATE TRIGGER app_modules_updated_at
  BEFORE UPDATE ON public.app_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Link test_suites to app_modules (optional FK)
ALTER TABLE public.test_suites
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.app_modules(id) ON DELETE SET NULL;

CREATE INDEX idx_test_suites_module_id ON public.test_suites(module_id);

-- AI Generation Jobs: async job tracking for AI test generation
CREATE TABLE public.ai_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'crawling', 'analyzing', 'generating', 'completed', 'failed'
  )),
  test_types TEXT[] DEFAULT '{e2e}',
  progress_message TEXT,
  result_summary JSONB,
  error_message TEXT,
  modules_found INT DEFAULT 0,
  test_cases_generated INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_generation_jobs_project_id ON public.ai_generation_jobs(project_id);
CREATE INDEX idx_ai_generation_jobs_status ON public.ai_generation_jobs(status);

-- Enable Realtime for jobs (so frontend can track progress live)
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_generation_jobs;

-- RLS for app_modules
ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own app_modules"
  ON public.app_modules FOR SELECT
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can insert own app_modules"
  ON public.app_modules FOR INSERT
  WITH CHECK (public.user_owns_project(project_id));
CREATE POLICY "Users can update own app_modules"
  ON public.app_modules FOR UPDATE
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can delete own app_modules"
  ON public.app_modules FOR DELETE
  USING (public.user_owns_project(project_id));

-- RLS for ai_generation_jobs
ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_generation_jobs"
  ON public.ai_generation_jobs FOR SELECT
  USING (public.user_owns_project(project_id));
CREATE POLICY "Users can insert own ai_generation_jobs"
  ON public.ai_generation_jobs FOR INSERT
  WITH CHECK (public.user_owns_project(project_id));
CREATE POLICY "Users can update own ai_generation_jobs"
  ON public.ai_generation_jobs FOR UPDATE
  USING (public.user_owns_project(project_id));
