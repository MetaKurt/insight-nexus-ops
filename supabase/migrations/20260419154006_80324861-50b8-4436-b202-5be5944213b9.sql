-- Phase A: Missions + Stages foundation

CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft', -- draft | active | paused | completed | archived
  project_id uuid,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mission_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  name text NOT NULL,
  description text,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  depends_on_stage_id uuid REFERENCES public.mission_stages(id) ON DELETE SET NULL,
  requires_review boolean NOT NULL DEFAULT true,
  -- pending | queued | running | awaiting_review | approved | done | failed | skipped
  status text NOT NULL DEFAULT 'pending',
  job_id uuid,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, order_index)
);

CREATE INDEX idx_mission_stages_mission ON public.mission_stages(mission_id, order_index);
CREATE INDEX idx_mission_stages_job ON public.mission_stages(job_id);
CREATE INDEX idx_mission_stages_status ON public.mission_stages(status);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_all_missions ON public.missions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_all_mission_stages ON public.mission_stages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_missions_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_mission_stages_updated_at
  BEFORE UPDATE ON public.mission_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Queue a stage: create a job row and link it.
CREATE OR REPLACE FUNCTION public.queue_mission_stage(p_stage_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage public.mission_stages;
  v_mission public.missions;
  v_job public.jobs;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_stage FROM public.mission_stages WHERE id = p_stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stage not found: %', p_stage_id; END IF;

  IF v_stage.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Stage % cannot be queued from status %', p_stage_id, v_stage.status;
  END IF;

  SELECT * INTO v_mission FROM public.missions WHERE id = v_stage.mission_id;

  -- Inject mission/stage context into payload so the worker knows where to write back.
  v_payload := v_stage.payload || jsonb_build_object(
    'mission_id', v_stage.mission_id,
    'mission_stage_id', v_stage.id,
    'depends_on_stage_id', v_stage.depends_on_stage_id
  );

  INSERT INTO public.jobs (job_type, status, payload, project_id, requested_by, notes)
  VALUES (
    v_stage.job_type,
    'queued',
    v_payload,
    v_mission.project_id,
    'mission:' || v_mission.id::text,
    'Mission stage: ' || v_stage.name
  )
  RETURNING * INTO v_job;

  UPDATE public.mission_stages
     SET status = 'queued', job_id = v_job.id
   WHERE id = p_stage_id;

  -- Activate mission on first stage queue
  UPDATE public.missions SET status = 'active'
   WHERE id = v_stage.mission_id AND status = 'draft';

  RETURN v_job;
END;
$$;

-- Approve a stage and auto-queue any downstream stages whose dependency is satisfied.
CREATE OR REPLACE FUNCTION public.approve_mission_stage(p_stage_id uuid, p_approver text DEFAULT NULL)
RETURNS SETOF public.mission_stages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage public.mission_stages;
  v_next public.mission_stages;
BEGIN
  SELECT * INTO v_stage FROM public.mission_stages WHERE id = p_stage_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stage not found: %', p_stage_id; END IF;

  IF v_stage.status NOT IN ('awaiting_review', 'done') THEN
    RAISE EXCEPTION 'Stage % cannot be approved from status %', p_stage_id, v_stage.status;
  END IF;

  UPDATE public.mission_stages
     SET status = 'done',
         approved_by = COALESCE(p_approver, approved_by),
         approved_at = now()
   WHERE id = p_stage_id
   RETURNING * INTO v_stage;

  -- Auto-queue any pending downstream stages that depend on this one.
  FOR v_next IN
    SELECT * FROM public.mission_stages
     WHERE mission_id = v_stage.mission_id
       AND depends_on_stage_id = v_stage.id
       AND status = 'pending'
  LOOP
    PERFORM public.queue_mission_stage(v_next.id);
  END LOOP;

  -- If no remaining open stages, mark mission completed.
  IF NOT EXISTS (
    SELECT 1 FROM public.mission_stages
     WHERE mission_id = v_stage.mission_id
       AND status NOT IN ('done', 'skipped')
  ) THEN
    UPDATE public.missions SET status = 'completed' WHERE id = v_stage.mission_id;
  END IF;

  RETURN QUERY SELECT * FROM public.mission_stages WHERE mission_id = v_stage.mission_id ORDER BY order_index;
END;
$$;

-- Trigger: when a job linked to a mission stage completes, advance the stage.
CREATE OR REPLACE FUNCTION public.handle_job_completion_for_mission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage public.mission_stages;
BEGIN
  -- Only react when status transitions into a terminal state.
  IF NEW.status NOT IN ('succeeded', 'failed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_stage FROM public.mission_stages WHERE job_id = NEW.id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.status = 'succeeded' THEN
    IF v_stage.requires_review THEN
      UPDATE public.mission_stages SET status = 'awaiting_review' WHERE id = v_stage.id;
    ELSE
      -- Auto-approve and cascade.
      UPDATE public.mission_stages
         SET status = 'awaiting_review'
       WHERE id = v_stage.id;
      PERFORM public.approve_mission_stage(v_stage.id, 'system:auto');
    END IF;
  ELSIF NEW.status = 'failed' THEN
    UPDATE public.mission_stages SET status = 'failed' WHERE id = v_stage.id;
    UPDATE public.missions SET status = 'paused' WHERE id = v_stage.mission_id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.mission_stages SET status = 'skipped' WHERE id = v_stage.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_mission_advance
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_job_completion_for_mission();