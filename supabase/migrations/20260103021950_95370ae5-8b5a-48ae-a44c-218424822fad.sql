-- Drop the existing policy that has missing WITH CHECK clause
DROP POLICY IF EXISTS "Tenants can update lease status for signing" ON public.leases;

-- Create a new policy with proper WITH CHECK clause
-- USING: Tenant can only update leases where they are the tenant AND status is pending_tenant_signature
-- WITH CHECK: After update, the status must be pending_manager_signature (validates the new state)
CREATE POLICY "Tenants can update lease status for signing" 
ON public.leases 
FOR UPDATE 
USING (
  (tenant_id = auth.uid()) 
  AND (status = 'pending_tenant_signature'::lease_status)
)
WITH CHECK (
  (tenant_id = auth.uid()) 
  AND (status = 'pending_manager_signature'::lease_status)
);