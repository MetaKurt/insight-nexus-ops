
-- ─────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS jobs_status_priority_created_idx
  ON public.jobs (status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS jobs_worker_id_idx
  ON public.jobs (worker_id) WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_logs_job_id_created_idx
  ON public.job_logs (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workers_machine_name_idx
  ON public.workers (machine_name);

-- ─────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_workers_updated_at ON public.workers;
CREATE TRIGGER set_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_findings_updated_at ON public.findings;
CREATE TRIGGER set_findings_updated_at
  BEFORE UPDATE ON public.findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- claim_next_job: atomic worker job pickup
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_next_job(
  p_worker_id uuid,
  p_job_types text[] DEFAULT NULL
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  WITH next_job AS (
    SELECT id
    FROM public.jobs
    WHERE status = 'queued'
      AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.jobs j
     SET status = 'running',
         worker_id = p_worker_id,
         started_at = now()
    FROM next_job
   WHERE j.id = next_job.id
   RETURNING j.* INTO v_job;

  RETURN v_job;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- complete_job: finalize a job
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id uuid,
  p_status text,
  p_records_created integer DEFAULT 0,
  p_errors_count integer DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  IF p_status NOT IN ('succeeded', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.jobs
     SET status = p_status,
         records_created = COALESCE(p_records_created, 0),
         errors_count = COALESCE(p_errors_count, 0),
         notes = COALESCE(p_notes, notes),
         completed_at = CASE WHEN p_status IN ('succeeded','failed') THEN now() ELSE completed_at END,
         cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END
   WHERE id = p_job_id
   RETURNING * INTO v_job;

  -- Free the worker
  UPDATE public.workers
     SET current_job_id = NULL,
         status = 'idle'
   WHERE current_job_id = p_job_id;

  RETURN v_job;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- worker_heartbeat: upsert worker row
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.worker_heartbeat(
  p_machine_name text,
  p_version text DEFAULT NULL,
  p_environment text DEFAULT 'production',
  p_status text DEFAULT 'idle',
  p_current_job_id uuid DEFAULT NULL
)
RETURNS public.workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker public.workers;
BEGIN
  INSERT INTO public.workers (machine_name, version, environment, status, current_job_id, last_heartbeat)
  VALUES (p_machine_name, p_version, p_environment, p_status, p_current_job_id, now())
  ON CONFLICT (machine_name) DO UPDATE
    SET version = EXCLUDED.version,
        environment = EXCLUDED.environment,
        status = EXCLUDED.status,
        current_job_id = EXCLUDED.current_job_id,
        last_heartbeat = now(),
        updated_at = now()
  RETURNING * INTO v_worker;

  RETURN v_worker;
END;
$$;

-- workers.machine_name needs to be unique for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workers_machine_name_key'
  ) THEN
    ALTER TABLE public.workers ADD CONSTRAINT workers_machine_name_key UNIQUE (machine_name);
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.jobs REPLICA IDENTITY FULL;
ALTER TABLE public.job_logs REPLICA IDENTITY FULL;
ALTER TABLE public.workers REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_logs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'workers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workers;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- Permissive defaults: authenticated = full, anon = read-only.
-- Worker uses service-role key which bypasses RLS entirely.
-- Tighten when auth is added.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['jobs','job_logs','workers','projects','findings','runs','contacts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_read_%1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_all_%1$s" ON public.%1$I', t);

    EXECUTE format($f$
      CREATE POLICY "anon_read_%1$s" ON public.%1$I
        FOR SELECT TO anon USING (true);
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "auth_all_%1$s" ON public.%1$I
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
    $f$, t);
  END LOOP;
END$$;

-- Allow anon + authenticated to call the RPCs (worker uses service-role anyway)
GRANT EXECUTE ON FUNCTION public.claim_next_job(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid, text, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.worker_heartbeat(text, text, text, text, uuid) TO authenticated, service_role;
