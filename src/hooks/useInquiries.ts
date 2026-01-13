import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Inquiry {
  id: string;
  property_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  manager_id: string;
  created_at: string;
  responded_at: string | null;
  manager_notes: string | null;
  property?: {
    address: string;
    city: string;
    state: string;
  };
}

export function useInquiries(managerId: string | undefined) {
  return useQuery({
    queryKey: ['inquiries', managerId],
    queryFn: async () => {
      if (!managerId) return [];
      
      const { data, error } = await supabase
        .from('inquiries')
        .select(`
          *,
          property:properties(address, city, state)
        `)
        .eq('manager_id', managerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Inquiry[];
    },
    enabled: !!managerId,
  });
}

export function useUnreadInquiriesCount(managerId: string | undefined) {
  return useQuery({
    queryKey: ['inquiries', 'unread', managerId],
    queryFn: async () => {
      if (!managerId) return 0;
      
      const { count, error } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('manager_id', managerId)
        .eq('status', 'new');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!managerId,
  });
}

export function useCreateInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inquiry: {
      property_id: string;
      name: string;
      email: string;
      phone?: string;
      message: string;
      manager_id: string;
    }) => {
      const { data, error } = await supabase
        .from('inquiries')
        .insert(inquiry)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
    },
  });
}

export function useUpdateInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { 
      id: string; 
      status?: string;
      manager_notes?: string;
      responded_at?: string;
    }) => {
      const { data, error } = await supabase
        .from('inquiries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
    },
  });
}

export function useDeleteInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inquiries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
    },
  });
}
