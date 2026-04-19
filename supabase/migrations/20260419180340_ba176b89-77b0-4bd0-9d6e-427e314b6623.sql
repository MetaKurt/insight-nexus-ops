-- Replace the overly-narrow contacts_outreach_status_check constraint with
-- the full lifecycle vocabulary used by the UI and worker agents.
ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_outreach_status_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_outreach_status_check
  CHECK (outreach_status = ANY (ARRAY[
    'new'::text,
    'not_contacted'::text,
    'queued'::text,
    'review'::text,
    'ready'::text,
    'contacted'::text,
    'replied'::text,
    'bounced'::text,
    'do_not_contact'::text,
    'closed'::text
  ]));