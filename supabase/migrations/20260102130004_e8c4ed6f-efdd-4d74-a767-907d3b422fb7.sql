-- Fix the notify_on_lease_signed trigger to use 'completed' instead of 'signed'
CREATE OR REPLACE FUNCTION public.notify_on_lease_signed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  lease_record RECORD;
  tenant_name TEXT;
BEGIN
  -- Only trigger when status changes to completed (both parties signed)
  IF OLD.status = NEW.status OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get lease and property info
  SELECT l.*, p.address
  INTO lease_record
  FROM leases l
  JOIN properties p ON p.id = l.property_id
  WHERE l.id = NEW.id;

  -- Get tenant name
  SELECT full_name INTO tenant_name FROM profiles WHERE id = NEW.tenant_id;

  -- Notify manager
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.manager_id,
    'lease_signed',
    'Lease Signed',
    COALESCE(tenant_name, 'Tenant') || ' signed the lease for ' || lease_record.address,
    jsonb_build_object('lease_id', NEW.id, 'property_id', NEW.property_id)
  );

  RETURN NEW;
END;
$function$;

-- Now fix the stuck lease
UPDATE public.leases 
SET status = 'pending_manager_signature', updated_at = now()
WHERE id = '984aaa7e-0f1d-4b14-9981-3f8e6bee4772' 
  AND status = 'pending_tenant_signature';