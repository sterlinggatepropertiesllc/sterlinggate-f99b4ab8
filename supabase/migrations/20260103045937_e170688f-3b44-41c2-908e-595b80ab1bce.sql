-- Fix FK: applications.applicant_id should reference profiles, not auth.users
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_applicant_id_fkey;
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_reviewed_by_fkey;

-- Recreate FKs to reference public.profiles
ALTER TABLE public.applications
  ADD CONSTRAINT applications_applicant_id_fkey
  FOREIGN KEY (applicant_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';