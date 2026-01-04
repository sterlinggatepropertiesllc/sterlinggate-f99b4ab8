import { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEmbeddedPayment } from '@/hooks/useEmbeddedPayment';
import { StripeProvider } from './StripeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, 
  DollarSign, 
  CheckCircle2, 
  CreditCard,
  Home,
  AlertCircle
} from 'lucide-react';

interface RentPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  leaseId: string;
  amount: number; // In dollars
  paymentType: 'rent' | 'security_deposit';
  onSuccess?: () => void;
}

function PaymentForm({
  amount,
  paymentType,
  onSuccess,
  onClose,
}: {
  amount: number;
  paymentType: 'rent' | 'security_deposit';
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { verifyPayment, isVerifying } = useEmbeddedPayment();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('[RentPaymentForm] confirmPayment error:', error);
        toast.error(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        console.log('[RentPaymentForm] Payment succeeded, verifying...');
        const result = await verifyPayment(paymentIntent.id);
        
        if (result?.success) {
          setPaymentSuccess(true);
          toast.success('Payment successful!');
          onSuccess?.();
          
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          console.error('[RentPaymentForm] Verification failed:', result);
          toast.error('Payment processed but verification failed. Please contact support.');
        }
      }
    } catch (err) {
      console.error('[RentPaymentForm] Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const label = paymentType === 'security_deposit' ? 'Security Deposit' : 'Rent';

  if (paymentSuccess) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
        <p className="text-muted-foreground">
          Your {label.toLowerCase()} payment of ${amount.toLocaleString()} has been processed
        </p>
      </div>
    );
  }

  if (!stripe || !elements) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-medium mb-1">Loading payment form...</h3>
          <p className="text-sm text-muted-foreground">
            Please wait while we initialize the secure payment form
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <DollarSign className="h-3 w-3 mr-1" />
            {amount.toLocaleString()}
          </Badge>
        </div>
      </div>

      <PaymentElement />

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isProcessing || isVerifying}
      >
        {isProcessing || isVerifying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay ${amount.toLocaleString()}
          </>
        )}
      </Button>
    </form>
  );
}

export function RentPaymentDialog({
  open,
  onClose,
  leaseId,
  amount,
  paymentType,
  onSuccess,
}: RentPaymentDialogProps) {
  const { createPaymentIntent, isCreating, error } = useEmbeddedPayment();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const label = paymentType === 'security_deposit' ? 'Security Deposit' : 'Rent';

  // Create payment intent when dialog opens
  useEffect(() => {
    if (!open || !leaseId || amount <= 0) return;
    if (clientSecret) return; // Already created

    const initPayment = async () => {
      console.log('[RentPaymentDialog] Creating payment intent for:', { leaseId, amount, paymentType });
      const amountInCents = Math.round(amount * 100);
      
      const result = await createPaymentIntent({
        payment_type: paymentType,
        lease_id: leaseId,
        amount: amountInCents,
      });

      if (result) {
        console.log('[RentPaymentDialog] Payment intent created successfully');
        setClientSecret(result.clientSecret);
      } else {
        console.error('[RentPaymentDialog] Failed to create payment intent');
      }
    };

    initPayment();
  }, [open, leaseId, amount, paymentType, clientSecret, createPaymentIntent]);

  // Fetch publishable key when clientSecret is available
  useEffect(() => {
    if (!clientSecret || publishableKey) return;

    const fetchPublishableKey = async () => {
      setKeyLoading(true);
      setKeyError(null);
      
      try {
        console.log('[RentPaymentDialog] Fetching publishable key...');
        const { data, error } = await supabase.functions.invoke('get-stripe-publishable-key');
        
        if (error) {
          console.error('[RentPaymentDialog] Error fetching key:', error);
          throw new Error(error.message || 'Failed to fetch payment configuration');
        }
        
        if (!data?.publishableKey) {
          throw new Error('Payment system not configured');
        }
        
        console.log('[RentPaymentDialog] Publishable key fetched successfully');
        setPublishableKey(data.publishableKey);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize payments';
        console.error('[RentPaymentDialog] Key fetch error:', message);
        setKeyError(message);
        toast.error(message);
      } finally {
        setKeyLoading(false);
      }
    };

    fetchPublishableKey();
  }, [clientSecret, publishableKey]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setPublishableKey(null);
      setKeyError(null);
    }
  }, [open]);

  const renderContent = () => {
    // Show creating state
    if (isCreating) {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Preparing payment...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we set up your payment
            </p>
          </div>
        </div>
      );
    }

    // Show error state
    if (error) {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Payment Error</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error}
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      );
    }

    // Show key loading state
    if (keyLoading || !clientSecret) {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Initializing payment...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we set up the secure payment form
            </p>
          </div>
        </div>
      );
    }

    // Show key error state
    if (keyError) {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Payment Setup Error</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {keyError}
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      );
    }

    // Wait for publishable key
    if (!publishableKey) {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Loading payment form...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we initialize the secure payment form
            </p>
          </div>
        </div>
      );
    }

    // Render Stripe form
    return (
      <StripeProvider clientSecret={clientSecret} publishableKey={publishableKey}>
        <PaymentForm
          amount={amount}
          paymentType={paymentType}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      </StripeProvider>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Pay {label}
          </DialogTitle>
          <DialogDescription>
            Complete your {label.toLowerCase()} payment securely
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
