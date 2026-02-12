
-- Fix storage policies for maintenance-attachments bucket
-- Current policies use auth.uid() as folder path but code uploads to {maintenanceId}/{uuid}.{ext}

-- Drop existing broken policies
DROP POLICY IF EXISTS "Authenticated users can upload maintenance attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view maintenance attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete maintenance attachments" ON storage.objects;

-- Create corrected policies that verify ownership through maintenance_records
CREATE POLICY "Manager can upload maintenance attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-attachments'
  AND EXISTS (
    SELECT 1 FROM public.maintenance_records mr
    WHERE mr.id::text = (storage.foldername(name))[1]
    AND mr.manager_id = auth.uid()
  )
);

CREATE POLICY "Manager can view maintenance attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'maintenance-attachments'
  AND EXISTS (
    SELECT 1 FROM public.maintenance_records mr
    WHERE mr.id::text = (storage.foldername(name))[1]
    AND mr.manager_id = auth.uid()
  )
);

CREATE POLICY "Manager can delete maintenance attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'maintenance-attachments'
  AND EXISTS (
    SELECT 1 FROM public.maintenance_records mr
    WHERE mr.id::text = (storage.foldername(name))[1]
    AND mr.manager_id = auth.uid()
  )
);

-- Make bucket public so getPublicUrl() works for viewing
UPDATE storage.buckets SET public = true WHERE id = 'maintenance-attachments';
