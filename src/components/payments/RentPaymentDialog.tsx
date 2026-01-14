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
import { useStripeCheckout } from '@/hooks/useStripePayments';
import { 
  Loader2, 
  DollarSign, 
  Home,
  AlertCircle,
  ArrowRight,
  ArrowLeft
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

type PaymentStep = 'method' | 'processing';

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
  const { isLoading, payRent, paySecurityDeposit, payBalance } = useStripeCheckout();
  const [error, setError] = useState<string | null>(null);

  const label = paymentType === 'security_deposit' ? 'Security Deposit' : 'Rent';

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('method');
      setSelectedMethod(null);
      setError(null);
    }
  }, [open]);

  const handleProceedToCheckout = async () => {
    if (!selectedMethod) return;

    setStep('processing');
    setError(null);

    try {
      let result;

      if (leaseId) {
        // Lease-based payment
        if (paymentType === 'security_deposit') {
          result = await paySecurityDeposit(leaseId, amount, selectedMethod);
        } else {
          result = await payRent(leaseId, amount, selectedMethod);
        }
      } else if (tenantId) {
        // Balance-based payment (no lease)
        result = await payBalance(tenantId, amount, selectedMethod);
      } else {
        throw new Error('Unable to process payment: missing payment context');
      }

      if (result?.success) {
        // Checkout URL opened - close dialog
        onSuccess?.();
        onClose();
      } else if (result?.error) {
        setError(result.error);
        setStep('method');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create checkout';
      setError(message);
      setStep('method');
    }
  };

  const renderContent = () => {
    // Processing state
    if (step === 'processing' || isLoading) {
      return (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium mb-1">Preparing checkout...</h3>
            <p className="text-sm text-muted-foreground">
              You'll be redirected to complete your payment securely
            </p>
          </div>
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
            onClick={handleProceedToCheckout}
            disabled={!selectedMethod || isLoading}
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
            Choose how you'd like to pay your {label.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
