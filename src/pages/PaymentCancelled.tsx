import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, Home } from 'lucide-react';

export default function PaymentCancelled() {
  const [searchParams] = useSearchParams();
  const paymentType = searchParams.get('type');

  const getMessage = () => {
    switch (paymentType) {
      case 'application_fee':
        return 'Your application fee payment was cancelled. You can try again when you\'re ready.';
      case 'security_deposit':
        return 'Your security deposit payment was cancelled. You\'ll need to complete payment before signing your lease.';
      case 'rent':
        return 'Your rent payment was cancelled. You can try again from your tenant portal.';
      default:
        return 'Your payment was cancelled. No charges were made to your account.';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-4">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-serif">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{getMessage()}</p>
          
          <div className="flex gap-3 justify-center pt-4">
            <Link to="/tenant">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost">
                <Home className="h-4 w-4 mr-2" /> Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
