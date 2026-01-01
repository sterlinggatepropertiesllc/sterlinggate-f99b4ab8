import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Lease = Database['public']['Tables']['leases']['Row'];
type LeaseInsert = Database['public']['Tables']['leases']['Insert'];

export function useLeases(userId: string | undefined, role: string | null) {
  return useQuery({
    queryKey: ['leases', userId, role],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('leases')
        .select(`
          *,
          properties:property_id (
            id,
            address,
            city,
            state
          ),
          tenant:tenant_id (
            id,
            email,
            full_name
          ),
          signatures (
            id,
            signer_id,
            signed_at,
            hash_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useLease(id: string | undefined) {
  return useQuery({
    queryKey: ['leases', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('leases')
        .select(`
          *,
          properties:property_id (
            id,
            address,
            city,
            state,
            rent_amount
          ),
          tenant:tenant_id (
            id,
            email,
            full_name
          ),
          manager:manager_id (
            id,
            email,
            full_name
          ),
          signatures (
            id,
            signer_id,
            signature_data,
            signature_type,
            hash_id,
            signed_at,
            ip_address
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateLease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lease: LeaseInsert) => {
      const { data, error } = await supabase
        .from('leases')
        .insert(lease)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Lease created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create lease: ${error.message}`);
    },
  });
}

export function useUpdateLease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lease> & { id: string }) => {
      const { data, error } = await supabase
        .from('leases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
    },
    onError: (error) => {
      toast.error(`Failed to update lease: ${error.message}`);
    },
  });
}
