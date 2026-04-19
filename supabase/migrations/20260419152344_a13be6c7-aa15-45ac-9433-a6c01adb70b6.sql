-- Remove all anon-role policies; require login for everything.
DROP POLICY IF EXISTS anon_read_jobs ON public.jobs;
DROP POLICY IF EXISTS anon_insert_jobs ON public.jobs;
DROP POLICY IF EXISTS anon_read_job_logs ON public.job_logs;
DROP POLICY IF EXISTS anon_read_workers ON public.workers;
DROP POLICY IF EXISTS anon_read_projects ON public.projects;
DROP POLICY IF EXISTS anon_read_runs ON public.runs;
DROP POLICY IF EXISTS anon_read_findings ON public.findings;
DROP POLICY IF EXISTS anon_read_contacts ON public.contacts;