-- Drop the incorrect policy that checks tenant_id = auth.uid()
DROP POLICY IF EXISTS "Tenants can view their own payments" ON payments;

-- Create the corrected policy that properly joins through the tenants table
CREATE POLICY "Tenants can view their own payments" 
  ON payments 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM tenants 
      WHERE tenants.id = payments.tenant_id 
      AND tenants.user_id = auth.uid()
    )
  );