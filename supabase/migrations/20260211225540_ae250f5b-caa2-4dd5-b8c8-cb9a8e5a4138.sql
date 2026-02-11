
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create helper function to queue telegram notifications via edge function
CREATE OR REPLACE FUNCTION public.queue_telegram_notification(
  _topic_key text,
  _user_id uuid,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _idempotency_source text DEFAULT NULL,
  _entity_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_role_key text;
  _request_body jsonb;
BEGIN
  -- Get config from environment (stored in vault or hardcoded for edge function URL)
  _supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- If not set via app settings, use a direct approach: insert into deliveries as queued
  -- The edge function will be called via pg_net
  _request_body := jsonb_build_object(
    'topic_key', _topic_key,
    'user_id', _user_id,
    'message', _message,
    'metadata', _metadata,
    'idempotency_source', _idempotency_source,
    'entity_id', _entity_id
  );

  -- Use pg_net to call the edge function asynchronously
  PERFORM extensions.http_post(
    url := 'https://nmibwtbrbpqfvseeflep.supabase.co/functions/v1/send-telegram-notification',
    body := _request_body::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    )::jsonb
  );

EXCEPTION WHEN OTHERS THEN
  -- Never let notification failures break the original trigger
  RAISE WARNING 'Telegram notification queue failed: %', SQLERRM;
END;
$$;

-- Update notify_on_new_payment to also send Telegram notifications
CREATE OR REPLACE FUNCTION public.notify_on_new_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  property_record RECORD;
  tenant_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
  _tenant_user_id UUID;
BEGIN
  -- Get property and manager info
  SELECT p.address, p.manager_id
  INTO property_record
  FROM properties p
  WHERE p.id = NEW.property_id;

  -- Get tenant name and user_id
  SELECT pr.full_name, t.user_id INTO tenant_name, _tenant_user_id
  FROM tenants t
  LEFT JOIN profiles pr ON pr.id = t.user_id
  WHERE t.id = NEW.tenant_id;

  -- Determine notification title and message based on status
  IF NEW.status = 'processing' THEN
    notification_title := 'ACH Payment Initiated';
    notification_message := '$' || NEW.amount || ' ACH payment from ' || 
      COALESCE(tenant_name, 'tenant') || ' for ' || property_record.address || 
      ' (processing - typically clears in 3-5 business days)';
  ELSE
    notification_title := 'Payment Received';
    notification_message := '$' || NEW.amount || ' received from ' || 
      COALESCE(tenant_name, 'tenant') || ' for ' || property_record.address;
  END IF;

  -- Create in-app notification for property manager
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

    -- Telegram: notify admin
    IF NEW.status = 'processing' THEN
      PERFORM queue_telegram_notification(
        'ACH_INITIATED',
        property_record.manager_id,
        '🏦 <b>ACH Payment Initiated</b>' || chr(10) ||
        'Tenant: ' || COALESCE(tenant_name, 'Unknown') || chr(10) ||
        'Property: ' || property_record.address || chr(10) ||
        'Amount: $' || NEW.amount || chr(10) ||
        'Status: Processing (3-5 business days)',
        jsonb_build_object('payment_id', NEW.id),
        'payment', NEW.id::text
      );
    ELSE
      PERFORM queue_telegram_notification(
        'RENT_RECEIVED',
        property_record.manager_id,
        '✅ <b>Rent Payment Received</b>' || chr(10) ||
        'Tenant: ' || COALESCE(tenant_name, 'Unknown') || chr(10) ||
        'Property: ' || property_record.address || chr(10) ||
        'Amount: $' || NEW.amount || chr(10) ||
        'Method: ' || COALESCE(NEW.payment_method, 'N/A'),
        jsonb_build_object('payment_id', NEW.id),
        'payment', NEW.id::text
      );
    END IF;
  END IF;

  -- Telegram: notify tenant of payment confirmation
  IF _tenant_user_id IS NOT NULL AND NEW.status = 'completed' THEN
    PERFORM queue_telegram_notification(
      'PAYMENT_RECEIVED_CONFIRMATION',
      _tenant_user_id,
      '✅ <b>Payment Confirmed</b>' || chr(10) ||
      'Your payment of $' || NEW.amount || ' has been received.' || chr(10) ||
      'Property: ' || property_record.address || chr(10) ||
      'Thank you!',
      jsonb_build_object('payment_id', NEW.id),
      'payment_confirm', NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update notify_on_payment_status_change to also send Telegram
CREATE OR REPLACE FUNCTION public.notify_on_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  property_record RECORD;
  tenant_name TEXT;
  _tenant_user_id UUID;
BEGIN
  IF OLD.status = 'processing' AND NEW.status = 'completed' THEN
    SELECT p.address, p.manager_id INTO property_record
    FROM properties p WHERE p.id = NEW.property_id;

    SELECT pr.full_name, t.user_id INTO tenant_name, _tenant_user_id
    FROM tenants t
    LEFT JOIN profiles pr ON pr.id = t.user_id
    WHERE t.id = NEW.tenant_id;

    IF property_record.manager_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (
        property_record.manager_id,
        'rent_received',
        'ACH Payment Cleared',
        '$' || NEW.amount || ' from ' || COALESCE(tenant_name, 'tenant') || 
        ' for ' || property_record.address || ' has cleared',
        jsonb_build_object(
          'payment_id', NEW.id,
          'property_id', NEW.property_id,
          'tenant_id', NEW.tenant_id,
          'amount', NEW.amount,
          'payment_type', NEW.payment_type,
          'payment_method', 'ach'
        )
      );

      -- Telegram: ACH cleared
      PERFORM queue_telegram_notification(
        'ACH_CLEARED',
        property_record.manager_id,
        '✅ <b>ACH Payment Cleared</b>' || chr(10) ||
        'Tenant: ' || COALESCE(tenant_name, 'Unknown') || chr(10) ||
        'Property: ' || property_record.address || chr(10) ||
        'Amount: $' || NEW.amount,
        jsonb_build_object('payment_id', NEW.id),
        'ach_cleared', NEW.id::text
      );
    END IF;

    -- Telegram: notify tenant
    IF _tenant_user_id IS NOT NULL THEN
      PERFORM queue_telegram_notification(
        'PAYMENT_RECEIVED_CONFIRMATION',
        _tenant_user_id,
        '✅ <b>Payment Confirmed</b>' || chr(10) ||
        'Your ACH payment of $' || NEW.amount || ' has cleared.' || chr(10) ||
        'Property: ' || property_record.address,
        jsonb_build_object('payment_id', NEW.id),
        'ach_confirm', NEW.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Update notify_on_new_application
CREATE OR REPLACE FUNCTION public.notify_on_new_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  property_record RECORD;
BEGIN
  SELECT p.*, pr.full_name as applicant_name
  INTO property_record
  FROM properties p
  LEFT JOIN profiles pr ON pr.id = NEW.applicant_id
  WHERE p.id = NEW.property_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    property_record.manager_id,
    'application_received',
    'New Application Received',
    COALESCE(property_record.applicant_name, 'Someone') || ' applied for ' || property_record.address,
    jsonb_build_object('application_id', NEW.id, 'property_id', NEW.property_id)
  );

  -- Telegram: new application
  PERFORM queue_telegram_notification(
    'NEW_APPLICATION_RECEIVED',
    property_record.manager_id,
    '📋 <b>New Application</b>' || chr(10) ||
    'Applicant: ' || COALESCE(property_record.applicant_name, 'Unknown') || chr(10) ||
    'Property: ' || property_record.address,
    jsonb_build_object('application_id', NEW.id),
    'application', NEW.id::text
  );

  RETURN NEW;
END;
$$;

-- Update notify_on_lease_signed
CREATE OR REPLACE FUNCTION public.notify_on_lease_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lease_record RECORD;
  tenant_name TEXT;
BEGIN
  IF OLD.status = NEW.status OR NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT l.*, p.address INTO lease_record
  FROM leases l JOIN properties p ON p.id = l.property_id
  WHERE l.id = NEW.id;

  SELECT full_name INTO tenant_name FROM profiles WHERE id = NEW.tenant_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.manager_id,
    'lease_signed',
    'Lease Signed',
    COALESCE(tenant_name, 'Tenant') || ' signed the lease for ' || lease_record.address,
    jsonb_build_object('lease_id', NEW.id, 'property_id', NEW.property_id)
  );

  -- Telegram: lease signed
  PERFORM queue_telegram_notification(
    'LEASE_SIGNED',
    NEW.manager_id,
    '📝 <b>Lease Signed</b>' || chr(10) ||
    'Tenant: ' || COALESCE(tenant_name, 'Unknown') || chr(10) ||
    'Property: ' || lease_record.address,
    jsonb_build_object('lease_id', NEW.id),
    'lease_signed', NEW.id::text
  );

  RETURN NEW;
END;
$$;

-- Update notify_on_new_message to also send Telegram for manager messages to tenants
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sender_name TEXT;
  _sender_role TEXT;
BEGIN
  SELECT full_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.recipient_id,
    'message_received',
    'New Message',
    COALESCE(sender_name, 'Someone') || ': ' || LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END,
    jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id)
  );

  -- Check if sender is property_manager to send MESSAGE_FROM_MANAGER to tenant
  SELECT role INTO _sender_role FROM user_roles WHERE user_id = NEW.sender_id LIMIT 1;
  
  IF _sender_role = 'property_manager' THEN
    PERFORM queue_telegram_notification(
      'MESSAGE_FROM_MANAGER',
      NEW.recipient_id,
      '💬 <b>Message from ' || COALESCE(sender_name, 'Property Manager') || '</b>' || chr(10) ||
      LEFT(NEW.content, 200),
      jsonb_build_object('message_id', NEW.id),
      'message', NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;
