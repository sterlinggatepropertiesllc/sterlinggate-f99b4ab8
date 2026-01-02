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
          current_balance,
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
        .eq('manager_id', managerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!managerId,
    retry: 1,
    staleTime: 5000,
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
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update tenant: ${error.message}`);
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      // Soft delete - set is_active to false
      const { data, error } = await supabase
        .from('tenants')
        .update({ is_active: false })
        .eq('id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant removed successfully');
    },
    onError: (error) => {
      toast.error(`Failed to remove tenant: ${error.message}`);
    },
  });
}

export function useRevokeTenantAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('revoke_tenant_role', {
        _user_id: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Tenant portal access revoked');
    },
    onError: (error) => {
      toast.error(`Failed to revoke access: ${error.message}`);
    },
  });
}

interface AddTenantInput {
  user_id: string;
  property_id?: string | null;
  rent_amount?: number | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  manager_id: string;
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
          manager_id: input.manager_id,
          created_by: input.manager_id,
          is_active: true,
        })
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
        .single();

      if (tenantError) throw tenantError;

      // Then, assign the tenant role to the user
      const { error: roleError } = await supabase.rpc('assign_tenant_role', {
        _user_id: input.user_id,
      });

      if (roleError) {
        console.error('Failed to assign tenant role:', roleError);
      }

      return tenant;
    },
    onMutate: async (input) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tenants', input.manager_id] });
    },
    onSuccess: (data, variables) => {
      // Optimistically update the cache
      queryClient.setQueryData(['tenants', variables.manager_id], (old: any[] | undefined) => {
        if (!old) return [data];
        return [data, ...old];
      });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Tenant added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add tenant: ${error.message}`);
    },
  });
}
