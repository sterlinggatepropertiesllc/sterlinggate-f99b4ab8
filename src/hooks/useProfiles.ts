import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProfileWithRole {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'tenant' | 'property_manager' | null;
}

export function useTenantProfiles() {
  return useQuery({
    queryKey: ['profiles', 'tenants'],
    queryFn: async () => {
      // Get all users with tenant role
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'tenant');

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);

      // Get profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      return (profiles || []).map(p => ({
        ...p,
        role: 'tenant' as const,
      })) as ProfileWithRole[];
    },
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profiles', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
