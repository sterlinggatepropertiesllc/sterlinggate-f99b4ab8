import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Lease = Database['public']['Tables']['leases']['Row'];
type LeaseInsert = Database['public']['Tables']['leases']['Insert'];

interface LeaseWithRelations extends Lease {
  properties?: {
    id: string;
    address: string;
    city: string;
    state: string;
    rent_amount?: number;
  } | null;
  tenant?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  manager?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  signatures?: Array<{
    id: string;
    signer_id: string;
    signed_at: string;
    hash_id: string;
    signature_data?: string;
    signature_type?: string;
    ip_address?: string | null;
  }>;
}

export function useLeases(userId: string | undefined, role: string | null) {
  return useQuery({
    queryKey: ['leases', userId, role],
    queryFn: async (): Promise<LeaseWithRelations[]> => {
      if (!userId) return [];
      
      // Use manual joins to avoid PostgREST ambiguous relationship issues
      // (both tenant_id and manager_id reference profiles table)
      return await fetchLeasesWithManualJoins(userId);
    },
    enabled: !!userId,
    retry: 1,
  });
}

// Manual joins to avoid PostgREST ambiguous relationship errors
async function fetchLeasesWithManualJoins(userId: string): Promise<LeaseWithRelations[]> {
  // 1. Fetch base leases
  const { data: leases, error: leasesError } = await supabase
    .from('leases')
    .select('*')
    .order('created_at', { ascending: false });

  if (leasesError) throw leasesError;
  if (!leases || leases.length === 0) return [];

  // 2. Get unique IDs for batch fetching
  const propertyIds = [...new Set(leases.map(l => l.property_id))];
  const tenantIds = [...new Set(leases.map(l => l.tenant_id))];
  const leaseIds = leases.map(l => l.id);

  // 3. Batch fetch related data in parallel
  const [propertiesResult, profilesResult, signaturesResult] = await Promise.all([
    supabase.from('properties').select('id, address, city, state, rent_amount').in('id', propertyIds),
    supabase.from('profiles').select('id, email, full_name').in('id', tenantIds),
    supabase.from('signatures').select('id, lease_id, signer_id, signed_at, hash_id').in('lease_id', leaseIds),
  ]);

  // 4. Create lookup maps
  const propertiesMap = new Map(propertiesResult.data?.map(p => [p.id, p]) || []);
  const profilesMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);
  const signaturesMap = new Map<string, typeof signaturesResult.data>();
  signaturesResult.data?.forEach(sig => {
    const existing = signaturesMap.get(sig.lease_id) || [];
    signaturesMap.set(sig.lease_id, [...existing, sig]);
  });

  // 5. Enrich leases with related data
  return leases.map(lease => ({
    ...lease,
    properties: propertiesMap.get(lease.property_id) || null,
    tenant: profilesMap.get(lease.tenant_id) || null,
    signatures: signaturesMap.get(lease.id) || [],
  }));
}

export function useLease(id: string | undefined) {
  return useQuery({
    queryKey: ['leases', id],
    queryFn: async (): Promise<LeaseWithRelations | null> => {
      if (!id) return null;
      return await fetchSingleLeaseWithManualJoins(id);
    },
    enabled: !!id,
  });
}

async function fetchSingleLeaseWithManualJoins(id: string): Promise<LeaseWithRelations | null> {
  const { data: lease, error } = await supabase
    .from('leases')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!lease) return null;

  const [propertyResult, tenantResult, managerResult, signaturesResult] = await Promise.all([
    supabase.from('properties').select('id, address, city, state, rent_amount').eq('id', lease.property_id).maybeSingle(),
    supabase.from('profiles').select('id, email, full_name').eq('id', lease.tenant_id).maybeSingle(),
    supabase.from('profiles').select('id, email, full_name').eq('id', lease.manager_id).maybeSingle(),
    supabase.from('signatures').select('id, signer_id, signature_data, signature_type, hash_id, signed_at, ip_address').eq('lease_id', lease.id),
  ]);

  return {
    ...lease,
    properties: propertyResult.data,
    tenant: tenantResult.data,
    manager: managerResult.data,
    signatures: signaturesResult.data || [],
  };
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
      // Immediately invalidate to refresh the list
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

export function useDeleteLease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaseId: string) => {
      // 1. Delete related signatures
      const { error: sigError } = await supabase
        .from('signatures')
        .delete()
        .eq('lease_id', leaseId);
      if (sigError) throw sigError;

      // 2. Delete related documents
      const { error: docError } = await supabase
        .from('documents')
        .delete()
        .eq('lease_id', leaseId);
      if (docError) throw docError;

      // 3. Set lease_id to NULL for payments (preserve financial records)
      const { error: payError } = await supabase
        .from('payments')
        .update({ lease_id: null })
        .eq('lease_id', leaseId);
      if (payError) throw payError;

      // 4. Delete the lease
      const { error } = await supabase
        .from('leases')
        .delete()
        .eq('id', leaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Lease deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete lease: ${error.message}`);
    },
  });
}
