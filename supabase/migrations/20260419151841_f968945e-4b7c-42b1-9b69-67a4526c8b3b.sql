ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

UPDATE public.jobs SET status = 'succeeded' WHERE status = 'completed';

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('queued','running','succeeded','failed','cancelled'));