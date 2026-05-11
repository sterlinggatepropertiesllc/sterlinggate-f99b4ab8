-- Legacy tenants.property_id / rent_amount is not reliable enough to bill from.
-- The billing source of truth is now:
-- 1) tenant_properties assignment rows, summed for multi-unit tenants
-- 2) completed active leases, only when no assignment rows exist

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

    _rent_amount := COALESCE(NULLIF(_completed_lease_rent_total, 0), 0);
  END IF;

  IF _rent_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active assignment or completed lease configured');
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

DO $$
DECLARE
  _verification_charge public.rent_charges;
BEGIN
  SELECT *
  INTO _verification_charge
  FROM public.rent_charges
  WHERE id = 'c2017725-5959-4023-b442-ef2a0b6be2d9'::uuid
    AND tenant_id = 'da4e681f-8525-47bc-8e92-1097f0703cf8'::uuid
    AND rent_period = '2026-06-01'::date
    AND rent_amount = 1000
  LIMIT 1;

  IF FOUND AND NOT EXISTS (
    SELECT 1
    FROM public.balance_adjustments
    WHERE tenant_id = _verification_charge.tenant_id
      AND adjustment_type = 'correction'
      AND description = 'Reversal of accidental verification rent charge for June 2026'
  ) THEN
    PERFORM public.apply_balance_adjustment(
      _verification_charge.tenant_id,
      'correction',
      -_verification_charge.rent_amount,
      'Reversal of accidental verification rent charge for June 2026',
      NULL
    );

    UPDATE public.rent_charges
    SET status = 'void',
        notes = 'Voided after verification exposed legacy rent fallback',
        updated_at = now()
    WHERE id = _verification_charge.id;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.charge_tenant_rent(uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_tenant_rent(uuid, date, uuid) TO authenticated, service_role;
