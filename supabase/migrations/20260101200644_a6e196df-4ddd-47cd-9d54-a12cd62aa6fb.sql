-- Add columns to payments table for Stripe integration
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'rent';

-- Add index for faster lookups by session ID
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session_id ON public.payments(stripe_session_id);

-- Add index for payment type queries
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON public.payments(payment_type);

-- Update RLS policy to allow service role to insert payments during verification
-- (The existing policies should work since we're using service role in edge function)