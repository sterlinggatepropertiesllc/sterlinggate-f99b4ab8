import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle, Home, FileText, ClipboardList } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const paymentType = searchParams.get('type');
  
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<{ amount: number } | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setVerifying(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId },
        });

        if (error) throw error;

        if (data.success) {
          setVerified(true);
          setPaymentDetails({ amount: data.amount });
        } else {
          throw new Error('Payment verification failed');
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError(err instanceof Error ? err.message : 'Failed to verify payment');
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [sessionId]);

  const getPaymentTitle = () => {
    switch (paymentType) {
      case 'application_fee':
        return 'Application Fee Paid';
      case 'security_deposit':
        return 'Security Deposit Paid';
      case 'rent':
        return 'Rent Payment Complete';
      default:
        return 'Payment Successful';
    }
  };

  const getPaymentMessage = () => {
    switch (paymentType) {
      case 'application_fee':
        return 'Your application fee has been processed. You can now complete your rental application.';
      case 'security_deposit':
        return 'Your security deposit has been received. You can now proceed with signing your lease.';
      case 'rent':
        return 'Your rent payment has been processed successfully.';
      default:
        return 'Your payment has been processed successfully.';
    }
  };

  const getNextAction = () => {
    switch (paymentType) {
      case 'application_fee':
        return { label: 'View Applications', href: '/tenant', icon: ClipboardList };
      case 'security_deposit':
      case 'rent':
        return { label: 'View Leases', href: '/tenant', icon: FileText };
      default:
        return { label: 'Go to Portal', href: '/tenant', icon: Home };
    }
  };

  const nextAction = getNextAction();

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
              <Link to="/tenant">
                <Button variant="outline">
                  <Home className="h-4 w-4 mr-2" /> Go to Portal
                </Button>
              </Link>
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
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
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

          <div className="flex gap-3 justify-center pt-4">
            <Link to={nextAction.href}>
              <Button size="lg">
                <nextAction.icon className="h-4 w-4 mr-2" />
                {nextAction.label}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
