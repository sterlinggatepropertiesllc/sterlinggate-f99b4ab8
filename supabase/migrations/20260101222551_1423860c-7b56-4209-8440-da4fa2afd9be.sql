-- Add RLS policy allowing property managers to view tenant roles for lease creation
CREATE POLICY "Property managers can view tenant roles"
ON public.user_roles FOR SELECT
USING (
  auth.uid() = user_id
  OR
  (public.has_role(auth.uid(), 'property_manager'::app_role) AND role = 'tenant'::app_role)
);

-- Create helper function for creating notifications from frontend
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID,
  _type notification_type,
  _title TEXT,
  _message TEXT,
  _metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (_user_id, _type, _title, _message, _metadata)
  RETURNING id INTO _notification_id;
  
  RETURN _notification_id;
END;
$$;