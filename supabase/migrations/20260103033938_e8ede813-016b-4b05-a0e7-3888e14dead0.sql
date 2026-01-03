-- Create storage bucket for application documents (private bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-documents', 'application-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Property managers can view all application documents" ON storage.objects;

-- RLS policies for application-documents bucket
-- Users can upload to their own folder
CREATE POLICY "Users can upload app docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'application-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own documents
CREATE POLICY "Users can view app docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own documents
CREATE POLICY "Users can update app docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'application-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own documents
CREATE POLICY "Users can delete app docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'application-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Property managers can view all application documents
CREATE POLICY "Managers can view app docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-documents' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'property_manager'
  )
);