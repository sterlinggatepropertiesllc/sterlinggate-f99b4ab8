import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_IMAGES = 15;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadProgress {
  [key: string]: number;
}

export function usePropertyImages() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({});

  const uploadImages = async (files: File[], propertyId: string): Promise<string[]> => {
    if (files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return [];
    }

    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 10MB limit`);
        return false;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return [];

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${propertyId}/${Date.now()}-${i}.${fileExt}`;

        setProgress(prev => ({ ...prev, [file.name]: 0 }));

        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}`);
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('property-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
        setProgress(prev => ({ ...prev, [file.name]: 100 }));
      }

      if (uploadedUrls.length > 0) {
        toast.success(`${uploadedUrls.length} image(s) uploaded successfully`);
      }

      return uploadedUrls;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload images');
      return [];
    } finally {
      setUploading(false);
      setProgress({});
    }
  };

  const deleteImage = async (imageUrl: string): Promise<boolean> => {
    try {
      // Extract path from URL
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/property-photos/');
      if (pathParts.length < 2) {
        toast.error('Invalid image URL');
        return false;
      }

      const filePath = decodeURIComponent(pathParts[1]);

      const { error } = await supabase.storage
        .from('property-photos')
        .remove([filePath]);

      if (error) {
        toast.error('Failed to delete image');
        console.error('Delete error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete image');
      return false;
    }
  };

  return {
    uploadImages,
    deleteImage,
    uploading,
    progress,
    maxImages: MAX_IMAGES,
  };
}
