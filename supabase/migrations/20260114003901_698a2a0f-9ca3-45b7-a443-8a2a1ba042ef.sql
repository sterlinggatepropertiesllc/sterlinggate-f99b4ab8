-- Add payment_method_type and convenience_fee columns to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
ADD COLUMN IF NOT EXISTS convenience_fee NUMERIC DEFAULT 0;

-- Add check constraint for valid payment method types
ALTER TABLE public.payments
ADD CONSTRAINT valid_payment_method_type 
CHECK (payment_method_type IS NULL OR payment_method_type IN ('card', 'ach', 'manual', 'other'));

-- Insert default payment method settings if not exists
INSERT INTO public.app_settings (key, value)
VALUES ('payment_methods', '{
  "ach_enabled": true,
  "card_enabled": true,
  "card_fee_percentage": 3.0
}'::jsonb)
ON CONFLICT (key) DO NOTHING;