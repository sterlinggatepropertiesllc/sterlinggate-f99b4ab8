import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PaymentMethodSelector, PaymentMethodType } from './PaymentMethodSelector';
import { StripeProvider } from './StripeProvider';
import { EmbeddedPaymentForm } from './EmbeddedPaymentForm';
import { useEmbeddedPayment } from '@/hooks/useEmbeddedPayment';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  DollarSign, 
  Home,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';

interface RentPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  leaseId?: string | null;
  propertyId?: string;
  tenantId?: string;
  amount: number; // In dollars
  paymentType: 'rent' | 'security_deposit';
  onSuccess?: () => void;
}

type PaymentStep = 'method' | 'payment' | 'processing' | 'success';

export function RentPaymentDialog({
  open,
  onClose,
  leaseId,
  propertyId,
  tenantId,
  amount,
  paymentType,
  onSuccess,
}: RentPaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [finalAmount, setFinalAmount] = useState<number>(amount);
  const [convenienceFee, setConvenienceFee] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  const { createPaymentIntent, isCreating } = useEmbeddedPayment();

  const label = paymentType === 'security_deposit' ? 'Security Deposit' : 'Rent';

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('method');
      setSelectedMethod(null);
      setClientSecret(null);
      setFinalAmount(amount);
      setConvenienceFee(0);
      setError(null);
    }
  }, [open, amount]);

  // Fetch publishable key on mount
  useEffect(() => {
    const fetchPublishableKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-stripe-publishable-key');
        if (error) throw error;
        setPublishableKey(data.publishableKey);
      } catch (err) {
        console.error('Failed to get Stripe publishable key:', err);
      }
    };
    
    if (open && !publishableKey) {
      fetchPublishableKey();
    }
  }, [open, publishableKey]);

  const handleProceedToPayment = async () => {
    if (!selectedMethod) return;

    setStep('processing');
    setError(null);

    try {
      const amountInCents = Math.round(amount * 100);
      
      let result;
      if (leaseId) {
        result = await createPaymentIntent({
          payment_type: paymentType,
          lease_id: leaseId,
          amount: amountInCents,
          payment_method: selectedMethod,
        });
      } else if (tenantId) {
        result = await createPaymentIntent({
          payment_type: 'balance',
          tenant_id: tenantId,
          amount: amountInCents,
          payment_method: selectedMethod,
        });
      } else {
        throw new Error('Unable to process payment: missing payment context');
      }

      if (result) {
        setClientSecret(result.clientSecret);
        setFinalAmount(result.amount / 100); // Convert back to dollars
        setConvenienceFee(result.convenienceFee / 100);
        setStep('payment');
      } else {
        throw new Error('Failed to create payment intent');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize payment';
      setError(message);
      setStep('method');
    }
  };

  const handlePaymentSuccess = () => {
    setStep('success');
    onSuccess?.();
  };

  const handlePaymentError = (message: string) => {
    setError(message);
    setStep('method');
    setClientSecret(null);
  };

  const handleBack = () => {
    setStep('method');
    setSelectedMethod(null);
    setClientSecret(null);
  };

  const returnUrl = `${window.location.origin}/payment-success`;

  const renderContent = () => {
    // Processing state
    if (step === 'processing' || isCreating) {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Preparing payment...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we set up your secure payment
            </p>
          </div>
        </div>
      );
    }

    // Success state
    if (step === 'success') {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Payment Successful!</h3>
            <p className="text-sm text-muted-foreground">
              Your {label.toLowerCase()} payment has been processed.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      );
    }

    // Embedded payment form step
    if (step === 'payment' && clientSecret && publishableKey) {
      return (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <StripeProvider clientSecret={clientSecret} publishableKey={publishableKey}>
            <EmbeddedPaymentForm
              amount={finalAmount}
              convenienceFee={convenienceFee}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              returnUrl={returnUrl}
            />
          </StripeProvider>
        </div>
      );
    }

    // Method selection step
    return (
      <div className="space-y-6">
        {/* Payment Summary */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <DollarSign className="h-3 w-3 mr-1" />
              {amount.toLocaleString()}
            </Badge>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Payment Error</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Method Selection */}
        <PaymentMethodSelector
          selectedMethod={selectedMethod}
          onMethodSelect={setSelectedMethod}
          baseAmount={amount}
        />

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleProceedToPayment}
            disabled={!selectedMethod || isCreating || !publishableKey}
            className="flex-1"
          >
            Continue to Payment
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
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
            {step === 'method' && `Choose how you'd like to pay your ${label.toLowerCase()}`}
            {step === 'payment' && 'Enter your payment details'}
            {step === 'processing' && 'Setting up your payment...'}
            {step === 'success' && 'Payment complete!'}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
