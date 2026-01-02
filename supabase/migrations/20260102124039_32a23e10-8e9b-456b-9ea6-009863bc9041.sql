-- Add foreign key constraints so PostgREST can resolve relationships
-- These are needed for the useLeases hook to work with joined queries

-- First, add FK for leases.property_id -> properties.id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leases_property_id_fkey' 
    AND table_name = 'leases'
  ) THEN
    ALTER TABLE public.leases 
    ADD CONSTRAINT leases_property_id_fkey 
    FOREIGN KEY (property_id) REFERENCES public.properties(id);
  END IF;
END $$;

-- Add FK for leases.tenant_id -> profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leases_tenant_id_fkey' 
    AND table_name = 'leases'
  ) THEN
    ALTER TABLE public.leases 
    ADD CONSTRAINT leases_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.profiles(id);
  END IF;
END $$;

-- Add FK for leases.manager_id -> profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leases_manager_id_fkey' 
    AND table_name = 'leases'
  ) THEN
    ALTER TABLE public.leases 
    ADD CONSTRAINT leases_manager_id_fkey 
    FOREIGN KEY (manager_id) REFERENCES public.profiles(id);
  END IF;
END $$;

-- Add FK for signatures.signer_id -> profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'signatures_signer_id_fkey' 
    AND table_name = 'signatures'
  ) THEN
    ALTER TABLE public.signatures 
    ADD CONSTRAINT signatures_signer_id_fkey 
    FOREIGN KEY (signer_id) REFERENCES public.profiles(id);
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id ON public.leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_manager_id ON public.leases(manager_id);
CREATE INDEX IF NOT EXISTS idx_leases_property_id ON public.leases(property_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signer_id ON public.signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_signatures_lease_id ON public.signatures(lease_id);