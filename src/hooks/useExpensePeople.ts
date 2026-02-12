import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExpensePerson {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export function useExpensePeople() {
  return useQuery({
    queryKey: ['expense-people'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_people')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as ExpensePerson[];
    },
  });
}

export function useCreateExpensePerson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('expense_people')
        .insert({ name, created_by: user.id })
        .select()
        .single();

      if (error) throw error;
      return data as ExpensePerson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-people'] });
    },
    onError: (error) => {
      toast.error(`Failed to add person: ${error.message}`);
    },
  });
}
