import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PropertyManager {
  id: string;
  full_name: string | null;
  email: string;
}

export function useAllPropertyManagers() {
  return useQuery({
    queryKey: ['all-property-managers'],
    queryFn: async (): Promise<PropertyManager[]> => {
      // Get all users with property_manager role
      const { data: managerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'property_manager');

      if (!managerRoles || managerRoles.length === 0) return [];

      const managerIds = managerRoles.map((r) => r.user_id);

      // Get their profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', managerIds);

      return profiles || [];
    },
  });
}
