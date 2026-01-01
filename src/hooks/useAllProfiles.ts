import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Profile[];
    },
  });
}

export function useUnlinkedProfiles(managerId: string | undefined, existingTenantUserIds: string[]) {
  return useQuery({
    queryKey: ['profiles', 'unlinked', managerId, existingTenantUserIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter out users who are already tenants for this manager's properties
      const filtered = (data || []).filter(
        profile => !existingTenantUserIds.includes(profile.id)
      );
      
      return filtered as Profile[];
    },
    enabled: !!managerId,
  });
}
