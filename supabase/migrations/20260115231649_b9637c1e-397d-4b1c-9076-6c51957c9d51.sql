-- Update the notify_on_new_payment function to handle ACH payments differently
CREATE OR REPLACE FUNCTION public.notify_on_new_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  property_record RECORD;
  tenant_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
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

  -- Determine notification title and message based on status
  IF NEW.status = 'processing' THEN
    -- ACH payment initiated
    notification_title := 'ACH Payment Initiated';
    notification_message := '$' || NEW.amount || ' ACH payment from ' || 
      COALESCE(tenant_name, 'tenant') || ' for ' || property_record.address || 
      ' (processing - typically clears in 3-5 business days)';
  ELSE
    -- Completed payment (card or other)
    notification_title := 'Payment Received';
    notification_message := '$' || NEW.amount || ' received from ' || 
      COALESCE(tenant_name, 'tenant') || ' for ' || property_record.address;
  END IF;

  -- Create notification for property manager
  IF property_record.manager_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      property_record.manager_id,
      'rent_received',
      notification_title,
      notification_message,
      jsonb_build_object(
        'payment_id', NEW.id,
        'property_id', NEW.property_id,
        'tenant_id', NEW.tenant_id,
        'amount', NEW.amount,
        'payment_type', NEW.payment_type,
        'payment_status', NEW.status,
        'is_ach', NEW.status = 'processing'
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;