import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TenantProperty {
  id: string;
  tenant_id: string;
  property_id: string;
  rent_amount: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Late fee configuration
  late_fee_type: string | null;
  late_fee_percentage: number | null;
  late_fee_flat_amount: number | null;
  late_fee_daily_amount: number | null;
  late_fee_max_amount: number | null;
  grace_period_days: number | null;
  rent_due_day: number | null;
  property?: {
    id: string;
    address: string;
    city: string;
    state: string;
    rent_amount: number;
  };
}

export function useTenantProperties(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-properties', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('tenant_properties')
        .select(`
          *,
          property:properties (
            id,
            address,
            city,
            state,
            rent_amount
          )
        `)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TenantProperty[];
    },
    enabled: !!tenantId,
  });
}

interface AddTenantPropertyInput {
  tenant_id: string;
  property_id: string;
  rent_amount?: number | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  is_primary?: boolean;
  notes?: string | null;
  // Late fee configuration
  late_fee_type?: string | null;
  late_fee_percentage?: number | null;
  late_fee_flat_amount?: number | null;
  late_fee_daily_amount?: number | null;
  late_fee_max_amount?: number | null;
  grace_period_days?: number | null;
  rent_due_day?: number | null;
}

export function useAddTenantProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddTenantPropertyInput) => {
      // If this is being set as primary, unset other primaries first
      if (input.is_primary) {
        await supabase
          .from('tenant_properties')
          .update({ is_primary: false })
          .eq('tenant_id', input.tenant_id);
      }

      const { data, error } = await supabase
        .from('tenant_properties')
        .insert({
          tenant_id: input.tenant_id,
          property_id: input.property_id,
          rent_amount: input.rent_amount ?? 0,
          lease_start_date: input.lease_start_date,
          lease_end_date: input.lease_end_date,
          is_primary: input.is_primary ?? false,
          notes: input.notes,
          late_fee_type: input.late_fee_type ?? 'percentage',
          late_fee_percentage: input.late_fee_percentage ?? 5,
          late_fee_flat_amount: input.late_fee_flat_amount ?? 0,
          late_fee_daily_amount: input.late_fee_daily_amount ?? 0,
          late_fee_max_amount: input.late_fee_max_amount,
          grace_period_days: input.grace_period_days ?? 5,
          rent_due_day: input.rent_due_day ?? 1,
        })
        .select(`
          *,
          property:properties (
            id,
            address,
            city,
            state,
            rent_amount
          )
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-properties', variables.tenant_id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Property assigned successfully');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This property is already assigned to this tenant');
      } else {
        toast.error(`Failed to assign property: ${error.message}`);
      }
    },
  });
}

export function useUpdateTenantProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenant_id, ...updates }: Partial<TenantProperty> & { id: string; tenant_id: string }) => {
      const { property: _joinedProperty, ...writeUpdates } = updates;

      // If setting as primary, unset other primaries first
      if (writeUpdates.is_primary) {
        await supabase
          .from('tenant_properties')
          .update({ is_primary: false })
          .eq('tenant_id', tenant_id)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('tenant_properties')
        .update(writeUpdates)
        .eq('id', id)
        .select(`
          *,
          property:properties (
            id,
            address,
            city,
            state,
            rent_amount
          )
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-properties', variables.tenant_id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Property assignment updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useRemoveTenantProperty(tenantId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tenant_properties')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-properties', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Property removed from tenant');
    },
    onError: (error) => {
      toast.error(`Failed to remove property: ${error.message}`);
    },
  });
}

export function useSetPrimaryProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenantId, tenantPropertyId }: { tenantId: string; tenantPropertyId: string }) => {
      // First, unset all primaries for this tenant
      await supabase
        .from('tenant_properties')
        .update({ is_primary: false })
        .eq('tenant_id', tenantId);

      // Then set the new primary
      const { data, error } = await supabase
        .from('tenant_properties')
        .update({ is_primary: true })
        .eq('id', tenantPropertyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-properties', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Primary property updated');
    },
    onError: (error) => {
      toast.error(`Failed to set primary: ${error.message}`);
    },
  });
}
