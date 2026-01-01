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
      // Use secure RPC function to get property managers
      const { data, error } = await supabase.rpc('list_property_managers_for_messaging');

      if (error) {
        console.error('Error fetching property managers:', error);
        return [];
      }

      return data || [];
    },
  });
}
