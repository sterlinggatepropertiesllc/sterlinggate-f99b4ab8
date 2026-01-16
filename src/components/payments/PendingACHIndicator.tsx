import { Clock, Banknote, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { PendingACHPayment } from '@/hooks/usePendingACHPayment';

interface PendingACHIndicatorProps {
  payment: PendingACHPayment;
  variant?: 'card' | 'inline' | 'compact';
}

export function PendingACHIndicator({ payment, variant = 'card' }: PendingACHIndicatorProps) {
  const formattedAmount = `$${Number(payment.amount).toLocaleString()}`;
  const initiatedDate = format(new Date(payment.created_at), 'MMM d, yyyy');

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
        <Clock className="h-4 w-4 text-warning animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-warning">
            ACH Payment Pending: {formattedAmount}
          </p>
          <p className="text-xs text-muted-foreground">
            Initiated {initiatedDate} • Processing
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-warning/10 to-transparent border border-warning/30">
        <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
          <Banknote className="h-5 w-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">ACH Payment Processing</p>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
              <Clock className="h-3 w-3 mr-1 animate-pulse" />
              Pending
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formattedAmount} • Initiated {initiatedDate}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Bank transfers typically take 3-5 business days to clear
          </p>
        </div>
      </div>
    );
  }

  // Default 'card' variant
  return (
    <Card className="border-warning/30 bg-gradient-to-br from-warning/10 to-transparent overflow-hidden">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">ACH Payment</p>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                <Clock className="h-3 w-3 mr-1 animate-pulse" />
                Processing
              </Badge>
            </div>
            <p className="text-2xl md:text-3xl font-serif text-warning">
              {formattedAmount}
            </p>
            <div className="space-y-0.5 pt-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Initiated: {initiatedDate}
              </p>
              <p className="text-xs text-muted-foreground">
                Typically clears in 3-5 business days
              </p>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center ring-2 ring-warning/20">
            <Banknote className="h-6 w-6 text-warning" />
          </div>
        </div>
        
        <div className="mt-4 p-3 rounded-lg bg-warning/5 border border-warning/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Your bank transfer is being processed. Once cleared, your balance will be updated automatically.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
