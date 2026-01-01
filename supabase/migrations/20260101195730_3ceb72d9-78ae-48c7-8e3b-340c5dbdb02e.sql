-- Create a secure function to list property managers for messaging
-- This avoids tenants needing direct SELECT access to user_roles
CREATE OR REPLACE FUNCTION public.list_property_managers_for_messaging()
RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'property_manager'
  ORDER BY p.created_at ASC;
$$;