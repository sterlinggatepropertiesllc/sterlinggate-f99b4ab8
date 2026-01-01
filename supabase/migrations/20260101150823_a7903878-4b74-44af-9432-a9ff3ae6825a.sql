-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
  'application_received',
  'application_approved',
  'application_rejected',
  'rent_received',
  'maintenance_request',
  'lease_signed',
  'message_received'
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification_settings table
CREATE TABLE public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  discord_webhook_url TEXT,
  discord_enabled BOOLEAN NOT NULL DEFAULT false,
  notify_application_received BOOLEAN NOT NULL DEFAULT true,
  notify_application_approved BOOLEAN NOT NULL DEFAULT true,
  notify_application_rejected BOOLEAN NOT NULL DEFAULT true,
  notify_rent_received BOOLEAN NOT NULL DEFAULT true,
  notify_maintenance_request BOOLEAN NOT NULL DEFAULT true,
  notify_lease_signed BOOLEAN NOT NULL DEFAULT true,
  notify_message_received BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- RLS policies for notification_settings
CREATE POLICY "Users can view their own settings"
  ON public.notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to notify on new application
CREATE OR REPLACE FUNCTION public.notify_on_new_application()
RETURNS TRIGGER AS $$
DECLARE
  property_record RECORD;
BEGIN
  -- Get the property and manager info
  SELECT p.*, pr.full_name as applicant_name
  INTO property_record
  FROM properties p
  LEFT JOIN profiles pr ON pr.id = NEW.applicant_id
  WHERE p.id = NEW.property_id;

  -- Create notification for property manager
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    property_record.manager_id,
    'application_received',
    'New Application Received',
    COALESCE(property_record.applicant_name, 'Someone') || ' applied for ' || property_record.address,
    jsonb_build_object('application_id', NEW.id, 'property_id', NEW.property_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new applications
CREATE TRIGGER on_new_application
  AFTER INSERT ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_application();

-- Create function to notify on application status change
CREATE OR REPLACE FUNCTION public.notify_on_application_status_change()
RETURNS TRIGGER AS $$
DECLARE
  property_record RECORD;
  notification_type notification_type;
BEGIN
  -- Only trigger on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get the property info
  SELECT address INTO property_record FROM properties WHERE id = NEW.property_id;

  -- Determine notification type
  IF NEW.status = 'approved' THEN
    notification_type := 'application_approved';
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.applicant_id,
      notification_type,
      'Application Approved!',
      'Your application for ' || property_record.address || ' has been approved',
      jsonb_build_object('application_id', NEW.id, 'property_id', NEW.property_id)
    );
  ELSIF NEW.status = 'rejected' THEN
    notification_type := 'application_rejected';
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.applicant_id,
      notification_type,
      'Application Update',
      'Your application for ' || property_record.address || ' was not approved',
      jsonb_build_object('application_id', NEW.id, 'property_id', NEW.property_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for application status changes
CREATE TRIGGER on_application_status_change
  AFTER UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_application_status_change();

-- Create function to notify on new message
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Create notification for recipient
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.recipient_id,
    'message_received',
    'New Message',
    COALESCE(sender_name, 'Someone') || ': ' || LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END,
    jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new messages
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_message();

-- Create function to notify on lease signed
CREATE OR REPLACE FUNCTION public.notify_on_lease_signed()
RETURNS TRIGGER AS $$
DECLARE
  lease_record RECORD;
  tenant_name TEXT;
BEGIN
  -- Only trigger when status changes to signed
  IF OLD.status = NEW.status OR NEW.status != 'signed' THEN
    RETURN NEW;
  END IF;

  -- Get lease and property info
  SELECT l.*, p.address
  INTO lease_record
  FROM leases l
  JOIN properties p ON p.id = l.property_id
  WHERE l.id = NEW.id;

  -- Get tenant name
  SELECT full_name INTO tenant_name FROM profiles WHERE id = NEW.tenant_id;

  -- Notify manager
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.manager_id,
    'lease_signed',
    'Lease Signed',
    COALESCE(tenant_name, 'Tenant') || ' signed the lease for ' || lease_record.address,
    jsonb_build_object('lease_id', NEW.id, 'property_id', NEW.property_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for lease signatures
CREATE TRIGGER on_lease_signed
  AFTER UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_lease_signed();