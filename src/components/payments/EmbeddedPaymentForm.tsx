import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';

interface EmbeddedPaymentFormProps {
  amount: number; // In dollars (final amount including fees)
  convenienceFee: number; // In dollars
  onSuccess: () => void;
  onError: (message: string) => void;
  returnUrl: string;
}

export function EmbeddedPaymentForm({
  amount,
  convenienceFee,
  onSuccess,
  onError,
  returnUrl,
}: EmbeddedPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
      });

      if (error) {
        // This will only be reached if there's an immediate error
        // (e.g., payment declined). Otherwise, the redirect happens.
        if (error.type === 'card_error' || error.type === 'validation_error') {
          onError(error.message || 'Payment failed');
        } else {
          onError('An unexpected error occurred');
        }
      } else {
        // This won't typically be reached as confirmPayment redirects
        onSuccess();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement 
        options={{
          layout: 'tabs',
        }}
      />
      
      {/* Amount Summary */}
      <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
        {convenienceFee > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Convenience Fee</span>
            <span>${convenienceFee.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span>${amount.toFixed(2)}</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Pay ${amount.toFixed(2)}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your payment is secured by Stripe
      </p>
    </form>
  );
}
