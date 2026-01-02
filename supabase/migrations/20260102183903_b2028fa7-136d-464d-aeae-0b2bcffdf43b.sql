-- Create trigger function for payment notifications
CREATE OR REPLACE FUNCTION public.notify_on_new_payment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  property_record RECORD;
  tenant_name TEXT;
BEGIN
  -- Get property and manager info
  SELECT p.address, p.manager_id
  INTO property_record
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Get tenant name
  SELECT pr.full_name INTO tenant_name
  FROM tenants t
  LEFT JOIN profiles pr ON pr.id = t.user_id
  WHERE t.id = NEW.tenant_id;

  -- Create notification for property manager
  IF property_record.manager_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      property_record.manager_id,
      'rent_received',
      'Payment Received',
      '$' || NEW.amount || ' received from ' || COALESCE(tenant_name, 'tenant') || ' for ' || property_record.address,
      jsonb_build_object(
        'payment_id', NEW.id,
        'property_id', NEW.property_id,
        'tenant_id', NEW.tenant_id,
        'amount', NEW.amount,
        'payment_type', NEW.payment_type
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on payments table
CREATE TRIGGER on_new_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_payment();