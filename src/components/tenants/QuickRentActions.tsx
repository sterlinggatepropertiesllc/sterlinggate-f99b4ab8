import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useChargeRent, useRentCharges } from '@/hooks/useRentCharges';
import { format, startOfMonth, parseISO } from 'date-fns';
import { CalendarPlus, DollarSign, CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickRentActionsProps {
  tenantId: string;
  managerId: string;
  rentAmount: number | null;
}

export function QuickRentActions({ tenantId, managerId, rentAmount }: QuickRentActionsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Date | undefined>(startOfMonth(new Date()));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const chargeRent = useChargeRent();
  const { data: existingCharges } = useRentCharges(tenantId);

  const currentMonthStart = startOfMonth(new Date());
  const currentMonthCharged = existingCharges?.some(
    (charge) => parseISO(charge.rent_period).getTime() === currentMonthStart.getTime()
  );

  const selectedMonthCharged = selectedPeriod && existingCharges?.some(
    (charge) => parseISO(charge.rent_period).getTime() === startOfMonth(selectedPeriod).getTime()
  );

  const handleChargeCurrentMonth = () => {
    chargeRent.mutate({
      tenant_id: tenantId,
      created_by: managerId,
    });
  };

  const handleChargeSelectedMonth = () => {
    if (!selectedPeriod) return;
    
    chargeRent.mutate({
      tenant_id: tenantId,
      rent_period: format(startOfMonth(selectedPeriod), 'yyyy-MM-dd'),
      created_by: managerId,
    });
    setIsCalendarOpen(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <CalendarPlus className="h-4 w-4" /> Quick Rent Actions
      </p>

      <div className="flex flex-wrap gap-2">
        {/* Charge Current Month */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              disabled={currentMonthCharged || !rentAmount || chargeRent.isPending}
              className="text-xs"
            >
              {chargeRent.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <DollarSign className="h-3 w-3 mr-1" />
              )}
              {currentMonthCharged ? 'Already Charged' : `Charge ${format(new Date(), 'MMM')} Rent`}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Charge Monthly Rent?</AlertDialogTitle>
              <AlertDialogDescription>
                This will add a rent charge of <strong>${rentAmount?.toLocaleString()}</strong> for <strong>{format(new Date(), 'MMMM yyyy')}</strong> to the tenant's balance.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleChargeCurrentMonth}>
                Charge Rent
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Charge Specific Month */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              disabled={!rentAmount}
              className="text-xs"
            >
              <CalendarIcon className="h-3 w-3 mr-1" />
              Charge Other Month
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 border-b">
              <Label className="text-xs text-muted-foreground">Select month to charge</Label>
            </div>
            <Calendar
              mode="single"
              selected={selectedPeriod}
              onSelect={setSelectedPeriod}
              initialFocus
              className="p-3"
            />
            <div className="p-3 border-t space-y-2">
              {selectedPeriod && (
                <>
                  <p className="text-sm">
                    Charge <strong>${rentAmount?.toLocaleString()}</strong> for{' '}
                    <strong>{format(selectedPeriod, 'MMMM yyyy')}</strong>
                  </p>
                  {selectedMonthCharged ? (
                    <p className="text-xs text-destructive">
                      This month has already been charged
                    </p>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={handleChargeSelectedMonth}
                      disabled={chargeRent.isPending}
                    >
                      {chargeRent.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Charge Rent
                    </Button>
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
