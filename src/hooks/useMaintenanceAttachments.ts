import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MaintenanceAttachment {
  id: string;
  maintenance_id: string;
  file_url: string;
  file_type: string;
  file_name: string | null;
  created_at: string;
}

export function useMaintenanceAttachments(maintenanceId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance-attachments', maintenanceId],
    queryFn: async () => {
      if (!maintenanceId) return [];
      const { data, error } = await supabase
        .from('maintenance_attachments')
        .select('*')
        .eq('maintenance_id', maintenanceId)
        .order('created_at');

      if (error) throw error;
      return data as MaintenanceAttachment[];
    },
    enabled: !!maintenanceId,
  });
}

export function useUploadMaintenanceAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ maintenanceId, file }: { maintenanceId: string; file: File }) => {
      const ext = file.name.split('.').pop();
      const path = `${maintenanceId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('maintenance-attachments')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('maintenance-attachments')
        .getPublicUrl(path);

      const { data, error } = await supabase
        .from('maintenance_attachments')
        .insert({
          maintenance_id: maintenanceId,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_name: file.name,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MaintenanceAttachment;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-attachments', vars.maintenanceId] });
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });
}

export function useDeleteMaintenanceAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, fileUrl, maintenanceId }: { id: string; fileUrl: string; maintenanceId: string }) => {
      // Extract path from URL
      const urlParts = fileUrl.split('/maintenance-attachments/');
      if (urlParts[1]) {
        await supabase.storage.from('maintenance-attachments').remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('maintenance_attachments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return maintenanceId;
    },
    onSuccess: (maintenanceId) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-attachments', maintenanceId] });
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
}
