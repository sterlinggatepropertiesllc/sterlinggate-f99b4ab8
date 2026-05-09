import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';
import { useAllPayments, type Payment } from '@/hooks/usePayments';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle,
  Banknote,
  CalendarIcon, 
  Building2, 
  CheckCircle2,
  Receipt,
  Users, 
  DollarSign, 
  Download,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  XCircle
} from 'lucide-react';
import { format, formatDistanceToNow, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import { AdminReliabilityPanel } from '@/components/admin/AdminReliabilityPanel';
import { AdminButton, PageHeader, StatCard } from '@/components/admin/AdminDesignSystem';
import type { PaymentControlFilter, TenantRecord } from '@/components/admin/adminTypes';
import { useReliabilitySummary, useStripeWebhookEvents } from '@/hooks/useReliabilityMonitoring';
import { getPaymentStatusDisplay } from '@/lib/paymentDisplay';
import {
  getPaymentAgeDays,
  hasPaymentBalanceApplied,
  isStaleProcessingACH,
} from '@/lib/paymentReliability';

type ViewMode = 'property' | 'tenant';
type DatePreset = 'all_time' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'last_30_days' | 'custom';
type PaymentWorkspaceTab = 'overview' | 'ledger' | 'review' | 'system';

const NO_MONEY_MOVED_LABELS = new Set(['Incomplete', 'Failed', 'Canceled']);

interface AuditDashboardProps {
  quickFilter?: PaymentControlFilter;
  onQuickFilterChange?: (filter: PaymentControlFilter) => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRelativeWebhookTime(value: string | null) {
  if (!value) return 'No webhook events yet';
  return formatDistanceToNow(parseISO(value), { addSuffix: true });
}

function getWebhookStatusLine(value: string | null) {
  if (!value) return 'No webhook events yet';
  return `Last received ${formatRelativeWebhookTime(value)}`;
}

function didPaymentMoveNoMoney(payment: Payment) {
  return NO_MONEY_MOVED_LABELS.has(getPaymentStatusDisplay(payment).label);
}

function PaymentLedgerTable({
  payments,
  properties,
  tenants,
  quickFilter,
  onClearFilter,
  title = 'Transaction Ledger',
  description,
}: {
  payments: Payment[];
  properties: Array<{ id: string; address?: string | null; city?: string | null }>;
  tenants: TenantRecord[];
  quickFilter: PaymentControlFilter;
  onClearFilter: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/80">
      <CardHeader className="border-b border-border/60 bg-muted/15">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-serif">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {description || `Showing ${payments.length} payment${payments.length === 1 ? '' : 's'} for the selected view.`}
            </p>
          </div>
          {quickFilter !== 'all' && (
            <Button size="sm" variant="ghost" onClick={onClearFilter}>
              Clear filter
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {payments.length === 0 ? (
          <div className="px-6 py-14 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No transactions found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="pr-6">Stripe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 75).map((payment) => {
                    const property = properties.find(p => p.id === payment.property_id);
                    const tenant = tenants.find((t: TenantRecord) => t.id === payment.tenant_id);
                    const age = getPaymentAgeDays(payment);
                    const balanceApplied = hasPaymentBalanceApplied(payment);
                    const paymentDisplay = getPaymentStatusDisplay(payment);
                    const noMoneyMoved = NO_MONEY_MOVED_LABELS.has(paymentDisplay.label);
                    const rowNeedsAttention = noMoneyMoved || !balanceApplied || (age >= 5 && payment.status === 'processing');
                    const statusClass =
                      paymentDisplay.tone === 'success'
                        ? 'border-success/40 bg-success/10 text-success'
                        : paymentDisplay.tone === 'warning'
                          ? 'border-warning/40 bg-warning/10 text-warning'
                          : paymentDisplay.tone === 'destructive'
                            ? 'border-destructive/40 bg-destructive/10 text-destructive'
                            : 'border-border text-muted-foreground';
                    const balanceLabel = payment.status === 'processing'
                      ? 'Pending'
                      : noMoneyMoved
                        ? 'No movement'
                        : balanceApplied
                          ? 'Applied'
                          : 'Review';
                    const balanceClass = noMoneyMoved
                      ? 'border-muted bg-muted/35 text-muted-foreground'
                      : balanceApplied
                        ? 'border-success/40 bg-success/10 text-success'
                        : 'border-warning/40 bg-warning/10 text-warning';

                    return (
                      <TableRow key={payment.id} className={rowNeedsAttention ? 'bg-warning/5' : undefined}>
                        <TableCell className="pl-6 font-medium">
                          <div>{format(parseISO(payment.payment_date), 'MMM d, yyyy')}</div>
                          <div className="text-xs text-muted-foreground">{age}d old</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{tenant?.user?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{tenant?.user?.email}</div>
                        </TableCell>
                        <TableCell>
                          {property ? `${property.address}, ${property.city}` : 'Unknown'}
                        </TableCell>
                        <TableCell className="font-semibold text-success">
                          {formatCurrency(Number(payment.amount))}
                        </TableCell>
                        <TableCell className="capitalize">
                          {payment.payment_type?.replace('_', ' ') || 'payment'}
                        </TableCell>
                        <TableCell className="capitalize">
                          {payment.payment_method_type || payment.payment_method?.replace('_', ' ') || 'manual'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClass}>
                            {paymentDisplay.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={balanceClass}>
                            {balanceLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate pr-6 text-xs text-muted-foreground">
                          {payment.stripe_payment_intent_id || payment.stripe_session_id || 'manual'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompactSystemHealth({ onOpenSystem }: { onOpenSystem: () => void }) {
  const { data: events = [] } = useStripeWebhookEvents(8);
  const summary = useReliabilitySummary(events);

  return (
    <Card className="border-border/70 bg-card/70">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              'mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border',
              summary.healthy ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'
            )}>
              {summary.healthy ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">System status</p>
              <p className="text-sm text-muted-foreground">
                Webhook {summary.healthy ? 'healthy' : 'needs review'} · {getWebhookStatusLine(summary.lastReceived)}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Events 24h</p>
              <p className="mt-1 text-sm font-semibold">{summary.recentCount}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Failed</p>
              <p className={cn('mt-1 text-sm font-semibold', summary.failedCount > 0 && 'text-destructive')}>{summary.failedCount}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Retried</p>
              <p className={cn('mt-1 text-sm font-semibold', summary.retriedCount > 0 && 'text-warning')}>{summary.retriedCount}</p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={onOpenSystem} className="self-start lg:self-auto">
            Open system health
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AuditDashboard({ quickFilter = 'all', onQuickFilterChange }: AuditDashboardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: properties = [] } = useManagerProperties(user?.id);
  const { data: tenants = [] } = useTenants(user?.id);
  const { data: payments = [] } = useAllPayments();

  const [viewMode, setViewMode] = useState<ViewMode>('property');
  const [datePreset, setDatePreset] = useState<DatePreset>('all_time');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [workspaceTab, setWorkspaceTab] = useState<PaymentWorkspaceTab>('overview');
  const [isReconciling, setIsReconciling] = useState(false);

  // Realtime subscription for payments (admin view)
  useEffect(() => {
    const channel = supabase
      .channel('admin-payments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payments', 'all'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Update date range when preset changes
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    
    switch (preset) {
      case 'all_time':
        setDateRange(undefined);
        break;
      case 'this_week':
        setDateRange({ from: startOfWeek(now), to: endOfWeek(now) });
        break;
      case 'this_month':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case 'this_quarter':
        setDateRange({ from: startOfQuarter(now), to: endOfQuarter(now) });
        break;
      case 'this_year':
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        break;
      case 'last_30_days':
        setDateRange({ from: subDays(now, 30), to: now });
        break;
      case 'custom':
        // Keep current range for custom
        break;
    }
  };

  const statusSummary = useMemo(() => {
    const completed = payments.filter((payment) => payment.status === 'completed');
    const processingACH = payments.filter(
      (payment) => payment.status === 'processing' && payment.payment_method_type === 'ach'
    );
    const staleProcessing = processingACH.filter((payment) => isStaleProcessingACH(payment));
    const notCompleted = payments.filter((payment) => didPaymentMoveNoMoney(payment));
    const needsReview = payments.filter((payment) => !hasPaymentBalanceApplied(payment));

    return {
      completed,
      processingACH,
      staleProcessing,
      notCompleted,
      needsReview,
      totalProcessingACH: processingACH.reduce((sum, payment) => sum + Number(payment.amount), 0),
      totalCompleted: completed.reduce((sum, payment) => sum + Number(payment.amount), 0),
    };
  }, [payments]);

  const setQuickFilter = (filter: PaymentControlFilter) => {
    onQuickFilterChange?.(filter);
  };

  const matchesQuickFilter = useMemo(() => {
    return (payment: Payment) => {
      switch (quickFilter) {
        case 'completed':
          return payment.status === 'completed';
        case 'processing-ach':
          return payment.status === 'processing' && payment.payment_method_type === 'ach';
        case 'needs-review':
          return !hasPaymentBalanceApplied(payment) || isStaleProcessingACH(payment);
        case 'failed':
          return didPaymentMoveNoMoney(payment);
        default:
          return true;
      }
    };
  }, [quickFilter]);

  // Filter payments by date range, selection, and command-center quick filters.
  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      if (dateRange?.from && dateRange?.to) {
        const paymentDate = parseISO(payment.payment_date);
        const inDateRange = isWithinInterval(paymentDate, {
          start: dateRange.from,
          end: dateRange.to,
        });

        if (!inDateRange) return false;
      }

      if (viewMode === 'property' && selectedProperty !== 'all') {
        return payment.property_id === selectedProperty;
      }
      
      if (viewMode === 'tenant' && selectedTenant !== 'all') {
        return payment.tenant_id === selectedTenant;
      }

      return matchesQuickFilter(payment);
    });
  }, [payments, dateRange, viewMode, selectedProperty, selectedTenant, matchesQuickFilter]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const completedPayments = filteredPayments.filter((p) => p.status === 'completed');
    const pendingPayments = filteredPayments.filter((p) => p.status === 'processing' && p.payment_method_type === 'ach');
    const failedPayments = filteredPayments.filter((p) => didPaymentMoveNoMoney(p));
    const needsReviewPayments = filteredPayments.filter((p) => !hasPaymentBalanceApplied(p));
    const totalCollected = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingACH = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const transactionCount = completedPayments.length;
    const avgTransaction = transactionCount > 0 ? totalCollected / transactionCount : 0;

    // Group by property or tenant
    const groupedData = viewMode === 'property'
      ? properties.map(property => {
          const propertyPayments = completedPayments.filter(p => p.property_id === property.id);
          const amount = propertyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          return {
            id: property.id,
            name: `${property.address}, ${property.city}`,
            amount,
            count: propertyPayments.length,
          };
        }).filter(item => item.count > 0).sort((a, b) => b.amount - a.amount)
      : tenants.map(tenant => {
          // Compare payment.tenant_id to tenant.id (the tenant record ID)
          const tenantPayments = completedPayments.filter(p => p.tenant_id === tenant.id);
          const amount = tenantPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          return {
            id: tenant.id,
            name: tenant.user?.full_name || tenant.user?.email || 'Unknown Tenant',
            amount,
            count: tenantPayments.length,
          };
        }).filter(item => item.count > 0).sort((a, b) => b.amount - a.amount);

    return {
      totalCollected,
      pendingACH,
      failedCount: failedPayments.length,
      needsReviewCount: needsReviewPayments.length,
      transactionCount,
      avgTransaction,
      groupedData,
    };
  }, [filteredPayments, properties, tenants, viewMode]);

  const reviewPayments = useMemo(() => {
    return filteredPayments.filter((payment) => {
      return !hasPaymentBalanceApplied(payment) || isStaleProcessingACH(payment) || didPaymentMoveNoMoney(payment);
    });
  }, [filteredPayments]);

  const exportToCSV = () => {
    const headers = ['Date', 'Tenant', 'Property', 'Amount', 'Type', 'Method', 'Status', 'Stripe Payment Intent', 'Balance Applied'];
    const rows = filteredPayments.map(payment => {
      const property = properties.find(p => p.id === payment.property_id);
      const tenant = tenants.find((t: TenantRecord) => t.id === payment.tenant_id);
      return [
        format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
        tenant?.user?.full_name || tenant?.user?.email || 'Unknown',
        property ? `${property.address}, ${property.city}` : 'Unknown',
        payment.amount,
        payment.payment_type,
        payment.payment_method,
        payment.status,
        payment.stripe_payment_intent_id || '',
        hasPaymentBalanceApplied(payment) ? 'yes' : 'review',
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handleReconcileACH = async () => {
    setIsReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke('reconcile-ach-payments', {
        body: {},
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['balance-adjustments'] });

      if ((data?.updated || 0) > 0) {
        toast.success(`Reconciled ${data.updated} payment(s).`);
      } else {
        toast.info('No stuck ACH payments were ready to reconcile.');
      }

      if ((data?.failed || 0) > 0) {
        toast.warning(`${data.failed} payment(s) still need review.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ACH reconciliation failed';
      toast.error(message);
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Payment Control Center"
        title="Payments"
        subtitle="Stripe activity, ACH processing, and balance ledger status in one place."
        actions={
          <>
            <AdminButton
              onClick={handleReconcileACH}
              disabled={isReconciling || statusSummary.processingACH.length === 0}
              variant="secondary"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isReconciling ? 'animate-spin' : ''}`} />
              {isReconciling ? 'Reconciling...' : 'Reconcile ACH'}
            </AdminButton>
            <AdminButton onClick={exportToCSV} variant="secondary">
              <Download className="mr-2 h-4 w-4" />
              Export report
            </AdminButton>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            {
              id: 'all' as PaymentControlFilter,
              label: 'All Payments',
              value: payments.length,
              detail: formatCurrency(statusSummary.totalCompleted),
              icon: Receipt,
            },
            {
              id: 'completed' as PaymentControlFilter,
              label: 'Completed',
              value: statusSummary.completed.length,
              detail: 'Balance eligible',
              icon: CheckCircle2,
            },
            {
              id: 'processing-ach' as PaymentControlFilter,
              label: 'Processing ACH',
              value: statusSummary.processingACH.length,
              detail: formatCurrency(statusSummary.totalProcessingACH),
              icon: Banknote,
            },
            {
              id: 'needs-review' as PaymentControlFilter,
              label: 'Needs Review',
              value: statusSummary.needsReview.length + statusSummary.staleProcessing.length,
              detail: 'Stale or unlinked',
              icon: AlertTriangle,
            },
            {
              id: 'failed' as PaymentControlFilter,
              label: 'Not Completed',
              value: statusSummary.notCompleted.length,
              detail: 'Incomplete, canceled, or failed',
              icon: XCircle,
            },
          ].map((item) => (
            <StatCard
              key={item.id}
              label={item.label}
              value={item.value}
              detail={item.detail}
              tone={
                item.id === 'failed'
                  ? 'danger'
                  : item.id === 'needs-review' || item.id === 'processing-ach'
                    ? 'warning'
                    : item.id === 'completed'
                      ? 'success'
                      : 'gold'
              }
              onClick={() => setQuickFilter(item.id)}
              className={quickFilter === item.id ? 'border-primary/45' : undefined}
            />
          ))}
      </section>

      <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as PaymentWorkspaceTab)} className="space-y-4">
        <Card className="border-border/70 bg-card/70">
          <CardContent className="flex flex-col gap-3 p-2 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
              <TabsTrigger value="overview" className="rounded-lg px-4 py-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                Overview
              </TabsTrigger>
              <TabsTrigger value="ledger" className="rounded-lg px-4 py-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                Ledger
              </TabsTrigger>
              <TabsTrigger value="review" className="rounded-lg px-4 py-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                Review queue
              </TabsTrigger>
              <TabsTrigger value="system" className="rounded-lg px-4 py-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                System health
              </TabsTrigger>
            </TabsList>
            <p className="px-2 text-xs text-muted-foreground">
              Keep daily payment work separate from webhook diagnostics and audit history.
            </p>
          </CardContent>
        </Card>

        <TabsContent value="overview" className="mt-0 space-y-4">
          <CompactSystemHealth onOpenSystem={() => setWorkspaceTab('system')} />

          <section className="grid gap-4 md:grid-cols-4">
            <Card className="border-success/20 bg-success/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Collected In View</CardTitle>
                <DollarSign className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(summary.totalCollected)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
                    : 'All time'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed Transactions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.transactionCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Average {formatCurrency(summary.avgTransaction)}</p>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-warning/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending ACH</CardTitle>
                <TrendingDown className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{formatCurrency(summary.pendingACH)}</div>
                <p className="text-xs text-muted-foreground mt-1">{statusSummary.staleProcessing.length} older than 5 days</p>
              </CardContent>
            </Card>

            <Card className={summary.needsReviewCount || summary.failedCount ? 'border-destructive/20 bg-destructive/5' : 'border-success/20 bg-success/5'}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ledger Trust</CardTitle>
                <ShieldCheck className={summary.needsReviewCount || summary.failedCount ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-success'} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.needsReviewCount + summary.failedCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Items requiring admin review</p>
              </CardContent>
            </Card>
          </section>

          <PaymentLedgerTable
            payments={filteredPayments.slice(0, 8)}
            properties={properties}
            tenants={tenants as TenantRecord[]}
            quickFilter={quickFilter}
            onClearFilter={() => setQuickFilter('all')}
            title="Recent Payments"
            description="Latest matching transactions. Open Ledger for filters and the full table."
          />
        </TabsContent>

        <TabsContent value="ledger" className="mt-0 space-y-4">
          <Card className="border-border/60 bg-card/70">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">View By</label>
                  <div className="flex gap-1">
                    <Button variant={viewMode === 'property' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('property')}>
                      <Building2 className="mr-2 h-4 w-4" />
                      Property
                    </Button>
                    <Button variant={viewMode === 'tenant' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('tenant')}>
                      <Users className="mr-2 h-4 w-4" />
                      Tenant
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Date Range</label>
                  <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="this_quarter">This Quarter</SelectItem>
                      <SelectItem value="this_year">This Year</SelectItem>
                      <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                      <SelectItem value="all_time">All Time</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {datePreset === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Custom Range</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-[280px] justify-start text-left font-normal')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>{format(dateRange.from, 'LLL dd, yyyy')} - {format(dateRange.to, 'LLL dd, yyyy')}</>
                            ) : (
                              format(dateRange.from, 'LLL dd, yyyy')
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {viewMode === 'property' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Property</label>
                    <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="All Properties" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Properties</SelectItem>
                        {properties.map(property => (
                          <SelectItem key={property.id} value={property.id}>
                            {property.address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Tenant</label>
                    <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="All Tenants" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tenants</SelectItem>
                        {tenants.map((tenant: TenantRecord) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.user?.full_name || tenant.user?.email || 'Unnamed Tenant'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {summary.groupedData.length > 0 && (
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg font-serif">
                  {viewMode === 'property' ? 'Revenue by Property' : 'Payments by Tenant'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {summary.groupedData.slice(0, 8).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.count} completed payment{item.count === 1 ? '' : 's'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(item.amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <PaymentLedgerTable
            payments={filteredPayments}
            properties={properties}
            tenants={tenants as TenantRecord[]}
            quickFilter={quickFilter}
            onClearFilter={() => setQuickFilter('all')}
          />
        </TabsContent>

        <TabsContent value="review" className="mt-0 space-y-4">
          <section className="grid gap-3 md:grid-cols-3">
            <StatCard
              label="Needs Review"
              value={summary.needsReviewCount}
              detail="Ledger-unapplied or unlinked"
              tone={summary.needsReviewCount > 0 ? 'warning' : 'success'}
            />
            <StatCard
              label="Not Completed"
              value={summary.failedCount}
              detail="Incomplete, canceled, or failed"
              tone={summary.failedCount > 0 ? 'danger' : 'success'}
            />
            <StatCard
              label="Stale ACH"
              value={statusSummary.staleProcessing.length}
              detail="Processing longer than 5 days"
              tone={statusSummary.staleProcessing.length > 0 ? 'warning' : 'success'}
            />
          </section>
          <PaymentLedgerTable
            payments={reviewPayments}
            properties={properties}
            tenants={tenants as TenantRecord[]}
            quickFilter={quickFilter}
            onClearFilter={() => setQuickFilter('all')}
            title="Review Queue"
            description="Only payments that are incomplete, canceled, failed, stale, or not applied to the ledger."
          />
        </TabsContent>

        <TabsContent value="system" className="mt-0">
          <AdminReliabilityPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
