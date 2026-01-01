import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateSignatureParams {
  leaseId: string;
  signerId: string;
  signatureData: string;
  signatureType: 'draw' | 'type';
  ipAddress: string;
  userAgent: string;
}

async function generateDocumentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useCreateSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leaseId, signerId, signatureData, signatureType, ipAddress, userAgent }: CreateSignatureParams) => {
      // Generate hash for this signature
      const hashContent = `${leaseId}-${signerId}-${signatureData}-${new Date().toISOString()}`;
      const hashId = await generateDocumentHash(hashContent);

      const { data, error } = await supabase
        .from('signatures')
        .insert({
          lease_id: leaseId,
          signer_id: signerId,
          signature_data: signatureData,
          signature_type: signatureType,
          hash_id: hashId,
          ip_address: ipAddress,
          user_agent: userAgent,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Signature saved successfully');
    },
    onError: (error) => {
      toast.error(`Failed to save signature: ${error.message}`);
    },
  });
}

export async function getClientIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

export { generateDocumentHash };
