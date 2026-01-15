-- Create hard_delete_tenant RPC function
CREATE OR REPLACE FUNCTION public.hard_delete_tenant(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _manager_id uuid;
BEGIN
  -- Get the user_id and manager_id before deleting (for authorization check)
  SELECT user_id, manager_id INTO _user_id, _manager_id 
  FROM tenants 
  WHERE id = _tenant_id;
  
  -- Verify the caller is the manager of this tenant
  IF _manager_id IS NULL OR _manager_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to delete this tenant';
  END IF;
  
  -- Delete related records in order (respecting foreign key constraints)
  DELETE FROM balance_adjustments WHERE tenant_id = _tenant_id;
  DELETE FROM rent_charges WHERE tenant_id = _tenant_id;
  DELETE FROM payments WHERE tenant_id = _tenant_id;
  DELETE FROM tenant_properties WHERE tenant_id = _tenant_id;
  
  -- Delete the tenant record
  DELETE FROM tenants WHERE id = _tenant_id;
  
  -- Revoke tenant role if no other active tenant records exist for this user
  IF _user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tenants WHERE user_id = _user_id AND is_active = true
  ) THEN
    DELETE FROM user_roles WHERE user_id = _user_id AND role = 'tenant';
  END IF;
END;
$$;