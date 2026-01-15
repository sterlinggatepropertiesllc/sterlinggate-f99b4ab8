-- Add stripe_payment_intent_id column to track PaymentIntents for webhook processing
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Create index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);