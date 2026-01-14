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
import { useStripeCheckout } from '@/hooks/useStripePayments';
import { PaymentMethodSelector, PaymentMethodType, usePaymentMethodSettings } from './PaymentMethodSelector';
import { 
  Loader2, 
  DollarSign, 
  CheckCircle2, 
  Wallet,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  currentBalance: number;
  rentAmount?: number;
  onSuccess?: () => void;
}

type PaymentStep = 'amount' | 'method' | 'processing' | 'success';

export function PaymentDialog({
  open,
  onClose,
  tenantId,
  currentBalance,
  rentAmount,
  onSuccess,
}: PaymentDialogProps) {
  const { payBalance, isLoading } = useStripeCheckout();
  const { settings: paymentMethodSettings, loading: settingsLoading } = usePaymentMethodSettings();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [step, setStep] = useState<PaymentStep>('amount');
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setCustomAmount('');
      setSelectedAmount(null);
      setSelectedMethod(null);
      setStep('amount');
      setError(null);
    }
  }, [open]);

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

    const result = await payBalance(tenantId, selectedAmount, selectedMethod);
    
    if (result.success) {
      setStep('success');
      onSuccess?.();
    } else {
      setError(result.error || 'Failed to create checkout session');
      setStep('method');
    }
  };

  const handleBack = () => {
    if (step === 'method') {
      setStep('amount');
      setSelectedAmount(null);
      setSelectedMethod(null);
    }
  };

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
            {step === 'processing' && 'Redirecting to secure checkout...'}
            {step === 'success' && 'Payment initiated successfully'}
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
                      disabled={isLoading || settingsLoading}
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
                        disabled={isLoading || settingsLoading}
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
                  disabled={isLoading || settingsLoading || !customAmount}
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
              ← Change amount
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
              disabled={!selectedMethod || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  Continue to Checkout
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

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-medium mb-1">Redirecting to checkout...</h3>
              <p className="text-sm text-muted-foreground">
                You'll be redirected to complete your payment securely
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-medium mb-1">Checkout Started!</h3>
              <p className="text-sm text-muted-foreground">
                A new tab has opened for you to complete your payment.
                <br />
                You can close this dialog.
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
