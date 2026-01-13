import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUpdateLease } from '@/hooks/useLeases';
import { cn } from '@/lib/utils';
import { format, parse } from 'date-fns';
import { toast } from 'sonner';
import { CalendarIcon, DollarSign, Loader2 } from 'lucide-react';

interface LeaseData {
  id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  properties?: {
    address: string;
  } | null;
  tenant?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface EditLeaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease: LeaseData | null;
}

export function EditLeaseDialog({ open, onOpenChange, lease }: EditLeaseDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [monthlyRent, setMonthlyRent] = useState<string>('');
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const updateLease = useUpdateLease();

  // Initialize form when dialog opens
  useEffect(() => {
    if (open && lease) {
      setStartDate(lease.start_date ? parse(lease.start_date, 'yyyy-MM-dd', new Date()) : undefined);
      setEndDate(lease.end_date ? parse(lease.end_date, 'yyyy-MM-dd', new Date()) : undefined);
      setMonthlyRent(lease.monthly_rent?.toString() || '');
    }
  }, [open, lease]);

  const handleSave = async () => {
    if (!lease) return;

    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (endDate <= startDate) {
      toast.error('End date must be after start date');
      return;
    }

    const rentValue = parseFloat(monthlyRent);
    if (isNaN(rentValue) || rentValue <= 0) {
      toast.error('Please enter a valid rent amount');
      return;
    }

    try {
      await updateLease.mutateAsync({
        id: lease.id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        monthly_rent: rentValue,
      });

      toast.success('Lease updated successfully');
      onOpenChange(false);
    } catch (error) {
      // Error toast is handled by the hook
    }
  };

  if (!lease) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Edit Lease</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {lease.properties?.address} • {lease.tenant?.full_name || lease.tenant?.email}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Monthly Rent */}
          <div className="space-y-2">
            <Label htmlFor="monthly-rent">Monthly Rent</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="monthly-rent"
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                className="pl-9"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Lease Start Date */}
          <div className="space-y-2">
            <Label>Lease Start Date</Label>
            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Select start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    setStartDateOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Lease End Date */}
          <div className="space-y-2">
            <Label>Lease End Date</Label>
            <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Select end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date);
                    setEndDateOpen(false);
                  }}
                  disabled={(date) => startDate ? date <= startDate : false}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateLease.isPending}
            className="btn-platinum"
          >
            {updateLease.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
