
-- Add telegram_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN telegram_id TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_profiles_telegram_id ON public.profiles(telegram_id) WHERE telegram_id IS NOT NULL;
