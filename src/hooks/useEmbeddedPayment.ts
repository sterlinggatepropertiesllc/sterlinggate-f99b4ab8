import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type PaymentType = 'application_fee' | 'security_deposit' | 'rent' | 'balance';

interface CreatePaymentIntentOptions {
  payment_type: PaymentType;
  property_id?: string;
  lease_id?: string;
  tenant_id?: string;
  amount: number; // In cents
}

interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

export function useEmbeddedPayment() {
  const [isCreating, setIsCreating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPaymentIntent = useCallback(async (
    options: CreatePaymentIntentOptions
  ): Promise<PaymentIntentResult | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: options,
      });

      if (error) throw error;

      if (!data?.clientSecret) {
        throw new Error('No client secret received');
      }

      return {
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create payment intent';
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const verifyPayment = useCallback(async (paymentIntentId: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-payment-intent', {
        body: { payment_intent_id: paymentIntentId },
      });

      if (error) throw error;

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify payment';
      setError(message);
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  return {
    createPaymentIntent,
    verifyPayment,
    isCreating,
    isVerifying,
    isLoading: isCreating || isVerifying,
    error,
  };
}
