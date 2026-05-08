import { useMemo } from 'react';
import { differenceInDays, endOfMonth, format, isWithinInterval, parseISO, startOfMonth } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Home,
  MessageSquare,
  Plus,
  Receipt,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useMaintenance } from '@/hooks/useMaintenance';
import { useOverdueTenants } from '@/hooks/useOverdueTenants';
import type { Payment } from '@/hooks/usePayments';
import { hasPaymentBalanceApplied, isFailedPaymentStatus, isStaleProcessingACH } from '@/lib/paymentReliability';
import type {
  AdminNavigate,
  ApplicationRecord,
  LeaseRecord,
  PaymentControlFilter,
  PropertyRecord,
  TenantHealthFilter,
  TenantRecord,
} from './adminTypes';

interface AdminCommandCenterProps {
  managerId: string;
  properties: PropertyRecord[];
  applications: ApplicationRecord[];
  tenants: TenantRecord[];
  leases: LeaseRecord[];
  payments: Payment[];
  unreadMessages?: number;
  unreadInquiries?: number;
  paymentNotifications?: number;
  onNavigateTab: AdminNavigate;
  onAddProperty: () => void;
  onAddTenant: () => void;
  onCreateLease: () => void;
  onOpenTenant: (tenantId: string) => void;
}

type ActionTone = 'critical' | 'warning' | 'info' | 'success';

interface ActionItem {
  id: string;
  title: string;
  detail: string;
  value: string;
  tone: ActionTone;
  action: () => void;
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

function toneClasses(tone: ActionTone) {
  switch (tone) {
    case 'critical':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    case 'warning':
      return 'border-warning/40 bg-warning/10 text-warning';
    case 'success':
      return 'border-success/40 bg-success/10 text-success';
    default:
      return 'border-primary/35 bg-primary/10 text-primary';
  }
}

function SourceRow({
  label,
  value,
  detail,
  ok = true,
}: {
  label: string;
  value: string;
  detail: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge
        variant="outline"
        className={ok ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'}
      >
        {value}
      </Badge>
    </div>
  );
}

function MetricPanel({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'info',
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: ActionTone;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-border/60 bg-card/60 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card/90"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        <span className={`rounded-xl border p-2 ${toneClasses(tone)}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

export function AdminCommandCenter({
  managerId,
  properties,
  applications,
  tenants,
  leases,
  payments,
  unreadMessages = 0,
  unreadInquiries = 0,
  paymentNotifications = 0,
  onNavigateTab,
  onAddProperty,
  onAddTenant,
  onCreateLease,
  onOpenTenant,
}: AdminCommandCenterProps) {
  const { data: maintenance = [] } = useMaintenance();
  const { overdueTenants } = useOverdueTenants(managerId);

  const operations = useMemo(() => {
    const now = new Date();
    const currentMonth = { start: startOfMonth(now), end: endOfMonth(now) };

    const completedPayments = payments.filter((payment) => payment.status === 'completed');
    const currentMonthCompleted = completedPayments.filter((payment) =>
      isWithinInterval(parseISO(payment.payment_date), currentMonth)
    );
    const currentMonthCollected = currentMonthCompleted.reduce((sum, payment) => sum + Number(payment.amount), 0);

    const processingAch = payments.filter(
      (payment) => payment.status === 'processing' && payment.payment_method_type === 'ach'
    );
    const staleAch = processingAch.filter((payment) => isStaleProcessingACH(payment));
    const failedPayments = payments.filter((payment) => isFailedPaymentStatus(payment.status));
    const balanceReviewPayments = completedPayments.filter((payment) => !hasPaymentBalanceApplied(payment));

    const expectedMonthlyRentFromLeases = leases
      .filter((lease) => lease.status === 'completed')
      .reduce((sum, lease) => sum + Number(lease.monthly_rent || 0), 0);
    const expectedMonthlyRentFromTenants = tenants.reduce(
      (sum, tenant) => sum + Number(tenant.primary_rent_amount || tenant.rent_amount || 0),
      0
    );
    const expectedMonthlyRent = expectedMonthlyRentFromLeases || expectedMonthlyRentFromTenants;

    const outstandingBalance = tenants.reduce(
      (sum, tenant) => sum + Math.max(Number(tenant.current_balance || 0), 0),
      0
    );
    const pendingAchByTenant = new Map<string, number>();
    processingAch.forEach((payment) => {
      pendingAchByTenant.set(
        payment.tenant_id,
        (pendingAchByTenant.get(payment.tenant_id) || 0) + Number(payment.amount)
      );
    });
    const effectiveOutstanding = tenants.reduce((sum, tenant) => {
      const balance = Math.max(Number(tenant.current_balance || 0), 0);
      const pending = pendingAchByTenant.get(tenant.id) || 0;
      return sum + Math.max(balance - pending, 0);
    }, 0);

    const pendingApplications = applications.filter((application) =>
      ['pending', 'under_review'].includes(application.status)
    );
    const expiringLeases = leases
      .filter((lease) => lease.status === 'completed')
      .filter((lease) => differenceInDays(new Date(lease.end_date), now) <= 30)
      .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
    const openMaintenance = maintenance.filter((record) =>
      !['completed', 'paid', 'closed', 'resolved'].includes((record.status || '').toLowerCase())
    );
    const unassignedTenants = tenants.filter((tenant) => !tenant.primary_property && !tenant.property_id);
    const availableProperties = properties.filter((property) => property.status === 'available');
    const collectionRate = expectedMonthlyRent > 0 ? Math.min((currentMonthCollected / expectedMonthlyRent) * 100, 100) : 0;

    return {
      currentMonthCollected,
      expectedMonthlyRent,
      collectionRate,
      outstandingBalance,
      effectiveOutstanding,
      pendingAchTotal: processingAch.reduce((sum, payment) => sum + Number(payment.amount), 0),
      processingAch,
      staleAch,
      failedPayments,
      balanceReviewPayments,
      pendingApplications,
      expiringLeases,
      openMaintenance,
      unassignedTenants,
      availableProperties,
      completedPayments,
    };
  }, [applications, leases, maintenance, payments, properties, tenants]);

  const actionQueue = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    overdueTenants.slice(0, 3).forEach((tenant) => {
      items.push({
        id: `overdue-${tenant.id}`,
        title: `${tenant.name} is overdue`,
        detail: `${tenant.daysOverdue} days overdue${tenant.propertyAddress ? ` · ${tenant.propertyAddress}` : ''}`,
        value: formatCurrency(tenant.amountOwed),
        tone: 'critical',
        action: () => onOpenTenant(tenant.id),
      });
    });

    if (operations.staleAch.length > 0) {
      items.push({
        id: 'stale-ach',
        title: 'ACH payments need reconciliation',
        detail: `${operations.staleAch.length} processing payment${operations.staleAch.length === 1 ? '' : 's'} older than 5 days`,
        value: formatCurrency(operations.staleAch.reduce((sum, payment) => sum + Number(payment.amount), 0)),
        tone: 'warning',
        action: () => onNavigateTab('audit', { paymentFilter: 'processing-ach' }),
      });
    }

    if (operations.balanceReviewPayments.length > 0) {
      items.push({
        id: 'balance-review',
        title: 'Completed payments need balance review',
        detail: 'Payment exists, but balance adjustment linkage is missing',
        value: String(operations.balanceReviewPayments.length),
        tone: 'warning',
        action: () => onNavigateTab('audit', { paymentFilter: 'needs-review' }),
      });
    }

    if (operations.pendingApplications.length > 0) {
      items.push({
        id: 'pending-applications',
        title: 'Applications waiting on review',
        detail: 'Approve, reject, or request follow-up before they age out',
        value: String(operations.pendingApplications.length),
        tone: 'info',
        action: () => onNavigateTab('applications'),
      });
    }

    if (operations.expiringLeases.length > 0) {
      const nextLease = operations.expiringLeases[0];
      items.push({
        id: 'lease-expiring',
        title: 'Lease renewal window is open',
        detail: `${nextLease.properties?.address || 'A lease'} ends ${format(new Date(nextLease.end_date), 'MMM d')}`,
        value: String(operations.expiringLeases.length),
        tone: 'warning',
        action: () => onNavigateTab('leases'),
      });
    }

    if (operations.openMaintenance.length > 0) {
      items.push({
        id: 'open-maintenance',
        title: 'Maintenance records still open',
        detail: 'Review cost, status, and ownership split',
        value: String(operations.openMaintenance.length),
        tone: 'info',
        action: () => onNavigateTab('maintenance'),
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'all-clear',
        title: 'No urgent admin action found',
        detail: 'Payments, tenants, leases, and applications look calm right now',
        value: 'Clear',
        tone: 'success',
        action: () => onNavigateTab('audit'),
      });
    }

    return items.slice(0, 6);
  }, [onNavigateTab, onOpenTenant, operations, overdueTenants]);

  const sourceHealthy =
    operations.failedPayments.length === 0 &&
    operations.balanceReviewPayments.length === 0 &&
    operations.staleAch.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_35%),linear-gradient(135deg,hsl(var(--card)/0.96),hsl(var(--background)/0.96))] p-5 shadow-elevated md:p-7">
        <div className="absolute right-0 top-0 h-56 w-56 translate-x-20 -translate-y-20 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Admin Command Center
              </Badge>
              <Badge variant="outline" className={sourceHealthy ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'}>
                {sourceHealthy ? 'Source of truth healthy' : 'Review payment truth'}
              </Badge>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Collected this month</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
                  {formatCurrency(operations.currentMonthCollected)}
                </p>
                <div className="mt-4 max-w-sm">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Collection rate</span>
                    <span>{formatPercent(operations.collectionRate)}</span>
                  </div>
                  <Progress value={operations.collectionRate} className="h-2" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Against {formatCurrency(operations.expectedMonthlyRent)} expected monthly rent.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricPanel
                  label="Effective balance due"
                  value={formatCurrency(operations.effectiveOutstanding)}
                  detail={`${formatCurrency(operations.outstandingBalance)} official minus pending ACH`}
                  icon={AlertTriangle}
                  tone={operations.effectiveOutstanding > 0 ? 'critical' : 'success'}
                  onClick={() => onNavigateTab('tenants', { tenantFilter: 'balance-due' })}
                />
                <MetricPanel
                  label="Pending ACH"
                  value={formatCurrency(operations.pendingAchTotal)}
                  detail={`${operations.processingAch.length} bank transfer${operations.processingAch.length === 1 ? '' : 's'} processing`}
                  icon={Banknote}
                  tone={operations.processingAch.length > 0 ? 'warning' : 'success'}
                  onClick={() => onNavigateTab('audit', { paymentFilter: 'processing-ach' })}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/45 p-4 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Action queue</h2>
                <p className="text-sm text-muted-foreground">Highest-value work first.</p>
              </div>
              <Badge variant="secondary">{actionQueue.length}</Badge>
            </div>
            <div className="space-y-2">
              {actionQueue.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={item.action}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/55 p-3 text-left transition-all hover:border-primary/45 hover:bg-card"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${item.tone === 'critical' ? 'bg-destructive' : item.tone === 'warning' ? 'bg-warning' : item.tone === 'success' ? 'bg-success' : 'bg-primary'}`} />
                      <p className="truncate text-sm font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className={toneClasses(item.tone)}>{item.value}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricPanel
          label="Properties"
          value={String(properties.length)}
          detail={`${operations.availableProperties.length} available · ${properties.filter((property) => property.status === 'occupied').length} occupied`}
          icon={Home}
          onClick={() => onNavigateTab('properties')}
        />
        <MetricPanel
          label="Active tenants"
          value={String(tenants.length)}
          detail={`${operations.unassignedTenants.length} need property assignment`}
          icon={Users}
          tone={operations.unassignedTenants.length > 0 ? 'warning' : 'info'}
          onClick={() => onNavigateTab('tenants', { tenantFilter: operations.unassignedTenants.length > 0 ? 'unassigned' : 'all' })}
        />
        <MetricPanel
          label="Applications"
          value={String(operations.pendingApplications.length)}
          detail="Pending or under review"
          icon={ClipboardList}
          tone={operations.pendingApplications.length > 0 ? 'warning' : 'success'}
          onClick={() => onNavigateTab('applications')}
        />
        <MetricPanel
          label="Leases"
          value={String(leases.length)}
          detail={`${operations.expiringLeases.length} ending within 30 days`}
          icon={FileText}
          tone={operations.expiringLeases.length > 0 ? 'warning' : 'info'}
          onClick={() => onNavigateTab('leases')}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Source of truth</h2>
              <p className="text-sm text-muted-foreground">Money is tracked from payments into tenant balance ledgers.</p>
            </div>
            <ShieldCheck className={sourceHealthy ? 'h-5 w-5 text-success' : 'h-5 w-5 text-warning'} />
          </div>
          <SourceRow
            label="Stripe payment ledger"
            value={`${payments.length} rows`}
            detail="All admin cash metrics originate from the payments table."
          />
          <SourceRow
            label="Balance application"
            value={operations.balanceReviewPayments.length === 0 ? 'Linked' : `${operations.balanceReviewPayments.length} review`}
            detail="Completed rent and balance payments should link to balance_adjustments."
            ok={operations.balanceReviewPayments.length === 0}
          />
          <SourceRow
            label="ACH processing"
            value={operations.staleAch.length === 0 ? 'Fresh' : `${operations.staleAch.length} stale`}
            detail="Bank transfers can stay processing while Stripe/ACH clears."
            ok={operations.staleAch.length === 0}
          />
          <SourceRow
            label="Signals"
            value={`${unreadMessages + unreadInquiries + paymentNotifications}`}
            detail="Unread messages, inquiries, and payment notifications needing attention."
            ok={unreadMessages + unreadInquiries + paymentNotifications === 0}
          />
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Fast paths</h2>
              <p className="text-sm text-muted-foreground">Jump to the exact operational surface.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onAddProperty}>
                <Plus className="mr-2 h-4 w-4" /> Property
              </Button>
              <Button size="sm" variant="outline" onClick={onAddTenant}>
                <Users className="mr-2 h-4 w-4" /> Tenant
              </Button>
              <Button size="sm" variant="outline" onClick={onCreateLease}>
                <FileText className="mr-2 h-4 w-4" /> Lease
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: 'Payment Control',
                detail: 'ACH, failed payments, reconciliation',
                icon: Receipt,
                action: () => onNavigateTab('audit', { paymentFilter: 'all' as PaymentControlFilter }),
              },
              {
                label: 'Tenant Health',
                detail: 'Balances, pending ACH, assignments',
                icon: Users,
                action: () => onNavigateTab('tenants', { tenantFilter: 'all' as TenantHealthFilter }),
              },
              {
                label: 'Messages',
                detail: `${unreadMessages} unread conversations`,
                icon: MessageSquare,
                action: () => onNavigateTab('messages'),
              },
              {
                label: 'Maintenance',
                detail: `${operations.openMaintenance.length} open records`,
                icon: Wrench,
                action: () => onNavigateTab('maintenance'),
              },
            ].map((item) => (
              <button
                type="button"
                key={item.label}
                onClick={item.action}
                className="group rounded-xl border border-border/50 bg-background/35 p-4 text-left transition-all hover:border-primary/45 hover:bg-background/70"
              >
                <item.icon className="mb-3 h-5 w-5 text-primary" />
                <p className="font-medium">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
