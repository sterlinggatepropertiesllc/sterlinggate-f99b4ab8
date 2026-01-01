import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Application = Database['public']['Tables']['applications']['Row'];
type ApplicationInsert = Database['public']['Tables']['applications']['Insert'];

export function useApplications(propertyManagerId?: string) {
  return useQuery({
    queryKey: ['applications', propertyManagerId],
    queryFn: async () => {
      let query = supabase
        .from('applications')
        .select(`
          *,
          properties:property_id (
            id,
            address,
            city,
            state,
            rent_amount
          ),
          profiles:applicant_id (
            id,
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMyApplications(userId: string | undefined) {
  return useQuery({
    queryKey: ['applications', 'my', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          properties:property_id (
            id,
            address,
            city,
            state,
            rent_amount,
            photos
          )
        `)
        .eq('applicant_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (application: ApplicationInsert) => {
      const { data, error } = await supabase
        .from('applications')
        .insert(application)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application submitted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to submit application: ${error.message}`);
    },
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Application> & { id: string }) => {
      const { data, error } = await supabase
        .from('applications')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: (error) => {
      toast.error(`Failed to update application: ${error.message}`);
    },
  });
}
