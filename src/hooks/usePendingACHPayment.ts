import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PendingACHPayment {
  id: string;
  amount: number;
  created_at: string;
  payment_date: string;
  payment_method_type: string | null;
  status: string;
  notes: string | null;
}

export function usePendingACHPayment(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pending-ach-payment', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, created_at, payment_date, payment_method_type, status, notes')
        .eq('tenant_id', tenantId)
        .eq('status', 'processing')
        .eq('payment_method_type', 'ach')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as PendingACHPayment | null;
    },
    enabled: !!tenantId,
  });

  // Real-time subscription to update when payment status changes
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`pending-ach-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
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
    pendingPayment: query.data,
    hasPendingACH: !!query.data,
    isLoading: query.isLoading,
    ...query,
  };
}
