import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe, Appearance } from '@stripe/stripe-js';
import { ReactNode, useMemo } from 'react';

interface StripeProviderProps {
  children: ReactNode;
  clientSecret: string;
  publishableKey: string;
}

export function StripeProvider({ children, clientSecret, publishableKey }: StripeProviderProps) {
  // Memoize the Stripe promise to prevent re-creating on every render
  const stripePromise = useMemo(() => {
    if (!publishableKey) {
      console.error('[StripeProvider] No publishable key provided');
      return null;
    }
    console.log('[StripeProvider] Initializing Stripe with key');
    return loadStripe(publishableKey);
  }, [publishableKey]);

  const appearance: Appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: 'hsl(222.2, 47.4%, 11.2%)',
      colorBackground: 'hsl(0, 0%, 100%)',
      colorText: 'hsl(222.2, 84%, 4.9%)',
      colorDanger: 'hsl(0, 84.2%, 60.2%)',
      fontFamily: 'system-ui, sans-serif',
      borderRadius: '8px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        border: '1px solid hsl(214.3, 31.8%, 91.4%)',
        boxShadow: 'none',
        padding: '12px',
      },
      '.Input:focus': {
        border: '1px solid hsl(222.2, 47.4%, 11.2%)',
        boxShadow: '0 0 0 1px hsl(222.2, 47.4%, 11.2%)',
      },
      '.Label': {
        fontWeight: '500',
        marginBottom: '8px',
      },
    },
  };

  const options = {
    clientSecret,
    appearance,
  };

  if (!stripePromise) {
    return null;
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
