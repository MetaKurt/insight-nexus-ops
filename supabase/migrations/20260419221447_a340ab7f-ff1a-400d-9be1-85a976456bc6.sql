UPDATE public.contacts c
   SET organization = f.title
  FROM public.findings f
 WHERE c.finding_id = f.id
   AND c.organization IS NULL
   AND f.title IS NOT NULL;