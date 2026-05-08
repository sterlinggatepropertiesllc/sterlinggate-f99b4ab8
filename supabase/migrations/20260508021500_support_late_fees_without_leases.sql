-- Let late-fee automation work for rent charges that were created from a
-- tenant/property assignment instead of a formal lease record.

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

  RETURN jsonb_build_object(
    'success', true,
    'late_fee', _late_fee,
    'days_late', _days_late,
    'adjustment', _adjustment_result
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_late_fees()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rent_charge public.rent_charges;
  _config record;
  _result jsonb;
  _processed integer := 0;
  _errors integer := 0;
  _due_date date;
  _grace_end_date date;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Service role required');
  END IF;

  FOR _rent_charge IN
    SELECT rc.*
    FROM public.rent_charges rc
    JOIN public.tenants t ON t.id = rc.tenant_id
    WHERE rc.status = 'pending'
      AND rc.late_fee_applied = false
      AND rc.late_fee_waived = false
      AND t.auto_apply_late_fees = true
      AND t.is_active = true
  LOOP
    SELECT
      l.rent_due_day,
      l.grace_period_days
    INTO _config
    FROM public.leases l
    WHERE l.id = _rent_charge.lease_id;

    IF NOT FOUND THEN
      SELECT
        tp.rent_due_day,
        tp.grace_period_days
      INTO _config
      FROM public.tenant_properties tp
      WHERE tp.tenant_id = _rent_charge.tenant_id
      ORDER BY tp.is_primary DESC, tp.created_at DESC
      LIMIT 1;
    END IF;

    _due_date := _rent_charge.rent_period + COALESCE(_config.rent_due_day, 1) - 1;
    _grace_end_date := _due_date + COALESCE(_config.grace_period_days, 5);

    IF CURRENT_DATE > _grace_end_date THEN
      _result := public.apply_rent_late_fee(_rent_charge.id);

      IF (_result->>'success')::boolean THEN
        _processed := _processed + 1;
      ELSE
        _errors := _errors + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', _processed,
    'errors', _errors
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_rent_late_fee(uuid, uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_late_fees() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_rent_late_fee(uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_late_fees() TO service_role;
