import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PropertyManager {
  id: string;
  full_name: string | null;
  email: string;
  property_address?: string;
  property_id?: string;
}

export function useMyPropertyManagers(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-property-managers', userId],
    queryFn: async (): Promise<PropertyManager[]> => {
      if (!userId) return [];

      // Get managers from active tenancies
      const { data: tenantManagers } = await supabase
        .from('tenants')
        .select(`
          property_id,
          properties!inner (
            id,
            address,
            manager_id,
            profiles:manager_id (
              id,
              full_name,
              email
            )
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      // Get managers from leases
      const { data: leaseManagers } = await supabase
        .from('leases')
        .select(`
          property_id,
          manager_id,
          properties!inner (
            id,
            address
          )
        `)
        .eq('tenant_id', userId);

      const managersMap = new Map<string, PropertyManager>();

      // Process tenant managers
      if (tenantManagers) {
        tenantManagers.forEach((t: any) => {
          const profile = t.properties?.profiles;
          if (profile) {
            if (!managersMap.has(profile.id)) {
              managersMap.set(profile.id, {
                id: profile.id,
                full_name: profile.full_name,
                email: profile.email,
                property_address: t.properties?.address,
                property_id: t.properties?.id,
              });
            }
          }
        });
      }

      // Process lease managers (fetch their profiles separately)
      if (leaseManagers && leaseManagers.length > 0) {
        const managerIds = [...new Set(leaseManagers.map((l: any) => l.manager_id))];
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', managerIds);

        if (profiles) {
          leaseManagers.forEach((l: any) => {
            const profile = profiles.find((p) => p.id === l.manager_id);
            if (profile && !managersMap.has(profile.id)) {
              managersMap.set(profile.id, {
                id: profile.id,
                full_name: profile.full_name,
                email: profile.email,
                property_address: l.properties?.address,
                property_id: l.properties?.id,
              });
            }
          });
        }
      }

      return Array.from(managersMap.values());
    },
    enabled: !!userId,
  });
}
