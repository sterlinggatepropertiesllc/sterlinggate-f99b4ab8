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
      
      // Fetch tenants with user profile
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select(`
          *,
          current_balance,
          user:profiles!tenants_user_id_fkey (
            id,
            email,
            full_name,
            phone
          )
        `)
        .eq('manager_id', managerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch tenant_properties for all tenants to get primary property info
      const tenantIds = tenants.map(t => t.id);
      
      if (tenantIds.length === 0) return tenants;

      const { data: tenantProperties, error: tpError } = await supabase
        .from('tenant_properties')
        .select(`
          tenant_id,
          is_primary,
          rent_amount,
          lease_start_date,
          lease_end_date,
          property:properties (
            id,
            address,
            city,
            state,
            rent_amount,
            manager_id
          )
        `)
        .in('tenant_id', tenantIds)
        .order('is_primary', { ascending: false });

      if (tpError) {
        console.error('Error fetching tenant properties:', tpError);
        return tenants;
      }

      // Group tenant_properties by tenant_id
      const propertiesByTenant: Record<string, typeof tenantProperties> = {};
      tenantProperties?.forEach(tp => {
        if (!propertiesByTenant[tp.tenant_id]) {
          propertiesByTenant[tp.tenant_id] = [];
        }
        propertiesByTenant[tp.tenant_id].push(tp);
      });

      // Enhance tenants with primary property info from tenant_properties
      return tenants.map(tenant => {
        const tenantProps = [...(propertiesByTenant[tenant.id] || [])].sort(
          (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
        );
        const primaryProp = tenantProps.find(tp => tp.is_primary) || tenantProps[0];
        const additionalPropsCount = Math.max(0, tenantProps.length - 1);
        const assignmentRentTotal = tenantProps.reduce(
          (sum, tp) => sum + Number(tp.rent_amount || tp.property?.rent_amount || 0),
          0
        );
        const assignedPropertySummary = tenantProps
          .map(tp => tp.property?.address)
          .filter(Boolean)
          .join(' + ') || null;

        return {
          ...tenant,
          // Primary property from tenant_properties
          primary_property: primaryProp?.property || null,
          assigned_properties: tenantProps,
          assigned_property_summary: assignedPropertySummary,
          primary_rent_amount: primaryProp?.rent_amount || null,
          assignment_rent_total: assignmentRentTotal || primaryProp?.rent_amount || null,
          active_assignment_count: tenantProps.length,
          primary_lease_start: primaryProp?.lease_start_date || null,
          primary_lease_end: primaryProp?.lease_end_date || null,
          additional_properties_count: additionalPropsCount,
          // Keep legacy property field for backward compatibility but prefer primary_property
          property: primaryProp?.property || null,
        };
      });
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

export function useHardDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await supabase.rpc('hard_delete_tenant', {
        _tenant_id: tenantId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['rent-charges'] });
      queryClient.invalidateQueries({ queryKey: ['balance-adjustments'] });
      toast.success('Tenant permanently deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete tenant: ${error.message}`);
    },
  });
}

interface AddTenantInput {
  user_id: string;
  manager_id: string;
}

export function useAddTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddTenantInput) => {
      // Insert the tenant record (no property assignment - that happens in tenant detail)
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          user_id: input.user_id,
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
          )
        `)
        .single();

      if (tenantError) throw tenantError;

      // Assign the tenant role to the user
      const { error: roleError } = await supabase.rpc('assign_tenant_role', {
        _user_id: input.user_id,
      });

      if (roleError) {
        console.error('Failed to assign tenant role:', roleError);
      }

      return tenant;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['tenants', input.manager_id] });
    },
    onSuccess: (data, variables) => {
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
