import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Payment {
  id: string;
  tenant_id: string;
  property_id: string;
  lease_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  payment_type: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface PaymentInsert {
  tenant_id: string;
  property_id: string;
  lease_id?: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  status?: string;
  notes?: string;
}

export function usePayments(propertyId?: string, tenantId?: string) {
  return useQuery({
    queryKey: ['payments', { propertyId, tenantId }],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Payment[];
    },
  });
}

export function usePaymentsByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['payments', 'dateRange', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useAllPayments() {
  return useQuery({
    queryKey: ['payments', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: PaymentInsert) => {
      const { data, error } = await supabase
        .from('payments')
        .insert(payment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete payment: ${error.message}`);
    },
  });
}
