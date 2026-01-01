import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = ['application/pdf'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

export interface UploadedAttachment {
  url: string;
  type: string;
  name: string;
}

export function useMessageAttachments() {
  const [uploading, setUploading] = useState(false);

  const uploadAttachment = async (file: File, userId: string): Promise<UploadedAttachment | null> => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Please upload images (JPEG, PNG, GIF, WEBP) or PDF files.');
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 10MB.');
      return null;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(fileName);

      return {
        url: urlData.publicUrl,
        type: file.type,
        name: file.name,
      };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const isImageType = (type: string) => ALLOWED_IMAGE_TYPES.includes(type);

  return {
    uploadAttachment,
    uploading,
    isImageType,
    allowedTypes: ALLOWED_TYPES.join(','),
  };
}
