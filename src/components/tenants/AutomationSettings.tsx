import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Settings, ChevronDown, ChevronUp, Zap, Calendar, Percent, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface AutomationSettingsProps {
  tenantId: string;
  autoChargeRent: boolean;
  autoApplyLateFees: boolean;
  leaseInfo?: {
    rentDueDay?: number;
    gracePeriodDays?: number;
    lateFeeType?: string;
    lateFeePercentage?: number;
    lateFeeFlatAmount?: number;
    lateFeeDailyAmount?: number;
    lateFeeMaxAmount?: number;
    rentAmount?: number;
  } | null;
  onSettingsChange: (settings: { autoChargeRent: boolean; autoApplyLateFees: boolean }) => void;
}

export function AutomationSettings({
  tenantId,
  autoChargeRent,
  autoApplyLateFees,
  leaseInfo,
  onSettingsChange,
}: AutomationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState({
    autoChargeRent,
    autoApplyLateFees,
  });

  useEffect(() => {
    setLocalSettings({ autoChargeRent, autoApplyLateFees });
  }, [autoChargeRent, autoApplyLateFees]);

  const handleToggle = async (field: 'autoChargeRent' | 'autoApplyLateFees', value: boolean) => {
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          auto_charge_rent: newSettings.autoChargeRent,
          auto_apply_late_fees: newSettings.autoApplyLateFees,
        })
        .eq('id', tenantId);

      if (error) throw error;
      
      onSettingsChange({
        autoChargeRent: newSettings.autoChargeRent,
        autoApplyLateFees: newSettings.autoApplyLateFees,
      });
      toast.success('Automation settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
      setLocalSettings({ autoChargeRent, autoApplyLateFees });
    } finally {
      setIsSaving(false);
    }
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getLateAfterDay = () => {
    if (!leaseInfo) return null;
    const dueDay = leaseInfo.rentDueDay || 1;
    const graceDays = leaseInfo.gracePeriodDays || 5;
    const lateAfterDay = dueDay + graceDays;
    if (lateAfterDay > 28) return 'end of month';
    return `${lateAfterDay}${getOrdinalSuffix(lateAfterDay)}`;
  };

  const formatLateFeeInfo = () => {
    if (!leaseInfo) return 'No lease configured';
    const rentAmount = leaseInfo.rentAmount || 0;
    
    switch (leaseInfo.lateFeeType) {
      case 'percentage':
        const percentAmount = (rentAmount * (leaseInfo.lateFeePercentage || 5)) / 100;
        return rentAmount > 0 
          ? `$${percentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${leaseInfo.lateFeePercentage || 5}% of $${rentAmount.toLocaleString()} rent)`
          : `${leaseInfo.lateFeePercentage || 5}% of rent`;
      case 'flat':
        return `$${(leaseInfo.lateFeeFlatAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} flat fee`;
      case 'daily':
        const dailyAmount = leaseInfo.lateFeeDailyAmount || 0;
        const maxAmount = leaseInfo.lateFeeMaxAmount;
        return maxAmount 
          ? `$${dailyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day (max $${maxAmount.toLocaleString()})`
          : `$${dailyAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day`;
      default:
        const defaultAmount = (rentAmount * (leaseInfo.lateFeePercentage || 5)) / 100;
        return rentAmount > 0 
          ? `$${defaultAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${leaseInfo.lateFeePercentage || 5}% of $${rentAmount.toLocaleString()} rent)`
          : `${leaseInfo.lateFeePercentage || 5}% of rent`;
    }
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
            <Settings className="h-4 w-4" /> Automation Settings
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        {/* Auto-charge rent toggle */}
        <div className="flex items-start justify-between gap-4 bg-muted/30 rounded-lg p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <Label htmlFor="auto-charge-rent" className="font-medium">
                Auto-charge rent
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically add rent charge to balance on the 1st of each month
            </p>
          </div>
          <Switch
            id="auto-charge-rent"
            checked={localSettings.autoChargeRent}
            onCheckedChange={(value) => handleToggle('autoChargeRent', value)}
            disabled={isSaving}
          />
        </div>

        {/* Auto-apply late fees toggle */}
        <div className="flex items-start justify-between gap-4 bg-muted/30 rounded-lg p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <Label htmlFor="auto-late-fees" className="font-medium">
                Auto-apply late fees
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically apply late fee after grace period expires
            </p>
          </div>
          <Switch
            id="auto-late-fees"
            checked={localSettings.autoApplyLateFees}
            onCheckedChange={(value) => handleToggle('autoApplyLateFees', value)}
            disabled={isSaving}
          />
        </div>

        {/* Lease late fee configuration (read-only) */}
        {leaseInfo && (
          <div className="bg-accent/5 rounded-lg p-4 space-y-3 border border-border/50">
            <p className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Late Fee Configuration
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-destructive" />
                <span className="text-muted-foreground">Late after:</span>
                <Badge variant="outline" className="text-xs font-medium">
                  {getLateAfterDay()} of the month
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground ml-5">
                (Rent due: {leaseInfo.rentDueDay || 1}{getOrdinalSuffix(leaseInfo.rentDueDay || 1)} + {leaseInfo.gracePeriodDays || 5} day grace period)
              </div>
              <div className="flex items-center gap-2 mt-2">
                <DollarSign className="h-3 w-3 text-warning" />
                <span className="text-muted-foreground">Late fee:</span>
                <Badge variant="outline" className="text-xs font-medium">
                  {formatLateFeeInfo()}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
