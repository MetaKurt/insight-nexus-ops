ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS photo_url text;