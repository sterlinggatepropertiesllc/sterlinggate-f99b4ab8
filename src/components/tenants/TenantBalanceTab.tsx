import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DollarSign, ArrowUp, ArrowDown, Clock, Plus, Minus, AlertTriangle, CreditCard } from 'lucide-react';
import { useBalanceAdjustments, useApplyBalanceAdjustment } from '@/hooks/useBalanceAdjustments';
import { useChargeRent } from '@/hooks/useRentCharges';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface TenantBalanceTabProps {
  tenant: any;
  onUpdate: () => void;
}

export function TenantBalanceTab({ tenant, onUpdate }: TenantBalanceTabProps) {
  const { user } = useAuth();
  const [adjustmentType, setAdjustmentType] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const { data: adjustments, isLoading: adjustmentsLoading } = useBalanceAdjustments(tenant.id);
  const applyAdjustment = useApplyBalanceAdjustment();
  const chargeRent = useChargeRent();

  const currentBalance = tenant.current_balance ?? 0;
  const isOverdue = currentBalance > 0;
  const rentAmount = tenant.rent_amount ?? 0;

  // Calculate next rent due date (1st of next month)
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextRentDueDate = nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleApplyAdjustment = async () => {
    if (!adjustmentType || !amount || parseFloat(amount) <= 0) {
      return;
    }

    const validTypes = ['charge', 'correction', 'credit', 'late_fee', 'payment'] as const;
    type AdjustmentType = typeof validTypes[number];
    
    try {
      await applyAdjustment.mutateAsync({
        tenant_id: tenant.id,
        adjustment_type: adjustmentType as AdjustmentType,
        amount: parseFloat(amount),
        description: description || undefined,
        created_by: user?.id,
      });

      // Reset form
      setAdjustmentType('');
      setAmount('');
      setDescription('');
      onUpdate();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleChargeRent = async () => {
    if (!rentAmount || rentAmount <= 0) return;
    
    try {
      await chargeRent.mutateAsync({
        tenant_id: tenant.id,
        created_by: user?.id,
      });
      onUpdate();
    } catch (error) {
      // Error handled by hook
    }
  };

  const getAdjustmentIcon = (type: string) => {
    if (['charge', 'late_fee'].includes(type)) {
      return <ArrowUp className="h-4 w-4 text-destructive" />;
    }
    return <ArrowDown className="h-4 w-4 text-success" />;
  };

  const getAdjustmentColor = (type: string) => {
    if (['charge', 'late_fee'].includes(type)) {
      return 'text-destructive';
    }
    return 'text-success';
  };

  return (
    <div className="space-y-6">
      {/* Balance Overview - Mirrors Tenant Portal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={`transition-all duration-300 ${isOverdue ? 'border-destructive/50 bg-gradient-to-br from-destructive/10 to-transparent shadow-lg shadow-destructive/5' : 'border-success/30 bg-gradient-to-br from-success/10 to-transparent'}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Current Balance</p>
                <p className={`text-4xl font-serif mt-1 ${isOverdue ? 'text-destructive' : 'text-success'}`}>
                  ${Math.abs(currentBalance).toLocaleString()}
                </p>
                <Badge 
                  variant={isOverdue ? 'destructive' : 'secondary'} 
                  className={`mt-2 ${!isOverdue ? 'bg-success/10 text-success border border-success/20' : 'shadow-sm shadow-destructive/20'}`}
                >
                  {isOverdue ? 'Amount Owed' : currentBalance < 0 ? 'Credit' : 'Paid in Full'}
                </Badge>
              </div>
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ring-2 shadow-lg ${isOverdue ? 'bg-gradient-to-br from-destructive/20 to-destructive/5 ring-destructive/20 shadow-destructive/10' : 'bg-gradient-to-br from-success/20 to-success/5 ring-success/20 shadow-success/10'}`}>
                {isOverdue ? (
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                ) : (
                  <DollarSign className="h-7 w-7 text-success" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Monthly Rent</p>
                <p className="text-4xl font-serif mt-1 text-foreground">
                  ${rentAmount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  Next due: {nextRentDueDate}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center ring-2 ring-primary/20 shadow-lg shadow-primary/10">
                <CreditCard className="h-7 w-7 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>Common balance operations for this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={handleChargeRent}
              disabled={chargeRent.isPending || !rentAmount}
            >
              <Plus className="mr-2 h-4 w-4" />
              {chargeRent.isPending ? 'Charging...' : 'Charge Monthly Rent'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Balance Adjustment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adjust Balance</CardTitle>
          <CardDescription>Add charges, credits, or record payments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="charge">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-destructive" />
                      Charge (Add to balance)
                    </span>
                  </SelectItem>
                  <SelectItem value="payment">
                    <span className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-success" />
                      Payment (Reduce balance)
                    </span>
                  </SelectItem>
                  <SelectItem value="credit">
                    <span className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-success" />
                      Credit (Reduce balance)
                    </span>
                  </SelectItem>
                  <SelectItem value="late_fee">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-destructive" />
                      Late Fee (Add to balance)
                    </span>
                  </SelectItem>
                  <SelectItem value="correction">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Correction (Adjust balance)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Enter a reason for this adjustment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <Button 
            onClick={handleApplyAdjustment} 
            disabled={applyAdjustment.isPending || !adjustmentType || !amount || parseFloat(amount) <= 0}
          >
            {applyAdjustment.isPending ? 'Applying...' : 'Apply Adjustment'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Balance adjustment history for this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          {adjustmentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : adjustments && adjustments.length > 0 ? (
            <div className="space-y-3">
              {adjustments.map((adjustment: any) => {
                const isDebit = ['charge', 'late_fee'].includes(adjustment.adjustment_type);
                return (
                  <div 
                    key={adjustment.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-muted/30 ${
                      isDebit 
                        ? 'bg-gradient-to-r from-destructive/5 to-transparent border-l-4 border-l-destructive border-destructive/20' 
                        : 'bg-gradient-to-r from-success/5 to-transparent border-l-4 border-l-success border-success/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isDebit ? 'bg-destructive/10' : 'bg-success/10'}`}>
                        {getAdjustmentIcon(adjustment.adjustment_type)}
                      </div>
                      <div>
                        <p className="font-medium capitalize text-foreground">
                          {adjustment.adjustment_type.replace('_', ' ')}
                        </p>
                        {adjustment.description && (
                          <p className="text-sm text-muted-foreground">{adjustment.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(adjustment.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold text-lg ${getAdjustmentColor(adjustment.adjustment_type)}`}>
                        {isDebit ? '+' : '-'}
                        ${Number(adjustment.amount).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: ${Number(adjustment.new_balance).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-muted/80 to-muted/30 flex items-center justify-center ring-2 ring-border">
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground">No balance adjustments yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
