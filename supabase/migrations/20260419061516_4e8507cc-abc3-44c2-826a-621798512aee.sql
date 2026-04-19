ALTER TABLE public.workers DROP CONSTRAINT IF EXISTS workers_status_check;
ALTER TABLE public.workers ADD CONSTRAINT workers_status_check
  CHECK (status = ANY (ARRAY['idle'::text, 'online'::text, 'busy'::text, 'offline'::text, 'error'::text]));