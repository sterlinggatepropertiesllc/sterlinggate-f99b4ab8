-- Make rent/balance automation reflect the actual source of truth:
-- tenant_properties rows are the active unit assignments, completed leases are
-- the fallback, and pending ACH protects tenants from premature late fees.

CREATE OR REPLACE FUNCTION public.charge_tenant_rent(
  _tenant_id uuid,
  _rent_period date DEFAULT NULL,
  _created_by uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant public.tenants;
  _period date;
  _period_end date;
  _rent_charge_id uuid;
  _adjustment_result jsonb;
  _assignment_rent_total numeric := 0;
  _completed_lease_rent_total numeric := 0;
  _rent_amount numeric := 0;
  _lease_id uuid;
  _actor_id uuid := COALESCE(auth.uid(), _created_by);
BEGIN
  IF NOT public.can_manage_tenant_rent(_tenant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to charge rent for this tenant');
  END IF;

  SELECT * INTO _tenant
  FROM public.tenants
  WHERE id = _tenant_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found or inactive');
  END IF;

  _period := COALESCE(_rent_period, date_trunc('month', CURRENT_DATE)::date);
  _period_end := (_period + INTERVAL '1 month - 1 day')::date;

  IF EXISTS (
    SELECT 1
    FROM public.rent_charges
    WHERE tenant_id = _tenant_id
      AND rent_period = _period
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent already charged for this period');
  END IF;

  SELECT COALESCE(SUM(COALESCE(tp.rent_amount, p.rent_amount, 0)), 0)
  INTO _assignment_rent_total
  FROM public.tenant_properties tp
  LEFT JOIN public.properties p ON p.id = tp.property_id
  WHERE tp.tenant_id = _tenant_id;

  IF _assignment_rent_total > 0 THEN
    _rent_amount := _assignment_rent_total;
  ELSE
    SELECT
      COALESCE(SUM(l.monthly_rent), 0),
      (ARRAY_AGG(l.id ORDER BY l.created_at DESC))[1]
    INTO _completed_lease_rent_total, _lease_id
    FROM public.leases l
    WHERE l.tenant_id = _tenant.user_id
      AND l.status = 'completed'
      AND l.start_date <= _period_end
      AND l.end_date >= _period;

    _rent_amount := CASE
      WHEN _completed_lease_rent_total > 0 THEN _completed_lease_rent_total
      WHEN _tenant.property_id IS NOT NULL THEN COALESCE(_tenant.rent_amount, 0)
      ELSE 0
    END;
  END IF;

  IF _rent_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No rent amount configured');
  END IF;

  INSERT INTO public.rent_charges (tenant_id, lease_id, rent_period, rent_amount)
  VALUES (_tenant_id, _lease_id, _period, _rent_amount)
  RETURNING id INTO _rent_charge_id;

  _adjustment_result := public.apply_balance_adjustment(
    _tenant_id,
    'charge',
    _rent_amount,
    'Monthly rent for ' || to_char(_period, 'Month YYYY'),
    _actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'rent_charge_id', _rent_charge_id,
    'amount', _rent_amount,
    'assignment_rent_total', _assignment_rent_total,
    'period', _period,
    'adjustment', _adjustment_result
  );
END;
$$;

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
  _fee_basis numeric := 0;
  _current_balance numeric := 0;
  _pending_ach numeric := 0;
  _effective_balance numeric := 0;
  _adjustment_result jsonb;
  _actor_id uuid := COALESCE(auth.uid(), _created_by);
  _grace_end_date date;
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
    l.grace_period_days,
    l.late_after_day
  INTO _config
  FROM public.leases l
  WHERE l.id = _rent_charge.lease_id
    AND l.status = 'completed';

  IF NOT FOUND THEN
    SELECT
      tp.late_fee_type,
      tp.late_fee_percentage,
      tp.late_fee_flat_amount,
      tp.late_fee_daily_amount,
      tp.late_fee_max_amount,
      tp.rent_due_day,
      tp.grace_period_days,
      NULL::integer AS late_after_day
    INTO _config
    FROM public.tenant_properties tp
    WHERE tp.tenant_id = _rent_charge.tenant_id
    ORDER BY tp.is_primary DESC, tp.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT
        'percentage'::text AS late_fee_type,
        5::numeric AS late_fee_percentage,
        0::numeric AS late_fee_flat_amount,
        0::numeric AS late_fee_daily_amount,
        NULL::numeric AS late_fee_max_amount,
        1::integer AS rent_due_day,
        5::integer AS grace_period_days,
        5::integer AS late_after_day
      INTO _config;
    END IF;
  END IF;

  _grace_end_date := _rent_charge.rent_period
    + COALESCE(
        _config.late_after_day,
        COALESCE(_config.rent_due_day, 1) + GREATEST(COALESCE(_config.grace_period_days, 5) - 1, 0)
      )
    - 1;

  _days_late := GREATEST(0, CURRENT_DATE - _grace_end_date);

  IF _days_late <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent charge is not past grace period');
  END IF;

  SELECT COALESCE(t.current_balance, 0)
  INTO _current_balance
  FROM public.tenants t
  WHERE t.id = _rent_charge.tenant_id;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO _pending_ach
  FROM public.payments p
  WHERE p.tenant_id = _rent_charge.tenant_id
    AND p.status = 'processing'
    AND p.payment_method_type = 'ach'
    AND COALESCE(p.payment_type, 'balance') IN ('balance', 'rent');

  _effective_balance := GREATEST(_current_balance - _pending_ach, 0);

  IF _effective_balance <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'pending_ach_or_credit_covers_balance',
      'error', 'Pending ACH or existing credit covers the tenant balance',
      'current_balance', _current_balance,
      'pending_ach', _pending_ach,
      'effective_balance', _effective_balance
    );
  END IF;

  _fee_basis := LEAST(_rent_charge.rent_amount, _effective_balance);

  IF _override_amount IS NOT NULL THEN
    _late_fee := _override_amount;
  ELSE
    CASE COALESCE(_config.late_fee_type, 'percentage')
      WHEN 'percentage' THEN
        _late_fee := _fee_basis * COALESCE(_config.late_fee_percentage, 5) / 100;
      WHEN 'flat' THEN
        _late_fee := COALESCE(_config.late_fee_flat_amount, 0);
      WHEN 'daily' THEN
        _late_fee := COALESCE(_config.late_fee_daily_amount, 0) * _days_late;
        IF _config.late_fee_max_amount IS NOT NULL AND _config.late_fee_max_amount > 0 THEN
          _late_fee := LEAST(_late_fee, _config.late_fee_max_amount);
        END IF;
      ELSE
        _late_fee := _fee_basis * COALESCE(_config.late_fee_percentage, 5) / 100;
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
    'fee_basis', _fee_basis,
    'current_balance', _current_balance,
    'pending_ach', _pending_ach,
    'effective_balance', _effective_balance,
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
  _skipped integer := 0;
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
      l.grace_period_days,
      l.late_after_day
    INTO _config
    FROM public.leases l
    WHERE l.id = _rent_charge.lease_id
      AND l.status = 'completed';

    IF NOT FOUND THEN
      SELECT
        tp.rent_due_day,
        tp.grace_period_days,
        NULL::integer AS late_after_day
      INTO _config
      FROM public.tenant_properties tp
      WHERE tp.tenant_id = _rent_charge.tenant_id
      ORDER BY tp.is_primary DESC, tp.created_at DESC
      LIMIT 1;

      IF NOT FOUND THEN
        SELECT
          1::integer AS rent_due_day,
          5::integer AS grace_period_days,
          5::integer AS late_after_day
        INTO _config;
      END IF;
    END IF;

    _grace_end_date := _rent_charge.rent_period
      + COALESCE(
          _config.late_after_day,
          COALESCE(_config.rent_due_day, 1) + GREATEST(COALESCE(_config.grace_period_days, 5) - 1, 0)
        )
      - 1;

    IF CURRENT_DATE > _grace_end_date THEN
      _result := public.apply_rent_late_fee(_rent_charge.id);

      IF (_result->>'success')::boolean THEN
        _processed := _processed + 1;
      ELSIF _result->>'reason' = 'pending_ach_or_credit_covers_balance' THEN
        _skipped := _skipped + 1;
      ELSE
        _errors := _errors + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', _processed,
    'skipped', _skipped,
    'errors', _errors
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.charge_tenant_rent(uuid, date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_rent_late_fee(uuid, uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_late_fees() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.charge_tenant_rent(uuid, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_rent_late_fee(uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_late_fees() TO service_role;
