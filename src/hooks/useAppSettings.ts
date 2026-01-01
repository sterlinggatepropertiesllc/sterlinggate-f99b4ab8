import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AppSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
}

interface ApplicationFeeValue {
  amount: number;
  currency: string;
}

export function useAppSettings() {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;
      return data as AppSetting[];
    },
  });
}

export function useApplicationFee() {
  return useQuery({
    queryKey: ['app-settings', 'application_fee'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'application_fee')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No setting found, return default
          return { amount: 5000, currency: 'usd' } as ApplicationFeeValue;
        }
        throw error;
      }
      return data.value as unknown as ApplicationFeeValue;
    },
  });
}

export function useUpdateApplicationFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newAmount: number) => {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'application_fee')
        .single();

      const value = { amount: newAmount, currency: 'usd' };

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ 
            value,
            updated_at: new Date().toISOString()
          })
          .eq('key', 'application_fee');

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({ 
            key: 'application_fee',
            value
          });

        if (error) throw error;
      }

      return value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('Application fee updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update application fee: ${error.message}`);
    },
  });
}
