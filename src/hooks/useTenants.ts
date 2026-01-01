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
          user:profiles!tenants_user_id_fkey (
            id,
            email,
            full_name,
            phone
          ),
          property:properties (
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

interface AddTenantInput {
  user_id: string;
  property_id?: string | null;
  rent_amount?: number | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  created_by: string;
}

export function useAddTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddTenantInput) => {
      // First, insert the tenant record
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          user_id: input.user_id,
          property_id: input.property_id || null,
          rent_amount: input.rent_amount || 0,
          lease_start_date: input.lease_start_date,
          lease_end_date: input.lease_end_date,
          created_by: input.created_by,
          is_active: true,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Then, assign the tenant role to the user
      const { error: roleError } = await supabase.rpc('assign_tenant_role', {
        _user_id: input.user_id,
      });

      if (roleError) {
        console.error('Failed to assign tenant role:', roleError);
        // Don't throw here - the tenant record was created successfully
      }

      return tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Tenant added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add tenant: ${error.message}`);
    },
  });
}
