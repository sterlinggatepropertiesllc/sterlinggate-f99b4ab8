import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Tenant = Database['public']['Tables']['tenants']['Row'];
type TenantInsert = Database['public']['Tables']['tenants']['Insert'];

export function useTenants(managerId: string | undefined) {
  return useQuery({
    queryKey: ['tenants', managerId],
    queryFn: async () => {
      if (!managerId) return [];
      
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          user:user_id (
            id,
            email,
            full_name,
            phone
          ),
          property:property_id (
            id,
            address,
            city,
            state
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!managerId,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenant: TenantInsert) => {
      const { data, error } = await supabase
        .from('tenants')
        .insert(tenant)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add tenant: ${error.message}`);
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tenant> & { id: string }) => {
      const { data, error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update tenant: ${error.message}`);
    },
  });
}
