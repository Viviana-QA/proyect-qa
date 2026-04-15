-- Add observability columns to ai_generation_jobs
ALTER TABLE public.ai_generation_jobs
  ADD COLUMN IF NOT EXISTS current_step TEXT,
  ADD COLUMN IF NOT EXISTS logs JSONB DEFAULT '[]';

-- Allow 'cancelled' status
ALTER TABLE public.ai_generation_jobs
  DROP CONSTRAINT IF EXISTS ai_generation_jobs_status_check;

ALTER TABLE public.ai_generation_jobs
  ADD CONSTRAINT ai_generation_jobs_status_check
  CHECK (status IN ('pending','processing','crawling','analyzing','generating','completed','failed','cancelled'));
