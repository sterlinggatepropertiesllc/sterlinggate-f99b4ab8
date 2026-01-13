-- Add new notification type for inquiries
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'inquiry_received';

-- Create inquiries table
CREATE TABLE public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  manager_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  manager_notes TEXT
);

-- Enable RLS
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert inquiries (no auth required)
CREATE POLICY "Anyone can submit inquiries"
ON public.inquiries
FOR INSERT
WITH CHECK (true);

-- Property managers can view their inquiries
CREATE POLICY "Property managers can view their inquiries"
ON public.inquiries
FOR SELECT
USING (manager_id = auth.uid());

-- Property managers can update their inquiries
CREATE POLICY "Property managers can update their inquiries"
ON public.inquiries
FOR UPDATE
USING (manager_id = auth.uid());

-- Property managers can delete their inquiries
CREATE POLICY "Property managers can delete their inquiries"
ON public.inquiries
FOR DELETE
USING (manager_id = auth.uid());

-- Create trigger function to notify manager on new inquiry
CREATE OR REPLACE FUNCTION public.notify_on_new_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  property_address TEXT;
BEGIN
  -- Get property address
  SELECT address INTO property_address FROM properties WHERE id = NEW.property_id;

  -- Create notification for property manager
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.manager_id,
    'inquiry_received',
    'New Property Inquiry',
    NEW.name || ' sent an inquiry about ' || property_address,
    jsonb_build_object(
      'inquiry_id', NEW.id,
      'property_id', NEW.property_id,
      'sender_name', NEW.name,
      'sender_email', NEW.email
    )
  );

  RETURN NEW;
END;
$function$;

-- Create trigger
CREATE TRIGGER on_new_inquiry
  AFTER INSERT ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_inquiry();