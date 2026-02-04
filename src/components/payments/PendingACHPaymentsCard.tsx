import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, ChevronDown, Banknote, AlertCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { PendingACHPayment } from '@/hooks/usePendingACHPayments';

interface PendingACHPaymentsCardProps {
  payments: PendingACHPayment[];
  totalPending: number;
  effectiveBalance: number;
  currentBalance: number;
  variant?: 'tenant' | 'manager';
}

export function PendingACHPaymentsCard({
  payments,
  totalPending,
  effectiveBalance,
  currentBalance,
  variant = 'tenant',
}: PendingACHPaymentsCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (payments.length === 0) return null;

  const earliestPayment = payments.reduce((earliest, p) => 
    new Date(p.created_at) < new Date(earliest.created_at) ? p : earliest
  , payments[0]);

  const expectedClearDate = addDays(new Date(earliestPayment.created_at), 5);

  return (
    <Card className="border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-transparent">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardContent className="pt-4 pb-3">
          <CollapsibleTrigger asChild>
            <button className="w-full text-left cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">
                      {payments.length} ACH Payment{payments.length > 1 ? 's' : ''} Pending
                    </span>
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                      ${totalPending.toLocaleString()} total
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-1">
                    {payments.length > 1 
                      ? `$${payments[0].amount} × ${payments.length} payments`
                      : `$${totalPending.toLocaleString()}`
                    } • Initiated {format(new Date(earliestPayment.created_at), 'MMM d')}
                  </p>
                  
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Typically clears in 3-5 business days (by ~{format(expectedClearDate, 'MMM d')})
                  </p>

                  {variant === 'tenant' && (
                    <p className="text-xs text-primary mt-2 flex items-center gap-1 group-hover:underline">
                      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      {isOpen ? 'Hide' : 'View'} payment details
                    </p>
                  )}

                  {variant === 'manager' && (
                    <div className="mt-2 p-2 rounded-md bg-muted/50 text-sm">
                      <span className="text-muted-foreground">If all clear: </span>
                      <span className="font-medium text-foreground">${effectiveBalance.toLocaleString()} remaining</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Individual Payments
              </p>
              {payments.map((payment) => (
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">${payment.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                    Processing
                  </Badge>
                </div>
              ))}

              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Official Balance:</span>
                  <span className="font-medium">${currentBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending Payments:</span>
                  <span className="font-medium text-amber-600">-${totalPending.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold mt-1 pt-1 border-t border-border/30">
                  <span>Effective Balance:</span>
                  <span className={effectiveBalance > 0 ? 'text-destructive' : 'text-success'}>
                    ${Math.abs(effectiveBalance).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
