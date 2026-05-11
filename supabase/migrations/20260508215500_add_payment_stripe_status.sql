-- Preserve Stripe's exact PaymentIntent status separately from the app ledger status.
-- Example: app status may be "failed" for non-collectible ledger behavior, while
-- Stripe status "requires_payment_method" displays as "Incomplete" in Stripe.

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS stripe_status text;

COMMENT ON COLUMN public.payments.stripe_status IS
  'Exact Stripe PaymentIntent status, used for display/audit accuracy.';

CREATE INDEX IF NOT EXISTS idx_payments_stripe_status
  ON public.payments (stripe_status)
  WHERE stripe_status IS NOT NULL;

UPDATE public.payments
SET stripe_status = CASE
    WHEN stripe_payment_intent_id = 'pi_3TRzALCx5Tw1Rijg1pM2xxms' THEN 'requires_payment_method'
    WHEN notes ILIKE '%requires_payment_method%' THEN 'requires_payment_method'
    WHEN notes ILIKE '%Stripe status was canceled%' OR notes ILIKE '%Stripe status: canceled%' THEN 'canceled'
    WHEN status = 'completed' AND stripe_payment_intent_id IS NOT NULL THEN 'succeeded'
    WHEN status = 'processing' AND stripe_payment_intent_id IS NOT NULL THEN 'processing'
    WHEN status = 'canceled' AND stripe_payment_intent_id IS NOT NULL THEN 'canceled'
    WHEN status = 'failed' AND stripe_payment_intent_id IS NOT NULL THEN 'payment_failed'
    ELSE stripe_status
  END
WHERE stripe_payment_intent_id IS NOT NULL
  AND stripe_status IS NULL;

UPDATE public.payments
SET notes = concat_ws(' | ', notes, 'Stripe status: requires_payment_method (dashboard: incomplete)')
WHERE stripe_payment_intent_id = 'pi_3TRzALCx5Tw1Rijg1pM2xxms'
  AND (notes IS NULL OR notes NOT ILIKE '%requires_payment_method%');
