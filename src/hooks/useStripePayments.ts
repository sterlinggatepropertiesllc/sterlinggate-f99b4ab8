import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PaymentType = 'application_fee' | 'security_deposit' | 'rent' | 'balance';
type PaymentMethodType = 'ach' | 'card';

interface CreateCheckoutOptions {
  payment_type: PaymentType;
  payment_method?: PaymentMethodType;
  property_id?: string;
  lease_id?: string;
  tenant_id?: string;
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
        // Check if we're in an iframe (Lovable preview) - Stripe doesn't work in iframes
        const isInIframe = window.self !== window.top;
        if (isInIframe) {
          // Open in new tab when in iframe
          window.open(data.url, '_blank');
        } else {
          // Redirect in same tab when in standalone browser
          window.location.href = data.url;
        }
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

  const paySecurityDeposit = async (leaseId: string, amountInDollars: number, paymentMethod?: PaymentMethodType) => {
    return createCheckout({
      payment_type: 'security_deposit',
      payment_method: paymentMethod,
      lease_id: leaseId,
      amount: Math.round(amountInDollars * 100), // Convert to cents
    });
  };

  const payRent = async (leaseId: string, amountInDollars: number, paymentMethod?: PaymentMethodType) => {
    return createCheckout({
      payment_type: 'rent',
      payment_method: paymentMethod,
      lease_id: leaseId,
      amount: Math.round(amountInDollars * 100), // Convert to cents
    });
  };

  const payBalance = async (tenantId: string, amountInDollars: number, paymentMethod?: PaymentMethodType) => {
    return createCheckout({
      payment_type: 'balance',
      payment_method: paymentMethod,
      tenant_id: tenantId,
      amount: Math.round(amountInDollars * 100), // Convert to cents
    });
  };

  return {
    isLoading,
    createCheckout,
    payApplicationFee,
    paySecurityDeposit,
    payRent,
    payBalance,
  };
}
