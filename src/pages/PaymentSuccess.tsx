import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle, Home, RefreshCw, Clock } from 'lucide-react';

interface PaymentDetails {
  amount: number;
  isProcessing?: boolean;
  message?: string;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const paymentType = searchParams.get('type');
  
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setVerifying(false);
        return;
      }

      try {
        console.log('[PaymentSuccess] Calling verify-payment with session:', sessionId);
        
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId },
        });

        console.log('[PaymentSuccess] Response:', { data, error });

        if (error) throw error;

        if (data.success) {
          setVerified(true);
          setPaymentDetails({ 
            amount: data.amount,
            isProcessing: data.isProcessing || data.status === 'processing',
            message: data.message,
          });
        } else {
          throw new Error(data.error || 'Payment verification failed');
        }
      } catch (err) {
        console.error('[PaymentSuccess] Verification error:', err);
        setError(err instanceof Error ? err.message : 'Failed to verify payment');
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [sessionId]);

  // Auto-redirect countdown after successful verification
  useEffect(() => {
    if (!verified) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/tenant');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [verified, navigate]);

  const isProcessing = paymentDetails?.isProcessing;

  const getPaymentTitle = () => {
    if (isProcessing) {
      return 'Payment Submitted';
    }
    switch (paymentType) {
      case 'application_fee':
        return 'Application Fee Paid';
      case 'security_deposit':
        return 'Security Deposit Paid';
      case 'rent':
        return 'Rent Payment Complete';
      case 'balance':
        return 'Balance Payment Complete';
      default:
        return 'Payment Successful';
    }
  };

  const getPaymentMessage = () => {
    if (isProcessing) {
      return paymentDetails?.message || 
        'Your bank transfer is being processed. ACH payments typically take 4-5 business days to clear. Your balance will be updated automatically once the transfer completes.';
    }
    switch (paymentType) {
      case 'application_fee':
        return 'Your application fee has been processed. You can now complete your rental application.';
      case 'security_deposit':
        return 'Your security deposit has been received. You can now proceed with signing your lease.';
      case 'rent':
        return 'Your rent payment has been processed successfully.';
      case 'balance':
        return 'Your balance payment has been processed and your account has been updated.';
      default:
        return 'Your payment has been processed successfully.';
    }
  };

  const handleRetry = () => {
    setVerifying(true);
    setError(null);
    window.location.reload();
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-serif mb-2">Verifying Payment</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-serif mb-2">Verification Issue</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
              <Button onClick={() => navigate('/tenant')}>
                <Home className="h-4 w-4 mr-2" /> Go to Portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-4">
          {isProcessing ? (
            <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-10 w-10 text-warning" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
          )}
          <CardTitle className="text-2xl font-serif">{getPaymentTitle()}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{getPaymentMessage()}</p>
          
          {paymentDetails && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="text-2xl font-serif text-foreground">
                ${paymentDetails.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Redirecting to your portal in {countdown} seconds...
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Button size="lg" onClick={() => navigate('/tenant')}>
              <Home className="h-4 w-4 mr-2" />
              Go to Portal Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
