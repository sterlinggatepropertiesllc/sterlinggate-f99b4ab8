import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MaintenanceRecord {
  id: string;
  property_id: string;
  manager_id: string;
  title: string;
  description: string | null;
  category: string;
  material_cost: number;
  labor_cost: number;
  total_cost: number;
  performed_by: string;
  performed_by_name: string | null;
  ownership_split_percentage: number;
  partner_share_amount: number;
  status: string;
  performed_date: string;
  attachments: any[];
  created_at: string;
}

interface MaintenanceInsert {
  property_id: string;
  manager_id: string;
  title: string;
  description?: string;
  category?: string;
  material_cost?: number;
  labor_cost?: number;
  performed_by?: string;
  performed_by_name?: string;
  ownership_split_percentage?: number;
  status?: string;
  performed_date: string;
  attachments?: any[];
}

export function useMaintenance() {
  return useQuery({
    queryKey: ['maintenance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_records' as any)
        .select('*')
        .order('performed_date', { ascending: false });

      if (error) throw error;
      return data as unknown as MaintenanceRecord[];
    },
  });
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: MaintenanceInsert) => {
      const { data, error } = await supabase
        .from('maintenance_records' as any)
        .insert(record as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      toast.success('Maintenance record saved');
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maintenance_records' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      toast.success('Record deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
}
