-- Allow property managers to delete their own leases
CREATE POLICY "Property managers can delete their leases"
  ON public.leases
  FOR DELETE
  USING (manager_id = auth.uid());

-- Allow property managers to delete signatures for their leases
CREATE POLICY "Property managers can delete signatures for their leases"
  ON public.signatures
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM leases 
      WHERE leases.id = signatures.lease_id 
      AND leases.manager_id = auth.uid()
    )
  );

-- Allow property managers to delete documents for their leases
CREATE POLICY "Property managers can delete documents for their leases"
  ON public.documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM leases 
      WHERE leases.id = documents.lease_id 
      AND leases.manager_id = auth.uid()
    )
  );