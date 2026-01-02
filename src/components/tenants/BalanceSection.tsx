import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useBalanceAdjustments, useCreateBalanceAdjustment, calculateOverdueBalance } from '@/hooks/useBalanceAdjustments';
import { format, parseISO } from 'date-fns';
import { DollarSign, ChevronDown, ChevronUp, Clock, AlertTriangle, Plus, Minus } from 'lucide-react';

interface BalanceSectionProps {
  tenantId: string;
  currentBalance: number;
  rentAmount: number | null;
  leaseStartDate: string | null;
  managerId: string;
  onBalanceUpdate: () => void;
}

type AdjustmentType = 'credit' | 'charge' | 'late_fee' | 'payment' | 'correction';

const adjustmentTypeLabels: Record<AdjustmentType, { label: string; icon: typeof Plus; color: string }> = {
  charge: { label: 'Charge', icon: Plus, color: 'text-destructive' },
  late_fee: { label: 'Late Fee', icon: Plus, color: 'text-destructive' },
  credit: { label: 'Credit', icon: Minus, color: 'text-primary' },
  payment: { label: 'Payment', icon: Minus, color: 'text-primary' },
  correction: { label: 'Correction', icon: DollarSign, color: 'text-muted-foreground' },
};

export function BalanceSection({
  tenantId,
  currentBalance,
  rentAmount,
  leaseStartDate,
  managerId,
  onBalanceUpdate,
}: BalanceSectionProps) {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('charge');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { data: adjustments, isLoading: adjustmentsLoading } = useBalanceAdjustments(tenantId);
  const createAdjustment = useCreateBalanceAdjustment();

  const overdueBalance = calculateOverdueBalance(currentBalance, rentAmount, leaseStartDate);

  const handleSubmit = async () => {
    if (!amount || !description.trim()) return;

    await createAdjustment.mutateAsync({
      tenant_id: tenantId,
      amount: parseFloat(amount),
      adjustment_type: adjustmentType,
      description: description.trim(),
      current_balance: currentBalance,
      created_by: managerId,
    });

    // Reset form
    setAmount('');
    setDescription('');
    onBalanceUpdate();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <DollarSign className="h-4 w-4" /> Balance
      </h4>

      {/* Balance Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Balance</p>
          <p className={`text-2xl font-semibold ${currentBalance > 0 ? 'text-destructive' : currentBalance < 0 ? 'text-primary' : 'text-foreground'}`}>
            {formatCurrency(currentBalance)}
          </p>
          {currentBalance > 0 && (
            <Badge variant="destructive" className="mt-1 text-xs">
              Owed
            </Badge>
          )}
          {currentBalance < 0 && (
            <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary">
              Credit
            </Badge>
          )}
        </div>
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Overdue</p>
          <p className={`text-2xl font-semibold ${overdueBalance > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {formatCurrency(overdueBalance)}
          </p>
          {overdueBalance > 0 && (
            <Badge variant="outline" className="mt-1 text-xs border-destructive text-destructive">
              <AlertTriangle className="h-3 w-3 mr-1" /> Past Due
            </Badge>
          )}
        </div>
      </div>

      {/* Adjustment Form */}
      <div className="bg-muted/20 rounded-lg p-4 space-y-3 border border-border/50">
        <p className="text-sm font-medium">Adjust Balance</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="adjustment-type" className="text-xs">Type</Label>
            <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}>
              <SelectTrigger id="adjustment-type" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="charge">Charge (+)</SelectItem>
                <SelectItem value="late_fee">Late Fee (+)</SelectItem>
                <SelectItem value="payment">Payment (−)</SelectItem>
                <SelectItem value="credit">Credit (−)</SelectItem>
                <SelectItem value="correction">Correction (±)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="adjustment-amount" className="text-xs">Amount</Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="adjustment-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="adjustment-description" className="text-xs">Reason (required)</Label>
          <Textarea
            id="adjustment-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., January rent charge, Late fee for December..."
            className="mt-1 min-h-[60px] text-sm"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!amount || !description.trim() || createAdjustment.isPending}
          className="w-full"
          size="sm"
        >
          {createAdjustment.isPending ? 'Applying...' : 'Apply Adjustment'}
        </Button>
      </div>

      {/* Recent Activity */}
      <Collapsible open={showHistory} onOpenChange={setShowHistory}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Recent Activity
            </span>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {adjustmentsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : adjustments && adjustments.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {adjustments.map((adj) => {
                const typeInfo = adjustmentTypeLabels[adj.adjustment_type as AdjustmentType];
                const isPositive = ['charge', 'late_fee'].includes(adj.adjustment_type);
                return (
                  <div key={adj.id} className="flex items-start justify-between text-sm py-2 border-b border-border/30 last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-normal">
                          {typeInfo.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(adj.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {adj.description}
                      </p>
                    </div>
                    <span className={`font-medium ${isPositive ? 'text-destructive' : 'text-primary'}`}>
                      {isPositive ? '+' : '−'}{formatCurrency(Math.abs(adj.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No adjustments yet</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
