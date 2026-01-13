-- Update the is_active_tenant_for_property function to check both legacy property_id and tenant_properties junction table
CREATE OR REPLACE FUNCTION public.is_active_tenant_for_property(_user_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Check legacy single property_id field
    SELECT 1
    FROM public.tenants t
    WHERE t.user_id = _user_id
      AND t.property_id = _property_id
      AND t.is_active = true
    
    UNION
    
    -- Check tenant_properties junction table for multi-property support
    SELECT 1
    FROM public.tenants t
    JOIN public.tenant_properties tp ON tp.tenant_id = t.id
    WHERE t.user_id = _user_id
      AND tp.property_id = _property_id
      AND t.is_active = true
  )
$$;