-- Add notes column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create function to revoke tenant role (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.revoke_tenant_role(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_roles 
  WHERE user_id = _user_id AND role = 'tenant'::app_role;
END;
$$;