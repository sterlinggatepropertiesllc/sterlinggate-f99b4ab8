-- Add RLS policy to allow users to view profiles of people they've messaged with
CREATE POLICY "Users can view profiles of message participants"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages 
      WHERE (messages.sender_id = profiles.id AND messages.recipient_id = auth.uid())
         OR (messages.recipient_id = profiles.id AND messages.sender_id = auth.uid())
    )
  );

-- Create app_settings table for configurable settings like application fees
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for edge functions and frontend)
CREATE POLICY "Anyone can read settings"
  ON public.app_settings FOR SELECT
  USING (true);

-- Only property managers can update settings
CREATE POLICY "Property managers can update settings"
  ON public.app_settings FOR UPDATE
  USING (has_role(auth.uid(), 'property_manager'));

-- Only property managers can insert settings
CREATE POLICY "Property managers can insert settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'property_manager'));

-- Insert default application fee ($50 = 5000 cents)
INSERT INTO public.app_settings (key, value) 
VALUES ('application_fee', '{"amount": 5000, "currency": "usd"}');