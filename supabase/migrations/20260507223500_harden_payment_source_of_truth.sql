-- Harden payment/balance source of truth.
--
-- payments = transaction ledger from Stripe/manual entry.
-- balance_adjustments = tenant balance ledger.
-- tenants.current_balance = cached rollup maintained by apply_balance_adjustment().

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS balance_adjustment_id uuid REFERENCES public.balance_adjustments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS balance_applied_at timestamptz;

-- Historical completed balance/rent payments already affected tenant balances
-- through legacy code paths. Mark them as applied so the new idempotent RPC
-- will not double-apply them if an old Stripe event or verify call is replayed.
UPDATE public.payments
SET balance_applied_at = COALESCE(balance_applied_at, created_at)
WHERE status = 'completed'
  AND payment_type IN ('balance', 'rent')
  AND balance_applied_at IS NULL;

-- Stripe identifiers should be globally idempotent when present.
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_payment_intent_id_unique
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_session_id_unique
  ON public.payments (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_tenant_created_at
  ON public.payments (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_property_payment_date
  ON public.payments (property_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_payments_processing_stripe_pi
  ON public.payments (status, stripe_payment_intent_id)
  WHERE status = 'processing' AND stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_balance_adjustments_tenant_created_at
  ON public.balance_adjustments (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_payment_balance_adjustment(
  _payment_id uuid,
  _created_by uuid DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _payment public.payments;
  _result jsonb;
  _adjustment_id uuid;
  _description_to_use text;
BEGIN
  SELECT *
  INTO _payment
  FROM public.payments
  WHERE id = _payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found: %', _payment_id;
  END IF;

  IF _payment.payment_type NOT IN ('balance', 'rent') THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'payment_type_does_not_affect_balance',
      'payment_id', _payment_id,
      'payment_type', _payment.payment_type
    );
  END IF;

  IF _payment.status <> 'completed' THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'payment_not_completed',
      'payment_id', _payment_id,
      'status', _payment.status
    );
  END IF;

  IF _payment.balance_adjustment_id IS NOT NULL OR _payment.balance_applied_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'already_applied',
      'payment_id', _payment_id,
      'adjustment_id', _payment.balance_adjustment_id,
      'balance_applied_at', _payment.balance_applied_at
    );
  END IF;

  _description_to_use := COALESCE(
    _description,
    'Stripe ' || COALESCE(_payment.payment_type, 'payment') || ' payment'
      || CASE
        WHEN _payment.stripe_payment_intent_id IS NOT NULL THEN ' - PI ' || _payment.stripe_payment_intent_id
        WHEN _payment.stripe_session_id IS NOT NULL THEN ' - Session ' || _payment.stripe_session_id
        ELSE ''
      END
  );

  _result := public.apply_balance_adjustment(
    _payment.tenant_id,
    'payment',
    _payment.amount,
    _description_to_use,
    _created_by
  );

  _adjustment_id := (_result->>'adjustment_id')::uuid;

  UPDATE public.payments
  SET balance_adjustment_id = _adjustment_id,
      balance_applied_at = now()
  WHERE id = _payment_id;

  RETURN _result || jsonb_build_object(
    'applied', true,
    'payment_id', _payment_id,
    'adjustment_id', _adjustment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment_balance_adjustment(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_balance_adjustment(uuid, uuid, text) TO service_role;
