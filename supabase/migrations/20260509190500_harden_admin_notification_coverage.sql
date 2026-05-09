CREATE OR REPLACE FUNCTION public.insert_deduped_notification(
  _user_id uuid,
  _type public.notification_type,
  _title text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing_id uuid;
  _notification_id uuid;
  _dedupe_key text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  _dedupe_key := COALESCE(
    _metadata->>'dedupe_key',
    _metadata->>'payment_id',
    _metadata->>'application_id',
    _metadata->>'maintenance_id',
    _metadata->>'message_id',
    _metadata->>'lease_id',
    _metadata->>'inquiry_id'
  );

  IF _dedupe_key IS NOT NULL THEN
    SELECT id
    INTO _existing_id
    FROM public.notifications
    WHERE user_id = _user_id
      AND type = _type
      AND (
        metadata->>'dedupe_key' = _dedupe_key
        OR metadata->>'payment_id' = _dedupe_key
        OR metadata->>'application_id' = _dedupe_key
        OR metadata->>'maintenance_id' = _dedupe_key
        OR metadata->>'message_id' = _dedupe_key
        OR metadata->>'lease_id' = _dedupe_key
        OR metadata->>'inquiry_id' = _dedupe_key
      )
    ORDER BY created_at DESC
    LIMIT 1;

    IF _existing_id IS NOT NULL THEN
      RETURN _existing_id;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (_user_id, _type, _title, _message, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _notification_id;

  RETURN _notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_new_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  property_record record;
  tenant_name text;
  notification_type public.notification_type;
  notification_title text;
  notification_message text;
  normalized_status text := lower(COALESCE(NEW.stripe_status, NEW.status, ''));
BEGIN
  SELECT p.address, p.manager_id
  INTO property_record
  FROM public.properties p
  WHERE p.id = NEW.property_id;

  IF property_record.manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pr.full_name
  INTO tenant_name
  FROM public.tenants t
  LEFT JOIN public.profiles pr ON pr.id = t.user_id
  WHERE t.id = NEW.tenant_id;

  IF NEW.status = 'completed' OR normalized_status = 'succeeded' THEN
    notification_type := 'payment_received';
    notification_title := CASE WHEN COALESCE(NEW.payment_method_type, '') = 'ach' THEN 'ACH Payment Cleared' ELSE 'Payment Received' END;
    notification_message := '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' received from ' || COALESCE(tenant_name, 'tenant') || ' for ' || COALESCE(property_record.address, 'assigned property');
  ELSIF NEW.status = 'processing' OR normalized_status = 'processing' THEN
    notification_type := 'payment_processing';
    notification_title := 'ACH Payment Processing';
    notification_message := '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' ACH payment from ' || COALESCE(tenant_name, 'tenant') || ' is processing with Stripe.';
  ELSIF normalized_status IN ('requires_payment_method', 'requires_action', 'requires_confirmation', 'incomplete', 'canceled', 'cancelled') THEN
    notification_type := 'payment_incomplete';
    notification_title := 'Payment Incomplete';
    notification_message := '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' payment from ' || COALESCE(tenant_name, 'tenant') || ' never completed. No money moved.';
  ELSIF NEW.status = 'failed' OR normalized_status IN ('payment_failed', 'failed') THEN
    notification_type := 'payment_failed';
    notification_title := 'Payment Failed';
    notification_message := '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' payment from ' || COALESCE(tenant_name, 'tenant') || ' failed. Follow up is required.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_deduped_notification(
    property_record.manager_id,
    notification_type,
    notification_title,
    notification_message,
    jsonb_build_object(
      'payment_id', NEW.id,
      'property_id', NEW.property_id,
      'tenant_id', NEW.tenant_id,
      'amount', NEW.amount,
      'payment_type', NEW.payment_type,
      'payment_method_type', NEW.payment_method_type,
      'payment_status', NEW.status,
      'stripe_status', NEW.stripe_status,
      'source', 'payment_trigger'
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  property_record record;
  tenant_name text;
  tenant_user_id uuid;
  notification_type public.notification_type;
  notification_title text;
  notification_message text;
  normalized_status text := lower(COALESCE(NEW.stripe_status, NEW.status, ''));
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.stripe_status IS NOT DISTINCT FROM NEW.stripe_status THEN
    RETURN NEW;
  END IF;

  SELECT p.address, p.manager_id
  INTO property_record
  FROM public.properties p
  WHERE p.id = NEW.property_id;

  SELECT pr.full_name, t.user_id
  INTO tenant_name, tenant_user_id
  FROM public.tenants t
  LEFT JOIN public.profiles pr ON pr.id = t.user_id
  WHERE t.id = NEW.tenant_id;

  IF NEW.status = 'completed' OR normalized_status = 'succeeded' THEN
    notification_type := 'payment_received';
    notification_title := CASE WHEN OLD.status = 'processing' THEN 'ACH Payment Cleared' ELSE 'Payment Received' END;
    notification_message := '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' from ' || COALESCE(tenant_name, 'tenant') || ' cleared and the ledger was updated.';
  ELSIF NEW.status = 'processing' OR normalized_status = 'processing' THEN
    notification_type := 'payment_processing';
    notification_title := 'ACH Payment Processing';
    notification_message := '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' ACH payment from ' || COALESCE(tenant_name, 'tenant') || ' is processing with Stripe.';
  ELSIF normalized_status IN ('requires_payment_method', 'requires_action', 'requires_confirmation', 'incomplete', 'canceled', 'cancelled') THEN
    notification_type := 'payment_incomplete';
    notification_title := 'Payment Incomplete';
    notification_message := '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' payment from ' || COALESCE(tenant_name, 'tenant') || ' never completed. No money moved.';
  ELSIF NEW.status = 'failed' OR normalized_status IN ('payment_failed', 'failed') THEN
    notification_type := 'payment_failed';
    notification_title := 'Payment Failed';
    notification_message := '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' payment from ' || COALESCE(tenant_name, 'tenant') || ' failed. Follow up is required.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_deduped_notification(
    property_record.manager_id,
    notification_type,
    notification_title,
    notification_message,
    jsonb_build_object(
      'payment_id', NEW.id,
      'property_id', NEW.property_id,
      'tenant_id', NEW.tenant_id,
      'amount', NEW.amount,
      'payment_type', NEW.payment_type,
      'payment_method_type', NEW.payment_method_type,
      'payment_status', NEW.status,
      'stripe_status', NEW.stripe_status,
      'source', 'payment_status_trigger'
    )
  );

  IF tenant_user_id IS NOT NULL AND notification_type IN ('payment_received', 'payment_failed', 'payment_incomplete') THEN
    PERFORM public.insert_deduped_notification(
      tenant_user_id,
      notification_type,
      notification_title,
      CASE
        WHEN notification_type = 'payment_received' THEN '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' payment was verified by Stripe and applied to your Sterling Gate ledger.'
        WHEN notification_type = 'payment_incomplete' THEN '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' payment never completed in Stripe. No money moved.'
        ELSE '$' || to_char(COALESCE(NEW.amount, 0), 'FM999,999,990.00') || ' payment did not clear in Stripe. Please retry or contact management.'
      END,
      jsonb_build_object(
        'payment_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'amount', NEW.amount,
        'tenant_payment_status', COALESCE(NEW.stripe_status, NEW.status),
        'stripe_status', NEW.stripe_status,
        'source', 'payment_status_trigger'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_new_maintenance_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  property_address text;
BEGIN
  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT address INTO property_address
  FROM public.properties
  WHERE id = NEW.property_id;

  PERFORM public.insert_deduped_notification(
    NEW.manager_id,
    'maintenance_request',
    CASE
      WHEN lower(COALESCE(NEW.status, '')) IN ('urgent', 'emergency') THEN 'Urgent Maintenance Request'
      ELSE 'Maintenance Request'
    END,
    COALESCE(NEW.title, 'Maintenance item') || ' for ' || COALESCE(property_address, 'assigned property'),
    jsonb_build_object(
      'maintenance_id', NEW.id,
      'property_id', NEW.property_id,
      'status', NEW.status,
      'category', NEW.category,
      'source', 'maintenance_trigger'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_maintenance_record ON public.maintenance_records;
CREATE TRIGGER on_new_maintenance_record
AFTER INSERT ON public.maintenance_records
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_maintenance_record();

CREATE OR REPLACE FUNCTION public.apply_rent_late_fee(
  _rent_charge_id uuid,
  _created_by uuid DEFAULT NULL,
  _override_amount numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rent_charge public.rent_charges;
  _config record;
  _tenant public.tenants;
  _tenant_name text;
  _days_late integer;
  _late_fee numeric := 0;
  _adjustment_result jsonb;
  _actor_id uuid := COALESCE(auth.uid(), _created_by);
BEGIN
  SELECT * INTO _rent_charge
  FROM public.rent_charges
  WHERE id = _rent_charge_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent charge not found');
  END IF;

  IF NOT public.can_manage_tenant_rent(_rent_charge.tenant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to apply late fee for this tenant');
  END IF;

  IF _rent_charge.late_fee_applied THEN
    RETURN jsonb_build_object('success', false, 'error', 'Late fee already applied');
  END IF;

  IF _rent_charge.late_fee_waived THEN
    RETURN jsonb_build_object('success', false, 'error', 'Late fee was waived');
  END IF;

  SELECT * INTO _tenant
  FROM public.tenants
  WHERE id = _rent_charge.tenant_id;

  SELECT
    l.late_fee_type,
    l.late_fee_percentage,
    l.late_fee_flat_amount,
    l.late_fee_daily_amount,
    l.late_fee_max_amount,
    l.rent_due_day,
    l.grace_period_days
  INTO _config
  FROM public.leases l
  WHERE l.id = _rent_charge.lease_id;

  IF NOT FOUND THEN
    SELECT
      tp.late_fee_type,
      tp.late_fee_percentage,
      tp.late_fee_flat_amount,
      tp.late_fee_daily_amount,
      tp.late_fee_max_amount,
      tp.rent_due_day,
      tp.grace_period_days
    INTO _config
    FROM public.tenant_properties tp
    WHERE tp.tenant_id = _rent_charge.tenant_id
    ORDER BY tp.is_primary DESC, tp.created_at DESC
    LIMIT 1;
  END IF;

  _days_late := GREATEST(
    0,
    CURRENT_DATE - (
      _rent_charge.rent_period
      + COALESCE(_config.rent_due_day, 1)
      - 1
      + COALESCE(_config.grace_period_days, 5)
    )
  );

  IF _days_late <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent charge is not past grace period');
  END IF;

  IF _override_amount IS NOT NULL THEN
    _late_fee := _override_amount;
  ELSE
    CASE COALESCE(_config.late_fee_type, 'percentage')
      WHEN 'percentage' THEN
        _late_fee := _rent_charge.rent_amount * COALESCE(_config.late_fee_percentage, 5) / 100;
      WHEN 'flat' THEN
        _late_fee := COALESCE(_config.late_fee_flat_amount, 0);
      WHEN 'daily' THEN
        _late_fee := COALESCE(_config.late_fee_daily_amount, 0) * _days_late;
        IF _config.late_fee_max_amount IS NOT NULL AND _config.late_fee_max_amount > 0 THEN
          _late_fee := LEAST(_late_fee, _config.late_fee_max_amount);
        END IF;
      ELSE
        _late_fee := _rent_charge.rent_amount * COALESCE(_config.late_fee_percentage, 5) / 100;
    END CASE;
  END IF;

  IF _late_fee <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Late fee amount is zero');
  END IF;

  UPDATE public.rent_charges
  SET late_fee_applied = true,
      late_fee_amount = _late_fee,
      late_fee_applied_at = now(),
      updated_at = now()
  WHERE id = _rent_charge_id;

  _adjustment_result := public.apply_balance_adjustment(
    _rent_charge.tenant_id,
    'late_fee',
    _late_fee,
    'Late fee for ' || to_char(_rent_charge.rent_period, 'Month YYYY') || ' rent (' || _days_late || ' days late)',
    _actor_id
  );

  SELECT full_name INTO _tenant_name
  FROM public.profiles
  WHERE id = _tenant.user_id;

  PERFORM public.insert_deduped_notification(
    _tenant.manager_id,
    'payment_late',
    'Payment Not Received',
    COALESCE(_tenant_name, 'Tenant') || ' is late for ' || to_char(_rent_charge.rent_period, 'Month YYYY') || '. A $' || to_char(_late_fee, 'FM999,999,990.00') || ' late fee was applied.',
    jsonb_build_object(
      'rent_charge_id', _rent_charge.id,
      'tenant_id', _rent_charge.tenant_id,
      'late_fee', _late_fee,
      'days_late', _days_late,
      'source', 'late_fee_trigger',
      'dedupe_key', _rent_charge.id || ':late_fee'
    )
  );

  IF _tenant.user_id IS NOT NULL THEN
    PERFORM public.insert_deduped_notification(
      _tenant.user_id,
      'payment_late',
      'Late Fee Applied',
      'Your rent is past the grace period. A $' || to_char(_late_fee, 'FM999,999,990.00') || ' late fee was applied.',
      jsonb_build_object(
        'rent_charge_id', _rent_charge.id,
        'tenant_id', _rent_charge.tenant_id,
        'late_fee', _late_fee,
        'days_late', _days_late,
        'source', 'late_fee_trigger',
        'dedupe_key', _rent_charge.id || ':tenant_late_fee'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'late_fee', _late_fee,
    'days_late', _days_late,
    'adjustment', _adjustment_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_deduped_notification(uuid, public.notification_type, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_rent_late_fee(uuid, uuid, numeric) TO authenticated, service_role;
