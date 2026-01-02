-- Drop existing FK constraints that point to auth.users
ALTER TABLE public.leases DROP CONSTRAINT IF EXISTS leases_tenant_id_fkey;
ALTER TABLE public.leases DROP CONSTRAINT IF EXISTS leases_manager_id_fkey;
ALTER TABLE public.signatures DROP CONSTRAINT IF EXISTS signatures_signer_id_fkey;

-- Recreate FK constraints pointing to profiles (which PostgREST can resolve)
ALTER TABLE public.leases 
ADD CONSTRAINT leases_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.leases 
ADD CONSTRAINT leases_manager_id_fkey 
FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.signatures 
ADD CONSTRAINT signatures_signer_id_fkey 
FOREIGN KEY (signer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON public.leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_manager_id ON public.leases(manager_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signer_id ON public.signatures(signer_id);