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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEmbeddedPayment } from '@/hooks/useEmbeddedPayment';
import { StripeProvider } from './StripeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, 
  DollarSign, 
  CheckCircle2, 
  CreditCard,
  Wallet,
  AlertCircle
} from 'lucide-react';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  currentBalance: number;
  rentAmount?: number;
  onSuccess?: () => void;
}

function PaymentForm({
  amount,
  onSuccess,
  onClose,
}: {
  amount: number;
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
        console.error('[PaymentForm] confirmPayment error:', error);
        toast.error(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        console.log('[PaymentForm] Payment succeeded, verifying...');
        // Verify and record the payment
        const result = await verifyPayment(paymentIntent.id);
        
        if (result?.success) {
          setPaymentSuccess(true);
          toast.success('Payment successful!');
          onSuccess?.();
          
          // Close dialog after showing success
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          console.error('[PaymentForm] Verification failed:', result);
          toast.error('Payment processed but verification failed. Please contact support.');
        }
      }
    } catch (err) {
      console.error('[PaymentForm] Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Payment Successful!</h3>
        <p className="text-muted-foreground">
          ${(amount / 100).toFixed(2)} has been processed
        </p>
      </div>
    );
  }

  // Show loading state while Stripe is initializing
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
          <span className="text-sm text-muted-foreground">Amount to pay</span>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <DollarSign className="h-3 w-3 mr-1" />
            {(amount / 100).toFixed(2)}
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
            Pay ${(amount / 100).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

export function PaymentDialog({
  open,
  onClose,
  tenantId,
  currentBalance,
  rentAmount,
  onSuccess,
}: PaymentDialogProps) {
  const { createPaymentIntent, isCreating, error } = useEmbeddedPayment();
  const [customAmount, setCustomAmount] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  
  // Stripe publishable key state
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Fetch publishable key when clientSecret is available
  useEffect(() => {
    if (!clientSecret || publishableKey) return;

    const fetchPublishableKey = async () => {
      setKeyLoading(true);
      setKeyError(null);
      
      try {
        console.log('[PaymentDialog] Fetching publishable key...');
        const { data, error } = await supabase.functions.invoke('get-stripe-publishable-key');
        
        if (error) {
          console.error('[PaymentDialog] Error fetching key:', error);
          throw new Error(error.message || 'Failed to fetch payment configuration');
        }
        
        if (!data?.publishableKey) {
          throw new Error('Payment system not configured');
        }
        
        console.log('[PaymentDialog] Publishable key fetched successfully');
        setPublishableKey(data.publishableKey);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize payments';
        console.error('[PaymentDialog] Key fetch error:', message);
        setKeyError(message);
        toast.error(message);
      } finally {
        setKeyLoading(false);
      }
    };

    fetchPublishableKey();
  }, [clientSecret, publishableKey]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setSelectedAmount(null);
      setCustomAmount('');
      setPublishableKey(null);
      setKeyError(null);
    }
  }, [open]);

  const handleAmountSelect = async (amountInDollars: number) => {
    if (amountInDollars < 1) {
      toast.error('Minimum payment is $1.00');
      return;
    }

    const amountInCents = Math.round(amountInDollars * 100);
    setSelectedAmount(amountInCents);

    console.log('[PaymentDialog] Creating payment intent for amount:', amountInCents);
    const result = await createPaymentIntent({
      payment_type: 'balance',
      tenant_id: tenantId,
      amount: amountInCents,
    });

    if (result) {
      console.log('[PaymentDialog] Payment intent created successfully');
      setClientSecret(result.clientSecret);
    } else {
      console.error('[PaymentDialog] Failed to create payment intent');
    }
  };

  const handleCustomAmountSubmit = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error('Please enter a valid amount (minimum $1.00)');
      return;
    }
    handleAmountSelect(amount);
  };

  const handleBack = () => {
    setClientSecret(null);
    setSelectedAmount(null);
    setPublishableKey(null);
    setKeyError(null);
  };

  // Render payment form content
  const renderPaymentForm = () => {
    // Show key loading state
    if (keyLoading) {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Initializing payments...</h3>
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
            <Button variant="outline" onClick={handleBack}>
              Go Back
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
      <StripeProvider clientSecret={clientSecret!} publishableKey={publishableKey}>
        <PaymentForm
          amount={selectedAmount || 0}
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
            <Wallet className="h-5 w-5" />
            Make a Payment
          </DialogTitle>
          <DialogDescription>
            Pay any amount towards your balance
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!clientSecret ? (
          <div className="space-y-6">
            {/* Current Balance Display */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Balance</span>
                <span className={`text-2xl font-semibold ${currentBalance > 0 ? 'text-destructive' : 'text-success'}`}>
                  ${Math.abs(currentBalance).toFixed(2)}
                  {currentBalance < 0 && <span className="text-sm ml-1">(Credit)</span>}
                </span>
              </div>
            </div>

            {currentBalance > 0 && (
              <>
                {/* Quick Amount Buttons */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Quick Pay</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-start group"
                      onClick={() => handleAmountSelect(currentBalance)}
                      disabled={isCreating}
                    >
                      <span className="font-medium">Pay Full Balance</span>
                      <span className="text-sm text-muted-foreground group-hover:text-accent-foreground transition-colors">
                        ${currentBalance.toFixed(2)}
                      </span>
                    </Button>
                    {rentAmount && rentAmount > 0 && (
                      <Button
                        variant="outline"
                        className="h-auto py-3 flex flex-col items-start group"
                        onClick={() => handleAmountSelect(rentAmount)}
                        disabled={isCreating}
                      >
                        <span className="font-medium">Pay Rent Amount</span>
                        <span className="text-sm text-muted-foreground group-hover:text-accent-foreground transition-colors">
                          ${rentAmount.toFixed(2)}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground uppercase">or</span>
                  <Separator className="flex-1" />
                </div>
              </>
            )}

            {/* Custom Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="custom-amount">Custom Amount</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="custom-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  onClick={handleCustomAmountSubmit}
                  disabled={isCreating || !customAmount}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Continue'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum payment: $1.00
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mb-2"
            >
              ← Change amount
            </Button>
            
            {renderPaymentForm()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
