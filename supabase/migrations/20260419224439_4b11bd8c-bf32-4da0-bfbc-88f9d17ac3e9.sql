ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS twitter_url text,
  ADD COLUMN IF NOT EXISTS email_verification_status text,
  ADD COLUMN IF NOT EXISTS email_score integer,
  ADD COLUMN IF NOT EXISTS enrichment_sources jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_provider text;

CREATE INDEX IF NOT EXISTS contacts_enriched_at_idx ON public.contacts(enriched_at);
CREATE INDEX IF NOT EXISTS contacts_email_null_idx ON public.contacts(project_id) WHERE email IS NULL;