-- Create a security definer function to check if user is an active tenant for a property
CREATE OR REPLACE FUNCTION public.is_active_tenant_for_property(_user_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE user_id = _user_id
      AND property_id = _property_id
      AND is_active = true
  )
$$;

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Tenants can view their assigned properties" ON public.properties;

-- Recreate it using the security definer function
CREATE POLICY "Tenants can view their assigned properties"
ON public.properties
FOR SELECT
USING (public.is_active_tenant_for_property(auth.uid(), id));