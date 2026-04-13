-- Extend projects table for wizard fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS key_flows TEXT,
  ADD COLUMN IF NOT EXISTS compliance JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS test_config JSONB,
  ADD COLUMN IF NOT EXISTS draft_status TEXT DEFAULT 'complete';
