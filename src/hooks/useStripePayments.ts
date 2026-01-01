import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PaymentType = 'application_fee' | 'security_deposit' | 'rent';

interface CreateCheckoutOptions {
  payment_type: PaymentType;
  property_id?: string;
  lease_id?: string;
  amount?: number; // In cents
}

export function useStripeCheckout() {
  const [isLoading, setIsLoading] = useState(false);

  const createCheckout = async (options: CreateCheckoutOptions) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
        body: options,
      });

      if (error) throw error;

      if (data?.url) {
        // Open checkout in new tab
        window.open(data.url, '_blank');
        return { success: true, url: data.url };
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create checkout';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const payApplicationFee = async (propertyId: string) => {
    return createCheckout({
      payment_type: 'application_fee',
      property_id: propertyId,
    });
  };

  const paySecurityDeposit = async (leaseId: string, amountInDollars: number) => {
    return createCheckout({
      payment_type: 'security_deposit',
      lease_id: leaseId,
      amount: Math.round(amountInDollars * 100), // Convert to cents
    });
  };

  const payRent = async (leaseId: string, amountInDollars: number) => {
    return createCheckout({
      payment_type: 'rent',
      lease_id: leaseId,
      amount: Math.round(amountInDollars * 100), // Convert to cents
    });
  };

  return {
    isLoading,
    createCheckout,
    payApplicationFee,
    paySecurityDeposit,
    payRent,
  };
}
