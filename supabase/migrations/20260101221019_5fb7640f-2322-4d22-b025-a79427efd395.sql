-- Add created_by column to track who added the tenant
ALTER TABLE public.tenants 
ADD COLUMN created_by UUID REFERENCES public.profiles(id);

-- Make property_id nullable
ALTER TABLE public.tenants 
ALTER COLUMN property_id DROP NOT NULL;

-- Make rent_amount nullable with default 0
ALTER TABLE public.tenants 
ALTER COLUMN rent_amount DROP NOT NULL,
ALTER COLUMN rent_amount SET DEFAULT 0;

-- Drop existing RLS policies that need updating
DROP POLICY IF EXISTS "Property managers can manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Property managers can view tenants for their properties" ON public.tenants;

-- Create new policy that handles both assigned and unassigned tenants
CREATE POLICY "Property managers can manage their tenants" 
ON public.tenants FOR ALL
USING (
  -- Tenants linked to manager's properties
  (property_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = tenants.property_id 
    AND properties.manager_id = auth.uid()
  ))
  OR
  -- Tenants created by this manager (not yet assigned to property)
  (created_by = auth.uid())
)
WITH CHECK (
  (property_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = tenants.property_id 
    AND properties.manager_id = auth.uid()
  ))
  OR
  (created_by = auth.uid())
);