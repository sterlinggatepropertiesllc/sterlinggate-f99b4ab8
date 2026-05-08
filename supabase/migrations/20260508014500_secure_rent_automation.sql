-- Lock down rent automation and manager-triggered rent RPCs.
--
-- These functions are SECURITY DEFINER because they need to update ledgers
-- atomically, so they must perform their own authorization checks instead of
-- relying on table RLS alone.

CREATE OR REPLACE FUNCTION public.can_manage_tenant_rent(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(auth.role(), '') = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND public.has_role(auth.uid(), 'property_manager'::public.app_role)
      AND (
        EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = _tenant_id
            AND t.manager_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenants t
          JOIN public.properties p ON p.id = t.property_id
          WHERE t.id = _tenant_id
            AND p.manager_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.tenant_properties tp
          JOIN public.properties p ON p.id = tp.property_id
          WHERE tp.tenant_id = _tenant_id
            AND p.manager_id = auth.uid()
        )
      )
    );
$$;

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
  _lease public.leases;
  _period date;
  _rent_charge_id uuid;
  _adjustment_result jsonb;
  _rent_amount numeric;
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

  IF EXISTS (
    SELECT 1
    FROM public.rent_charges
    WHERE tenant_id = _tenant_id
      AND rent_period = _period
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent already charged for this period');
  END IF;

  SELECT * INTO _lease
  FROM public.leases
  WHERE tenant_id = _tenant.user_id
    AND status IN ('completed', 'pending_manager_signature', 'pending_tenant_signature')
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  _rent_amount := COALESCE(_lease.monthly_rent, _tenant.rent_amount, 0);

  IF _rent_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No rent amount configured');
  END IF;

  INSERT INTO public.rent_charges (tenant_id, lease_id, rent_period, rent_amount)
  VALUES (_tenant_id, _lease.id, _period, _rent_amount)
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
  _lease public.leases;
  _days_late integer;
  _late_fee numeric;
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

  SELECT * INTO _lease
  FROM public.leases
  WHERE id = _rent_charge.lease_id;

  _days_late := GREATEST(
    0,
    CURRENT_DATE - (
      _rent_charge.rent_period
      + COALESCE(_lease.rent_due_day, 1)
      - 1
      + COALESCE(_lease.grace_period_days, 5)
    )
  );

  IF _override_amount IS NOT NULL THEN
    _late_fee := _override_amount;
  ELSE
    _late_fee := public.calculate_late_fee(_rent_charge.lease_id, _rent_charge.rent_amount, _days_late);
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

CREATE OR REPLACE FUNCTION public.waive_rent_late_fee(
  _rent_charge_id uuid,
  _waived_by uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rent_charge public.rent_charges;
  _actor_id uuid := COALESCE(auth.uid(), _waived_by);
BEGIN
  SELECT * INTO _rent_charge
  FROM public.rent_charges
  WHERE id = _rent_charge_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent charge not found');
  END IF;

  IF NOT public.can_manage_tenant_rent(_rent_charge.tenant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to waive late fee for this tenant');
  END IF;

  UPDATE public.rent_charges
  SET late_fee_waived = true,
      late_fee_waived_at = now(),
      late_fee_waived_by = _actor_id,
      updated_at = now()
  WHERE id = _rent_charge_id
    AND late_fee_applied = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent charge not found or late fee already applied');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_monthly_rent()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant public.tenants;
  _result jsonb;
  _processed integer := 0;
  _errors integer := 0;
  _current_period date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Service role required');
  END IF;

  FOR _tenant IN
    SELECT t.*
    FROM public.tenants t
    WHERE t.is_active = true
      AND t.auto_charge_rent = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.rent_charges rc
        WHERE rc.tenant_id = t.id
          AND rc.rent_period = _current_period
      )
  LOOP
    _result := public.charge_tenant_rent(_tenant.id, _current_period);

    IF (_result->>'success')::boolean THEN
      _processed := _processed + 1;
    ELSE
      _errors := _errors + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', _processed,
    'errors', _errors,
    'period', _current_period
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
  _lease public.leases;
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
    SELECT * INTO _lease
    FROM public.leases
    WHERE id = _rent_charge.lease_id;

    _due_date := _rent_charge.rent_period + COALESCE(_lease.rent_due_day, 1) - 1;
    _grace_end_date := _due_date + COALESCE(_lease.grace_period_days, 5);

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

REVOKE EXECUTE ON FUNCTION public.can_manage_tenant_rent(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.charge_tenant_rent(uuid, date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_rent_late_fee(uuid, uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.waive_rent_late_fee(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_monthly_rent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_late_fees() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_manage_tenant_rent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.charge_tenant_rent(uuid, date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_rent_late_fee(uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.waive_rent_late_fee(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_monthly_rent() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_late_fees() TO service_role;
