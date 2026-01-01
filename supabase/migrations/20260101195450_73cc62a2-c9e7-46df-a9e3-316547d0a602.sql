-- Allow tenants to view property manager profiles for messaging
CREATE POLICY "Tenants can view property manager profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'tenant'::app_role) AND
  has_role(id, 'property_manager'::app_role)
);