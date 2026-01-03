import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface RentCharge {
  id: string;
  tenant_id: string;
  lease_id: string | null;
  rent_period: string;
  rent_amount: number;
  charged_at: string;
  late_fee_applied: boolean;
  late_fee_amount: number;
  late_fee_applied_at: string | null;
  late_fee_waived: boolean;
  late_fee_waived_at: string | null;
  late_fee_waived_by: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useRentCharges(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`rent_charges_${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rent_charges',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['rent_charges', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return useQuery({
    queryKey: ['rent_charges', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('rent_charges')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('rent_period', { ascending: false })
        .limit(12);

      if (error) throw error;
      return data as RentCharge[];
    },
    enabled: !!tenantId,
  });
}

interface ChargeRentInput {
  tenant_id: string;
  rent_period?: string;
  created_by?: string;
}

export function useChargeRent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ChargeRentInput) => {
      const { data, error } = await supabase.rpc('charge_tenant_rent', {
        _tenant_id: input.tenant_id,
        _rent_period: input.rent_period || null,
        _created_by: input.created_by || null,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; amount?: number; period?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to charge rent');
      }
      
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rent_charges', variables.tenant_id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['balance_adjustments', variables.tenant_id] });
      toast.success(`Rent of $${data.amount?.toLocaleString()} charged successfully`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

interface ApplyLateFeeInput {
  rent_charge_id: string;
  tenant_id: string;
  created_by?: string;
  override_amount?: number;
}

export function useApplyLateFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApplyLateFeeInput) => {
      const { data, error } = await supabase.rpc('apply_rent_late_fee', {
        _rent_charge_id: input.rent_charge_id,
        _created_by: input.created_by || null,
        _override_amount: input.override_amount || null,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; late_fee?: number; days_late?: number };
      if (!result.success) {
        throw new Error(result.error || 'Failed to apply late fee');
      }
      
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rent_charges', variables.tenant_id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['balance_adjustments', variables.tenant_id] });
      toast.success(`Late fee of $${data.late_fee?.toLocaleString()} applied`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

interface WaiveLateFeeInput {
  rent_charge_id: string;
  tenant_id: string;
  waived_by?: string;
}

export function useWaiveLateFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: WaiveLateFeeInput) => {
      const { data, error } = await supabase.rpc('waive_rent_late_fee', {
        _rent_charge_id: input.rent_charge_id,
        _waived_by: input.waived_by || null,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to waive late fee');
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rent_charges', variables.tenant_id] });
      toast.success('Late fee waived');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateRentChargeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, tenant_id }: { id: string; status: string; tenant_id: string }) => {
      const { data, error } = await supabase
        .from('rent_charges')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rent_charges', variables.tenant_id] });
      toast.success(`Status updated to ${variables.status}`);
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}
