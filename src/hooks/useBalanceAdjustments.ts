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

interface ApplyAdjustmentInput {
  tenant_id: string;
  amount: number;
  adjustment_type: 'credit' | 'charge' | 'late_fee' | 'payment' | 'correction';
  description?: string;
  created_by: string;
}

interface ApplyAdjustmentResult {
  new_balance: number;
  previous_balance: number;
  adjustment_id: string;
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

// Uses atomic RPC for reliable balance adjustments
export function useApplyBalanceAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApplyAdjustmentInput): Promise<ApplyAdjustmentResult> => {
      // Validate amount
      if (input.adjustment_type !== 'correction' && input.amount <= 0) {
        throw new Error('Amount must be greater than zero');
      }
      if (input.adjustment_type === 'correction' && input.amount === 0) {
        throw new Error('Correction amount cannot be zero');
      }

      const { data, error } = await supabase.rpc('apply_balance_adjustment', {
        _tenant_id: input.tenant_id,
        _adjustment_type: input.adjustment_type,
        _amount: input.amount,
        _description: input.description || null,
        _created_by: input.created_by,
      });

      if (error) {
        console.error('Balance adjustment RPC error:', error);
        throw new Error(error.message || 'Failed to apply balance adjustment');
      }

      const result = data as unknown as ApplyAdjustmentResult;
      return result;
    },
    onSuccess: (result, variables) => {
      // Immediately update caches
      queryClient.invalidateQueries({ queryKey: ['balance-adjustments', variables.tenant_id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      
      toast.success(`Balance updated to ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(result.new_balance)}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to adjust balance: ${error.message}`);
    },
  });
}

// Legacy hook - kept for backwards compatibility but marked as deprecated
/** @deprecated Use useApplyBalanceAdjustment instead */
export function useCreateBalanceAdjustment() {
  return useApplyBalanceAdjustment();
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
