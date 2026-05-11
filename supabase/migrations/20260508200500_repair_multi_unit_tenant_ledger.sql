-- Targeted production ledger repair discovered during the May 8 payment audit.
-- The tenant has two active $1,050 unit assignments. April and May only had one
-- automated unit charge each, while March/April late fees were applied despite
-- on-time ACH payments covering those periods.

DO $$
DECLARE
  _tenant_id uuid := '4f8f5d8f-182b-401e-9422-1463ba08eeb9'::uuid;
  _secondary_property_id uuid := 'd59ab0c8-907f-47da-b6b9-4be8639a0f8a'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.balance_adjustments
    WHERE tenant_id = _tenant_id
      AND description = 'Historical correction: April 2026 second unit rent'
  ) THEN
    UPDATE public.rent_charges
    SET rent_amount = rent_amount + 1050,
        notes = concat_ws(' | ', notes, 'Historical correction added second assigned unit'),
        updated_at = now()
    WHERE tenant_id = _tenant_id
      AND rent_period = '2026-04-01'::date
      AND rent_amount = 1050;

    PERFORM public.apply_balance_adjustment(
      _tenant_id,
      'charge',
      1050,
      'Historical correction: April 2026 second unit rent',
      NULL
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.balance_adjustments
    WHERE tenant_id = _tenant_id
      AND description = 'Historical correction: May 2026 second unit rent'
  ) THEN
    UPDATE public.rent_charges
    SET rent_amount = rent_amount + 1050,
        notes = concat_ws(' | ', notes, 'Historical correction added second assigned unit'),
        updated_at = now()
    WHERE tenant_id = _tenant_id
      AND rent_period = '2026-05-01'::date
      AND rent_amount = 1050;

    PERFORM public.apply_balance_adjustment(
      _tenant_id,
      'charge',
      1050,
      'Historical correction: May 2026 second unit rent',
      NULL
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.balance_adjustments
    WHERE tenant_id = _tenant_id
      AND description = 'Historical correction: reverse March and April late fees covered by ACH'
  ) THEN
    PERFORM public.apply_balance_adjustment(
      _tenant_id,
      'correction',
      -105,
      'Historical correction: reverse March and April late fees covered by ACH',
      NULL
    );

    UPDATE public.rent_charges
    SET notes = concat_ws(' | ', notes, 'Late fee reversed by historical correction because ACH covered the period'),
        updated_at = now()
    WHERE tenant_id = _tenant_id
      AND rent_period IN ('2026-03-01'::date, '2026-04-01'::date)
      AND late_fee_applied = true
      AND COALESCE(late_fee_amount, 0) = 52.5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.payments
    WHERE stripe_payment_intent_id = 'pi_3TRzALCx5Tw1Rijg1pM2xxms'
  ) THEN
    INSERT INTO public.payments (
      tenant_id,
      property_id,
      amount,
      payment_date,
      payment_method,
      payment_method_type,
      payment_type,
      status,
      stripe_payment_intent_id,
      notes
    )
    VALUES (
      _tenant_id,
      _secondary_property_id,
      1050,
      '2026-04-30'::date,
      'stripe',
      'ach',
      'balance',
      'failed',
      'pi_3TRzALCx5Tw1Rijg1pM2xxms',
      'Imported failed Stripe attempt for second May unit payment'
    );
  END IF;
END $$;

UPDATE public.tenants t
SET property_id = NULL,
    rent_amount = NULL,
    updated_at = now(),
    notes = concat_ws(' | ', notes, 'Legacy property assignment cleared during source-of-truth repair')
WHERE t.id = 'da4e681f-8525-47bc-8e92-1097f0703cf8'::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_properties tp
    WHERE tp.tenant_id = t.id
  );
