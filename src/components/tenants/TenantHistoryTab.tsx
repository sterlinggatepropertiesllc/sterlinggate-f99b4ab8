import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, CreditCard, ArrowUp, ArrowDown } from 'lucide-react';
import { useRentCharges } from '@/hooks/useRentCharges';
import { useBalanceAdjustments } from '@/hooks/useBalanceAdjustments';
import { format } from 'date-fns';

interface TenantHistoryTabProps {
  tenantId: string;
}

export function TenantHistoryTab({ tenantId }: TenantHistoryTabProps) {
  const { data: rentCharges, isLoading: rentChargesLoading } = useRentCharges(tenantId);
  const { data: adjustments, isLoading: adjustmentsLoading } = useBalanceAdjustments(tenantId);

  const isLoading = rentChargesLoading || adjustmentsLoading;

  // Combine and sort all history items
  const historyItems = [
    ...(rentCharges || []).map((charge: any) => ({
      id: charge.id,
      type: 'rent_charge' as const,
      date: new Date(charge.charged_at || charge.created_at),
      data: charge,
    })),
    ...(adjustments || []).map((adj: any) => ({
      id: adj.id,
      type: 'adjustment' as const,
      date: new Date(adj.created_at),
      data: adj,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/10 text-success border-success">Paid</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-warning text-warning">Pending</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'partial':
        return <Badge variant="outline" className="border-primary text-primary">Partial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rent Charges Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rent Charge History</CardTitle>
          <CardDescription>All rent charges for this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          {rentCharges && rentCharges.length > 0 ? (
            <div className="space-y-3">
              {rentCharges.map((charge: any) => (
                <div 
                  key={charge.id} 
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10 transition-colors gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/20 shadow-sm shadow-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">Rent - {charge.rent_period}</p>
                        {getStatusBadge(charge.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Charged on {format(new Date(charge.charged_at || charge.created_at), 'MMM d, yyyy')}
                      </p>
                      {charge.late_fee_applied && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          <span className="text-sm text-warning">
                            Late fee: ${Number(charge.late_fee_amount).toLocaleString()}
                            {charge.late_fee_waived && ' (Waived)'}
                          </span>
                        </div>
                      )}
                      {charge.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{charge.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-13 md:ml-0">
                    <p className="text-lg font-semibold text-foreground">
                      ${Number(charge.rent_amount).toLocaleString()}
                    </p>
                    {charge.late_fee_applied && !charge.late_fee_waived && (
                      <p className="text-sm text-warning">
                        +${Number(charge.late_fee_amount).toLocaleString()} late fee
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20">
                <CreditCard className="h-8 w-8 text-primary/50" />
              </div>
              <p className="text-muted-foreground">No rent charges yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Complete Activity Timeline</CardTitle>
          <CardDescription>All transactions and adjustments in chronological order</CardDescription>
        </CardHeader>
        <CardContent>
          {historyItems.length > 0 ? (
            <div className="relative">
              {/* Timeline line - gradient */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-border to-transparent" />
              
              <div className="space-y-4">
                {historyItems.map((item, index) => {
                  const isDebit = item.type !== 'rent_charge' && ['charge', 'late_fee'].includes(item.data.adjustment_type);
                  const isCredit = item.type !== 'rent_charge' && !isDebit;
                  
                  return (
                    <div key={`${item.type}-${item.id}`} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-2 shadow-md ${
                        item.type === 'rent_charge' 
                          ? 'bg-gradient-to-br from-primary/20 to-primary/5 ring-primary/20 shadow-primary/10' 
                          : isDebit
                            ? 'bg-gradient-to-br from-destructive/20 to-destructive/5 ring-destructive/20 shadow-destructive/10'
                            : 'bg-gradient-to-br from-success/20 to-success/5 ring-success/20 shadow-success/10'
                      }`}>
                        {item.type === 'rent_charge' ? (
                          <CreditCard className="h-5 w-5 text-primary" />
                        ) : isDebit ? (
                          <ArrowUp className="h-5 w-5 text-destructive" />
                        ) : (
                          <ArrowDown className="h-5 w-5 text-success" />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-4 p-4 -mt-1 rounded-lg transition-colors ${
                        item.type === 'rent_charge'
                          ? 'bg-gradient-to-r from-primary/5 to-transparent hover:from-primary/10'
                          : isDebit
                            ? 'bg-gradient-to-r from-destructive/5 to-transparent hover:from-destructive/10'
                            : 'bg-gradient-to-r from-success/5 to-transparent hover:from-success/10'
                      }`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div>
                            {item.type === 'rent_charge' ? (
                              <>
                                <p className="font-medium text-foreground">
                                  Rent Charge - {item.data.rent_period}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {getStatusBadge(item.data.status)}
                                  {item.data.late_fee_applied && (
                                    <Badge variant="outline" className="border-warning text-warning bg-warning/5">
                                      Late Fee Applied
                                    </Badge>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="font-medium capitalize text-foreground">
                                  {item.data.adjustment_type.replace('_', ' ')}
                                </p>
                                {item.data.description && (
                                  <p className="text-sm text-muted-foreground">{item.data.description}</p>
                                )}
                              </>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(item.date, 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          <div className="text-right">
                            {item.type === 'rent_charge' ? (
                              <p className="font-semibold text-lg text-foreground">${Number(item.data.rent_amount).toLocaleString()}</p>
                            ) : (
                              <p className={`font-semibold text-lg ${isDebit ? 'text-destructive' : 'text-success'}`}>
                                {isDebit ? '+' : '-'}
                                ${Number(item.data.amount).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-muted/80 to-muted/30 flex items-center justify-center ring-2 ring-border">
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground">No activity history yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
