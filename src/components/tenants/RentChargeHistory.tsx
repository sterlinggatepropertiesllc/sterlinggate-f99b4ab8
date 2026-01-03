import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRentCharges, useApplyLateFee, useWaiveLateFee, useUpdateRentChargeStatus, type RentCharge } from '@/hooks/useRentCharges';
import { format, parseISO } from 'date-fns';
import { Receipt, ChevronDown, ChevronUp, AlertTriangle, Clock, CheckCircle, XCircle, Gavel, Ban } from 'lucide-react';

interface RentChargeHistoryProps {
  tenantId: string;
  managerId: string;
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', icon: Clock, variant: 'outline' },
  paid: { label: 'Paid', icon: CheckCircle, variant: 'secondary' },
  partial: { label: 'Partial', icon: AlertTriangle, variant: 'default' },
  overdue: { label: 'Overdue', icon: XCircle, variant: 'destructive' },
};

export function RentChargeHistory({ tenantId, managerId }: RentChargeHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: rentCharges, isLoading } = useRentCharges(tenantId);
  const applyLateFee = useApplyLateFee();
  const waiveLateFee = useWaiveLateFee();
  const updateStatus = useUpdateRentChargeStatus();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const handleApplyLateFee = (charge: RentCharge) => {
    applyLateFee.mutate({
      rent_charge_id: charge.id,
      tenant_id: tenantId,
      created_by: managerId,
    });
  };

  const handleWaiveLateFee = (charge: RentCharge) => {
    waiveLateFee.mutate({
      rent_charge_id: charge.id,
      tenant_id: tenantId,
      waived_by: managerId,
    });
  };

  const handleStatusChange = (charge: RentCharge, newStatus: string) => {
    updateStatus.mutate({
      id: charge.id,
      status: newStatus,
      tenant_id: tenantId,
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Rent Charge History
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : rentCharges && rentCharges.length > 0 ? (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {rentCharges.map((charge) => {
              const status = statusConfig[charge.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const canApplyLateFee = !charge.late_fee_applied && !charge.late_fee_waived && charge.status === 'pending';
              
              return (
                <div 
                  key={charge.id} 
                  className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border/30"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {format(parseISO(charge.rent_period), 'MMMM yyyy')}
                      </span>
                      <Badge variant={status.variant} className="text-xs">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <span className="font-semibold">
                      {formatCurrency(charge.rent_amount)}
                    </span>
                  </div>

                  {/* Late fee info */}
                  {charge.late_fee_applied && (
                    <div className="flex items-center justify-between text-sm bg-destructive/10 rounded px-2 py-1">
                      <span className="text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Late fee applied
                      </span>
                      <span className="text-destructive font-medium">
                        +{formatCurrency(charge.late_fee_amount)}
                      </span>
                    </div>
                  )}

                  {charge.late_fee_waived && (
                    <div className="flex items-center text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1">
                      <Ban className="h-3 w-3 mr-1" /> Late fee waived
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    {/* Status selector */}
                    <Select 
                      value={charge.status} 
                      onValueChange={(value) => handleStatusChange(charge, value)}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Late fee actions */}
                    {canApplyLateFee && (
                      <div className="flex items-center gap-1">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              <Gavel className="h-3 w-3 mr-1" /> Apply Late Fee
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Apply Late Fee?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will calculate and apply the late fee based on the lease terms for {format(parseISO(charge.rent_period), 'MMMM yyyy')} rent.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleApplyLateFee(charge)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Apply Late Fee
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Ban className="h-3 w-3 mr-1" /> Waive
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Waive Late Fee?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will mark the late fee as waived for {format(parseISO(charge.rent_period), 'MMMM yyyy')} rent. No late fee will be applied.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleWaiveLateFee(charge)}>
                                Waive Late Fee
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No rent charges yet</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
