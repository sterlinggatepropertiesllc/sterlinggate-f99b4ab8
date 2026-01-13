-- Drop the existing unique constraint that causes conflicts with inactive tenants
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_user_id_property_id_key;

-- Create a partial unique index that only applies to active tenants with a property assigned
-- This allows inactive tenant records to exist with the same user_id + property_id combination
CREATE UNIQUE INDEX tenants_user_id_property_id_active_key 
ON public.tenants (user_id, property_id) 
WHERE is_active = true AND property_id IS NOT NULL;