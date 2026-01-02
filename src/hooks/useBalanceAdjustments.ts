import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BalanceAdjustment {
  id: string;
  tenant_id: string;
  amount: number;
  adjustment_type: 'credit' | 'charge' | 'late_fee' | 'payment' | 'correction';
  description: string | null;
  previous_balance: number;
  new_balance: number;
  created_by: string | null;
  created_at: string;
}

interface CreateAdjustmentInput {
  tenant_id: string;
  amount: number;
  adjustment_type: 'credit' | 'charge' | 'late_fee' | 'payment' | 'correction';
  description: string;
  current_balance: number;
  created_by: string;
}

export function useBalanceAdjustments(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  // Set up realtime subscription for balance adjustments
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`balance-adjustments-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'balance_adjustments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['balance-adjustments', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return useQuery({
    queryKey: ['balance-adjustments', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('balance_adjustments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as BalanceAdjustment[];
    },
    enabled: !!tenantId,
  });
}

// Hook for realtime tenant balance updates
export function useRealtimeTenantBalance(tenantId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`tenant-balance-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenantId}`,
        },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, onUpdate]);
}

export function useCreateBalanceAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAdjustmentInput) => {
      // Calculate new balance based on adjustment type
      const isDebit = ['charge', 'late_fee'].includes(input.adjustment_type);
      const isCredit = ['credit', 'payment'].includes(input.adjustment_type);
      
      let newBalance = input.current_balance;
      if (isDebit) {
        newBalance = input.current_balance + Math.abs(input.amount);
      } else if (isCredit) {
        newBalance = input.current_balance - Math.abs(input.amount);
      } else {
        // correction - can be positive or negative
        newBalance = input.current_balance + input.amount;
      }

      // Insert the adjustment record
      const { data: adjustment, error: adjustmentError } = await supabase
        .from('balance_adjustments')
        .insert({
          tenant_id: input.tenant_id,
          amount: input.amount,
          adjustment_type: input.adjustment_type,
          description: input.description,
          previous_balance: input.current_balance,
          new_balance: newBalance,
          created_by: input.created_by,
        })
        .select()
        .single();

      if (adjustmentError) throw adjustmentError;

      // Update the tenant's current balance
      const { error: updateError } = await supabase
        .from('tenants')
        .update({ current_balance: newBalance })
        .eq('id', input.tenant_id);

      if (updateError) throw updateError;

      return { adjustment, newBalance };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['balance-adjustments', variables.tenant_id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Balance adjusted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to adjust balance: ${error.message}`);
    },
  });
}

// Calculate overdue balance based on rent amount and due date
export function calculateOverdueBalance(
  currentBalance: number,
  rentAmount: number | null,
  leaseStartDate: string | null,
  rentDueDay: number = 1
): number {
  if (!rentAmount || !leaseStartDate || currentBalance <= 0) {
    return 0;
  }

  const today = new Date();
  const currentDay = today.getDate();
  
  // If we're past the due day this month, any positive balance is overdue
  if (currentDay > rentDueDay) {
    return currentBalance;
  }
  
  return 0;
}
