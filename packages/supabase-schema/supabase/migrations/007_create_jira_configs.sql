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
