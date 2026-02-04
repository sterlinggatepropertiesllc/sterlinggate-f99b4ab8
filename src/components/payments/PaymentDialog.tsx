import { useState, useEffect } from 'react';
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
import { PaymentMethodSelector, PaymentMethodType, usePaymentMethodSettings } from './PaymentMethodSelector';
import { StripeProvider } from './StripeProvider';
import { EmbeddedPaymentForm } from './EmbeddedPaymentForm';
import { useEmbeddedPayment } from '@/hooks/useEmbeddedPayment';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  DollarSign, 
  CheckCircle2, 
  Wallet,
  AlertCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  currentBalance: number;
  effectiveBalance?: number;
  rentAmount?: number;
  onSuccess?: () => void;
}

type PaymentStep = 'amount' | 'method' | 'payment' | 'processing' | 'success';

export function PaymentDialog({
  open,
  onClose,
  tenantId,
  currentBalance,
  effectiveBalance,
  rentAmount,
  onSuccess,
}: PaymentDialogProps) {
  // Use effective balance if provided, otherwise fall back to current balance
  const displayBalance = effectiveBalance !== undefined ? effectiveBalance : currentBalance;
  const hasPendingACH = effectiveBalance !== undefined && effectiveBalance !== currentBalance;
  const { createPaymentIntent, isCreating } = useEmbeddedPayment();
  const { settings: paymentMethodSettings, loading: settingsLoading } = usePaymentMethodSettings();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [step, setStep] = useState<PaymentStep>('amount');
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [finalAmount, setFinalAmount] = useState<number>(0);
  const [convenienceFee, setConvenienceFee] = useState<number>(0);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setCustomAmount('');
      setSelectedAmount(null);
      setSelectedMethod(null);
      setStep('amount');
      setError(null);
      setClientSecret(null);
      setFinalAmount(0);
      setConvenienceFee(0);
    }
  }, [open]);

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

  // Auto-select method if only one is available
  useEffect(() => {
    if (paymentMethodSettings && step === 'method') {
      const achEnabled = paymentMethodSettings.ach_enabled;
      const cardEnabled = paymentMethodSettings.card_enabled;
      
      if (achEnabled && !cardEnabled) {
        setSelectedMethod('ach');
      } else if (cardEnabled && !achEnabled) {
        setSelectedMethod('card');
      }
    }
  }, [paymentMethodSettings, step]);

  const handleAmountSelect = (amountInDollars: number) => {
    if (amountInDollars < 1) {
      setError('Minimum payment is $1.00');
      return;
    }
    setSelectedAmount(amountInDollars);
    setStep('method');
    setError(null);
  };

  const handleCustomAmountSubmit = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 1) {
      setError('Please enter a valid amount (minimum $1.00)');
      return;
    }
    handleAmountSelect(amount);
  };

  const handleMethodSelect = (method: PaymentMethodType) => {
    setSelectedMethod(method);
  };

  const handleProceedToPayment = async () => {
    if (!selectedAmount || !selectedMethod) return;

    setStep('processing');
    setError(null);

    try {
      const amountInCents = Math.round(selectedAmount * 100);
      
      const result = await createPaymentIntent({
        payment_type: 'balance',
        tenant_id: tenantId,
        amount: amountInCents,
        payment_method: selectedMethod,
      });

      if (result) {
        setClientSecret(result.clientSecret);
        setFinalAmount(result.amount / 100);
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
    if (step === 'method') {
      setStep('amount');
      setSelectedAmount(null);
      setSelectedMethod(null);
    } else if (step === 'payment') {
      setStep('method');
      setClientSecret(null);
    }
  };

  const returnUrl = `${window.location.origin}/payment-success`;

  // Calculate card fee for display
  const cardFeePercentage = paymentMethodSettings?.card_fee_percentage || 3;
  const cardFee = selectedAmount ? selectedAmount * (cardFeePercentage / 100) : 0;
  const totalWithFee = selectedAmount ? selectedAmount + cardFee : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Make a Payment
          </DialogTitle>
          <DialogDescription>
            {step === 'amount' && 'Choose an amount to pay'}
            {step === 'method' && 'Select your payment method'}
            {step === 'payment' && 'Enter your payment details'}
            {step === 'processing' && 'Setting up your payment...'}
            {step === 'success' && 'Payment complete!'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Amount Selection */}
        {step === 'amount' && (
          <div className="space-y-6">
            {/* Balance Display */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {hasPendingACH ? 'Remaining Balance' : 'Current Balance'}
                </span>
                <span className={`text-2xl font-semibold ${displayBalance > 0 ? 'text-destructive' : 'text-success'}`}>
                  ${Math.abs(displayBalance).toFixed(2)}
                  {displayBalance < 0 && <span className="text-sm ml-1">(Credit)</span>}
                </span>
              </div>
              {hasPendingACH && (
                <p className="text-xs text-muted-foreground mt-1">
                  Official balance: ${currentBalance.toFixed(2)}
                </p>
              )}
            </div>

            {displayBalance > 0 && (
              <>
                {/* Quick Amount Buttons */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Quick Pay</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-start group"
                      onClick={() => handleAmountSelect(displayBalance)}
                      disabled={isCreating || settingsLoading}
                    >
                      <span className="font-medium">
                        {hasPendingACH ? 'Pay Remaining' : 'Pay Full Balance'}
                      </span>
                      <span className="text-sm text-muted-foreground group-hover:text-accent-foreground transition-colors">
                        ${displayBalance.toFixed(2)}
                      </span>
                    </Button>
                    {rentAmount && rentAmount > 0 && rentAmount !== displayBalance && (
                      <Button
                        variant="outline"
                        className="h-auto py-3 flex flex-col items-start group"
                        onClick={() => handleAmountSelect(rentAmount)}
                        disabled={isCreating || settingsLoading}
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
                  disabled={isCreating || settingsLoading || !customAmount}
                >
                  {settingsLoading ? (
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
        )}

        {/* Step 2: Payment Method Selection */}
        {step === 'method' && selectedAmount && (
          <div className="space-y-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Change amount
            </Button>

            {/* Amount Summary */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment Amount</span>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {selectedAmount.toFixed(2)}
                </Badge>
              </div>
            </div>

            {/* Payment Method Selector */}
            <PaymentMethodSelector
              selectedMethod={selectedMethod}
              onMethodSelect={handleMethodSelect}
              baseAmount={selectedAmount}
            />

            {/* Proceed Button */}
            <Button
              onClick={handleProceedToPayment}
              className="w-full"
              size="lg"
              disabled={!selectedMethod || isCreating || !publishableKey}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  Continue to Payment
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            {selectedMethod === 'card' && (
              <p className="text-xs text-center text-muted-foreground">
                Total with fee: ${totalWithFee.toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* Step 3: Embedded Payment Form */}
        {step === 'payment' && clientSecret && publishableKey && (
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
        )}

        {/* Step 4: Processing */}
        {step === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-medium mb-1">Preparing payment...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we set up your secure payment
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-medium mb-1">Payment Successful!</h3>
              <p className="text-sm text-muted-foreground">
                Your payment has been processed successfully.
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
