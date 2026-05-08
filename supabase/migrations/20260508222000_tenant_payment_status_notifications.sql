-- Keep payment notifications honest: only completed payments are "received",
-- and tenants get clear feedback for recent Stripe attempts that never moved money.

CREATE OR REPLACE FUNCTION public.notify_on_new_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  property_record RECORD;
  tenant_name TEXT;
BEGIN
  -- Processing, incomplete, canceled, and failed Stripe attempts are not received money.
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT p.address, p.manager_id
  INTO property_record
  FROM properties p
  WHERE p.id = NEW.property_id;

  SELECT pr.full_name INTO tenant_name
  FROM tenants t
  LEFT JOIN profiles pr ON pr.id = t.user_id
  WHERE t.id = NEW.tenant_id;

  IF property_record.manager_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      property_record.manager_id,
      'rent_received',
      'Payment Received',
      '$' || NEW.amount || ' received from ' || COALESCE(tenant_name, 'tenant') ||
      ' for ' || property_record.address,
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
$$;

WITH recent_problem_payments AS (
  SELECT
    p.id AS payment_id,
    p.tenant_id,
    t.user_id,
    p.amount,
    COALESCE(NULLIF(p.stripe_status, ''), p.status) AS tenant_payment_status,
    CASE
      WHEN p.stripe_status = 'requires_payment_method' THEN 'Payment Incomplete'
      WHEN p.status = 'processing' OR p.stripe_status = 'processing' THEN 'Payment Processing'
      WHEN p.stripe_status = 'canceled' OR p.status = 'canceled' THEN 'Payment Canceled'
      ELSE 'Payment Did Not Clear'
    END AS title,
    CASE
      WHEN p.stripe_status = 'requires_payment_method' THEN
        '$' || to_char(p.amount, 'FM999,999,990.00') || ' payment never completed in Stripe. No money moved.'
      WHEN p.status = 'processing' OR p.stripe_status = 'processing' THEN
        '$' || to_char(p.amount, 'FM999,999,990.00') || ' ACH payment is processing with Stripe. ACH usually clears in 3-5 business days.'
      WHEN p.stripe_status = 'canceled' OR p.status = 'canceled' THEN
        '$' || to_char(p.amount, 'FM999,999,990.00') || ' payment was canceled before completion.'
      ELSE
        '$' || to_char(p.amount, 'FM999,999,990.00') || ' payment did not clear in Stripe. Please retry or contact management if this looks wrong.'
    END AS message
  FROM payments p
  JOIN tenants t ON t.id = p.tenant_id
  WHERE t.user_id IS NOT NULL
    AND COALESCE(p.payment_type, '') IN ('balance', 'rent')
    AND COALESCE(p.payment_date, p.created_at::date) >= (CURRENT_DATE - INTERVAL '45 days')
    AND (
      p.status IN ('processing', 'failed', 'canceled')
      OR p.stripe_status IN ('processing', 'requires_payment_method', 'payment_failed', 'canceled')
    )
)
INSERT INTO notifications (user_id, type, title, message, metadata)
SELECT
  rpp.user_id,
  'rent_received',
  rpp.title,
  rpp.message,
  jsonb_build_object(
    'tenant_id', rpp.tenant_id,
    'payment_id', rpp.payment_id,
    'amount', rpp.amount,
    'stripe_status', rpp.tenant_payment_status,
    'tenant_payment_status', rpp.tenant_payment_status,
    'source', 'payment_status_backfill'
  )
FROM recent_problem_payments rpp
WHERE NOT EXISTS (
  SELECT 1
  FROM notifications n
  WHERE n.user_id = rpp.user_id
    AND n.type = 'rent_received'
    AND n.metadata->>'payment_id' = rpp.payment_id::text
    AND n.metadata->>'tenant_payment_status' = rpp.tenant_payment_status
);
