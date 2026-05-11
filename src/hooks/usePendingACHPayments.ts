import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createRealtimeChannelName } from '@/lib/realtimeChannel';

export interface PendingACHPayment {
  id: string;
  amount: number;
  created_at: string;
  payment_date: string;
  payment_method_type: string | null;
  status: string;
  stripe_status?: string | null;
  notes: string | null;
}

export interface PendingACHSummary {
  payments: PendingACHPayment[];
  totalPending: number;
  effectiveBalance: number;
  count: number;
}

export function usePendingACHPayments(tenantId: string | undefined, currentBalance: number = 0) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pending-ach-payments', tenantId],
    queryFn: async () => {
      if (!tenantId) return { payments: [], totalPending: 0, effectiveBalance: currentBalance, count: 0 };

      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, created_at, payment_date, payment_method_type, status, stripe_status, notes')
        .eq('tenant_id', tenantId)
        .eq('status', 'processing')
        .eq('payment_method_type', 'ach')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const payments = (data || []) as PendingACHPayment[];
      const totalPending = payments.reduce((sum, p) => sum + p.amount, 0);
      const effectiveBalance = currentBalance - totalPending;

      return {
        payments,
        totalPending,
        effectiveBalance,
        count: payments.length,
      } as PendingACHSummary;
    },
    enabled: !!tenantId,
  });

  // Real-time subscription to update when payment status changes
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(createRealtimeChannelName('pending-ach-all', tenantId))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-ach-payments', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['pending-ach-payment', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['payments'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return {
    pendingPayments: query.data?.payments || [],
    totalPending: query.data?.totalPending || 0,
    effectiveBalance: query.data?.effectiveBalance ?? currentBalance,
    count: query.data?.count || 0,
    hasPendingACH: (query.data?.count || 0) > 0,
    isLoading: query.isLoading,
    ...query,
  };
}
