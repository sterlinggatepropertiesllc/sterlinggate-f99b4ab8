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

  // Mass Effect-inspired dark theme
  const appearance: Appearance = {
    theme: 'night',
    variables: {
      colorPrimary: '#00d4ff', // Mass Effect cyan
      colorBackground: '#0a0e1a', // Deep space black with blue tint
      colorText: '#e8f4fc', // Light blue-white
      colorTextSecondary: '#7db8d9', // Muted cyan
      colorDanger: '#ff6a00', // Mass Effect orange for errors
      fontFamily: 'system-ui, sans-serif',
      borderRadius: '6px',
      spacingUnit: '4px',
      colorTextPlaceholder: '#4a6b8a',
    },
    rules: {
      '.Input': {
        backgroundColor: '#0f1624',
        border: '1px solid #1a3350',
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
        padding: '12px',
        color: '#e8f4fc',
      },
      '.Input:focus': {
        border: '1px solid #00d4ff',
        boxShadow: '0 0 0 1px #00d4ff, 0 0 12px rgba(0, 212, 255, 0.25)',
      },
      '.Input:hover': {
        border: '1px solid #2a4a6a',
      },
      '.Label': {
        fontWeight: '500',
        marginBottom: '8px',
        color: '#7db8d9',
        textTransform: 'uppercase',
        fontSize: '11px',
        letterSpacing: '0.5px',
      },
      '.Tab': {
        backgroundColor: '#0f1624',
        border: '1px solid #1a3350',
        color: '#7db8d9',
      },
      '.Tab:hover': {
        backgroundColor: '#152030',
        border: '1px solid #2a4a6a',
      },
      '.Tab--selected': {
        backgroundColor: '#1a3350',
        border: '1px solid #00d4ff',
        color: '#00d4ff',
        boxShadow: '0 0 8px rgba(0, 212, 255, 0.2)',
      },
      '.TabIcon': {
        fill: '#7db8d9',
      },
      '.TabIcon--selected': {
        fill: '#00d4ff',
      },
      '.Block': {
        backgroundColor: '#0f1624',
        border: '1px solid #1a3350',
      },
      '.Error': {
        color: '#ff6a00',
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
