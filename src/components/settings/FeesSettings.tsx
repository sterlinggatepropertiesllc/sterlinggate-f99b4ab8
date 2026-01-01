import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useApplicationFee, useUpdateApplicationFee } from '@/hooks/useAppSettings';
import { Loader2 } from 'lucide-react';

export function FeesSettings() {
  const { data: applicationFee, isLoading } = useApplicationFee();
  const updateFee = useUpdateApplicationFee();
  const [feeAmount, setFeeAmount] = useState('');

  useEffect(() => {
    if (applicationFee) {
      // Convert cents to dollars for display
      setFeeAmount((applicationFee.amount / 100).toFixed(2));
    }
  }, [applicationFee]);

  const handleSave = () => {
    const amountInCents = Math.round(parseFloat(feeAmount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      return;
    }
    updateFee.mutate(amountInCents);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Payment Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure fees and payment amounts for your properties.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="application-fee">Application Fee (USD)</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <Input
              id="application-fee"
              type="number"
              step="0.01"
              min="0"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              placeholder="50.00"
              className="max-w-[150px]"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This is the non-refundable fee charged when tenants submit rental applications.
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={updateFee.isPending}
        >
          {updateFee.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
