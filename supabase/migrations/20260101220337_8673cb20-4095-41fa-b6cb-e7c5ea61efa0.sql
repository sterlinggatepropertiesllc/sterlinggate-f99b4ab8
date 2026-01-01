-- Add unique constraint on user_roles for (user_id, role) if not exists
-- First check if it exists by using a DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- Create function to assign tenant role (if not already assigned)
CREATE OR REPLACE FUNCTION public.assign_tenant_role(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'tenant')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Create RLS policy for property managers to view all profiles (for tenant selection)
CREATE POLICY "Property managers can view all profiles for tenant selection"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'property_manager'::app_role));