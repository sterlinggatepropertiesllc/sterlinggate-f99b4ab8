import { useMemo } from 'react';
import {
  addDays,
  differenceInDays,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronDown,
  DollarSign,
  FilePlus2,
  Gauge,
  Home,
  Landmark,
  MessageSquare,
  Receipt,
  ShieldCheck,
  Target,
  UserPlus,
  Wrench,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  managerName?: string | null;
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

type Tone = 'gold' | 'teal' | 'red' | 'amber' | 'green' | 'blue';

interface PriorityAction {
  title: string;
  value: string;
  detail: string;
  cta: string;
  icon: LucideIcon;
  tone: Tone;
  action: () => void;
}

function formatCurrency(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  const hasCents = Math.abs(amount % 1) > 0.001;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(value >= 10 ? 1 : 0)}%`;
}

function toneStyle(tone: Tone) {
  switch (tone) {
    case 'red':
      return {
        text: 'text-destructive',
        border: 'border-destructive/30',
        bg: 'bg-destructive/10',
        glow: 'shadow-[0_0_28px_hsl(var(--destructive)/0.10)]',
      };
    case 'amber':
    case 'gold':
      return {
        text: 'text-primary',
        border: 'border-primary/30',
        bg: 'bg-primary/10',
        glow: 'shadow-[0_0_28px_hsl(var(--primary)/0.10)]',
      };
    case 'green':
    case 'teal':
      return {
        text: 'text-success',
        border: 'border-success/30',
        bg: 'bg-success/10',
        glow: 'shadow-[0_0_28px_hsl(var(--success)/0.10)]',
      };
    default:
      return {
        text: 'text-cyan-300',
        border: 'border-cyan-300/25',
        bg: 'bg-cyan-300/10',
        glow: 'shadow-[0_0_28px_rgba(103,232,249,0.10)]',
      };
  }
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getShortName(name?: string | null) {
  if (!name) return 'Admin';
  const cleaned = name.split('@')[0].trim();
  return cleaned.split(/\s+/)[0] || 'Admin';
}

function getPaymentDate(payment: Payment) {
  return parseISO(payment.payment_date);
}

function KpiCard({
  label,
  value,
  detail,
  trend,
  icon: Icon,
  tone = 'gold',
  progress,
  actionLabel,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  trend: string;
  icon: LucideIcon;
  tone?: Tone;
  progress?: number;
  actionLabel?: string;
  onClick?: () => void;
}) {
  const toneClass = toneStyle(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className="ops-panel group min-h-[108px] p-3.5 text-left transition-colors hover:border-primary/35"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="ops-label max-w-[116px] leading-tight">{label}</p>
        <span className={`mt-1 h-1.5 w-8 rounded-full ${toneClass.bg.replace('bg-', 'bg-')}`} />
      </div>
      <p className="mt-2.5 truncate text-2xl font-bold leading-none tracking-tight text-foreground">{value}</p>
      <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{detail}</p>
      {typeof progress === 'number' ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted/70">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
        </div>
      ) : (
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px]">
          <span className={`truncate ${toneClass.text}`}>{trend}</span>
          {actionLabel && <span className="shrink-0 text-primary">{actionLabel} <ArrowRight className="inline h-3 w-3" /></span>}
        </div>
      )}
    </button>
  );
}

function PriorityCard({ item }: { item: PriorityAction }) {
  const toneClass = toneStyle(item.tone);

  return (
    <button
      type="button"
      onClick={item.action}
      className="ops-panel-soft group min-h-[104px] p-3 text-left transition-colors hover:border-primary/30"
    >
      <div className={`mb-2 h-1 w-10 rounded-full ${toneClass.bg}`} />
      <div className="min-w-0">
        <p className={`truncate text-[10px] font-bold uppercase tracking-[0.16em] ${toneClass.text}`}>{item.title}</p>
        <p className="mt-1 truncate text-lg font-bold leading-none">{item.value}</p>
        <p className="mt-1 truncate text-[10px] text-muted-foreground">{item.detail}</p>
        <div className={`mt-2 flex items-center justify-between rounded-md border px-2 py-1 text-[9px] ${toneClass.border} ${toneClass.bg}`}>
          <span>{item.cta}</span>
          <ArrowRight className={`h-3 w-3 transition-transform group-hover:translate-x-0.5 ${toneClass.text}`} />
        </div>
      </div>
    </button>
  );
}

function HealthItem({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  const toneClass = toneStyle(tone);
  return (
    <div className="min-w-0 border-b border-border/50 px-3 pb-3 last:border-b-0 md:border-b-0 md:border-r md:pb-0 md:last:border-r-0">
      <div className={`mb-2 h-1 w-8 rounded-full ${toneClass.bg}`} />
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${toneClass.text}`}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function QuickAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ops-mini-button flex h-8 items-center justify-center overflow-hidden px-2 py-1 text-center text-[10px] leading-none"
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function CashFlowChart({ points }: { points: Array<{ label: string; collected: number; expected: number }> }) {
  const max = Math.max(...points.flatMap((point) => [point.collected, point.expected]), 1);
  const coords = points.map((point, index) => {
    const x = 8 + (index * 84) / Math.max(points.length - 1, 1);
    const y = 82 - (point.collected / max) * 66;
    const expectedY = 82 - (point.expected / max) * 66;
    return { ...point, x, y, expectedY };
  });
  const collectedPath = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const expectedPath = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.expectedY}`).join(' ');

  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Collected</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-muted-foreground" /> Expected</span>
      </div>
      <svg viewBox="0 0 100 90" className="h-28 w-full overflow-visible">
        {[18, 34, 50, 66, 82].map((y) => (
          <line key={y} x1="4" x2="96" y1={y} y2={y} stroke="hsl(var(--border))" strokeOpacity="0.55" strokeWidth="0.4" />
        ))}
        <path d={expectedPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" strokeOpacity="0.8" strokeWidth="1.2" />
        <path d={collectedPath} fill="none" stroke="hsl(var(--success))" strokeWidth="1.6" />
        {coords.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="1.6" fill="hsl(var(--success))" />
        ))}
      </svg>
      <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-2 text-[11px]">
        <div>
          <p className="text-muted-foreground">MTD Collected</p>
          <p className="font-semibold">{formatCurrency(points.at(-1)?.collected || 0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">MTD Expected</p>
          <p className="font-semibold">{formatCurrency(points.at(-1)?.expected || 0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Variance</p>
          <p className={(points.at(-1)?.collected || 0) - (points.at(-1)?.expected || 0) >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
            {formatCurrency((points.at(-1)?.collected || 0) - (points.at(-1)?.expected || 0))}
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, detail }: { label: string; value: number; max: number; detail: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[1fr_90px_44px] items-center gap-3 text-xs">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-right font-medium">{detail}</span>
    </div>
  );
}

function Donut({ urgent, progress, complete }: { urgent: number; progress: number; complete: number }) {
  const total = Math.max(urgent + progress + complete, 1);
  const urgentAngle = (urgent / total) * 360;
  const progressAngle = urgentAngle + (progress / total) * 360;
  return (
    <div
      className="grid h-28 w-28 place-items-center rounded-full"
      style={{
        background: `conic-gradient(hsl(var(--destructive)) 0deg ${urgentAngle}deg, hsl(var(--warning)) ${urgentAngle}deg ${progressAngle}deg, hsl(var(--success)) ${progressAngle}deg 360deg)`,
      }}
    >
      <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-card text-center">
        <div>
          <p className="text-2xl font-bold leading-none">{total}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
      </div>
    </div>
  );
}

export function AdminCommandCenter({
  managerId,
  managerName,
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

  const model = useMemo(() => {
    const now = new Date();
    const currentMonth = { start: startOfMonth(now), end: endOfMonth(now) };
    const completedPayments = payments.filter((payment) => payment.status === 'completed');
    const currentMonthCompleted = completedPayments.filter((payment) =>
      isWithinInterval(getPaymentDate(payment), currentMonth)
    );
    const currentMonthCollected = currentMonthCompleted.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const expectedMonthlyRentFromLeases = leases
      .filter((lease) => lease.status === 'completed')
      .reduce((sum, lease) => sum + Number(lease.monthly_rent || 0), 0);
    const expectedMonthlyRentFromTenants = tenants.reduce(
      (sum, tenant) => sum + Number(tenant.assignment_rent_total || tenant.primary_rent_amount || tenant.rent_amount || 0),
      0
    );
    const expectedMonthlyRent = expectedMonthlyRentFromLeases || expectedMonthlyRentFromTenants;
    const collectionRate = expectedMonthlyRent > 0 ? Math.min((currentMonthCollected / expectedMonthlyRent) * 100, 100) : 0;
    const processingAch = payments.filter((payment) => payment.status === 'processing' && payment.payment_method_type === 'ach');
    const staleAch = processingAch.filter((payment) => isStaleProcessingACH(payment));
    const failedPayments = payments.filter((payment) => isFailedPaymentStatus(payment.status));
    const balanceReviewPayments = completedPayments.filter((payment) => !hasPaymentBalanceApplied(payment));
    const activeCompletedLeaseTenantIds = new Set(
      leases
        .filter((lease) => lease.status === 'completed')
        .filter((lease) => new Date(lease.start_date) <= now && new Date(lease.end_date) >= now)
        .map((lease) => lease.tenant_id)
    );
    const isBillableTenant = (tenant: TenantRecord) =>
      Boolean(
        tenant.primary_property ||
        Number(tenant.active_assignment_count || 0) > 0 ||
        activeCompletedLeaseTenantIds.has(tenant.user_id)
      );
    const billableTenants = tenants.filter(isBillableTenant);
    const setupReviewBalance = tenants
      .filter((tenant) => !isBillableTenant(tenant))
      .reduce((sum, tenant) => sum + Math.max(Number(tenant.current_balance || 0), 0), 0);
    const outstandingBalance = billableTenants.reduce((sum, tenant) => sum + Math.max(Number(tenant.current_balance || 0), 0), 0);
    const pendingAchByTenant = new Map<string, number>();
    processingAch.forEach((payment) => {
      pendingAchByTenant.set(payment.tenant_id, (pendingAchByTenant.get(payment.tenant_id) || 0) + Number(payment.amount));
    });
    const effectiveOutstanding = billableTenants.reduce((sum, tenant) => {
      const balance = Math.max(Number(tenant.current_balance || 0), 0);
      return sum + Math.max(balance - (pendingAchByTenant.get(tenant.id) || 0), 0);
    }, 0);
    const occupiedProperties = properties.filter((property) => property.status === 'occupied');
    const occupancyRate = properties.length > 0 ? (occupiedProperties.length / properties.length) * 100 : 0;
    const pendingApplications = applications.filter((application) => ['pending', 'under_review'].includes(application.status));
    const approvedApplications = applications.filter((application) => application.status === 'approved');
    const leaseRenewals = leases
      .filter((lease) => lease.status === 'completed')
      .filter((lease) => differenceInDays(new Date(lease.end_date), now) <= 60)
      .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
    const pastDueLeases = leases.filter((lease) => lease.status !== 'completed');
    const openMaintenance = maintenance.filter((record) => !['completed', 'paid', 'closed', 'resolved'].includes((record.status || '').toLowerCase()));
    const urgentMaintenance = openMaintenance.filter((record) => ['urgent', 'high', 'emergency'].some((word) => `${record.category} ${record.title} ${record.status}`.toLowerCase().includes(word)));
    const completedMaintenance = maintenance.filter((record) => ['completed', 'paid', 'closed', 'resolved'].includes((record.status || '').toLowerCase()));
    const maintenanceSla = maintenance.length > 0 ? (completedMaintenance.length / maintenance.length) * 100 : 0;
    const leasePotential = leaseRenewals.reduce((sum, lease) => sum + Number(lease.monthly_rent || 0), 0);
    const last30Start = subDays(now, 30);
    const last30Collected = completedPayments
      .filter((payment) => getPaymentDate(payment) >= last30Start)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const chartPoints = Array.from({ length: 6 }, (_, index) => {
      const date = addDays(startOfMonth(now), index * 5);
      const collected = completedPayments
        .filter((payment) => getPaymentDate(payment) <= date && isWithinInterval(getPaymentDate(payment), currentMonth))
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const expected = expectedMonthlyRent ? (expectedMonthlyRent / 6) * (index + 1) : Math.max(last30Collected, 1) * ((index + 1) / 6);
      return { label: format(date, 'MMM d'), collected, expected };
    });

    return {
      now,
      completedPayments,
      currentMonthCompleted,
      currentMonthCollected,
      expectedMonthlyRent,
      collectionRate,
      processingAch,
      staleAch,
      failedPayments,
      balanceReviewPayments,
      outstandingBalance,
      effectiveOutstanding,
      setupReviewBalance,
      pendingAchTotal: processingAch.reduce((sum, payment) => sum + Number(payment.amount), 0),
      occupiedProperties,
      occupancyRate,
      pendingApplications,
      approvedApplications,
      leaseRenewals,
      pastDueLeases,
      openMaintenance,
      urgentMaintenance,
      completedMaintenance,
      maintenanceSla,
      leasePotential,
      last30Collected,
      chartPoints,
    };
  }, [applications, leases, maintenance, payments, properties, tenants]);

  const priorities = useMemo<PriorityAction[]>(() => {
    const overdueTotal = overdueTenants.reduce((sum, tenant) => sum + tenant.amountOwed, 0);
    return [
      {
        title: 'Overdue Rent',
        value: formatCurrency(overdueTotal || model.effectiveOutstanding),
        detail: `${overdueTenants.length || tenants.filter((tenant) => Number(tenant.current_balance || 0) > 0).length} tenants`,
        cta: 'Take action',
        icon: AlertTriangle,
        tone: 'red',
        action: () => onNavigateTab('tenants', { tenantFilter: 'balance-due' }),
      },
      {
        title: 'Leases Expiring Soon',
        value: String(model.leaseRenewals.length),
        detail: 'Next 60 days',
        cta: 'Review leases',
        icon: CalendarClock,
        tone: 'gold',
        action: () => onNavigateTab('leases'),
      },
      {
        title: 'Maintenance Issues',
        value: String(model.openMaintenance.length),
        detail: `${model.urgentMaintenance.length} urgent`,
        cta: 'View work orders',
        icon: Wrench,
        tone: 'red',
        action: () => onNavigateTab('maintenance'),
      },
      {
        title: 'Pending Applications',
        value: String(model.pendingApplications.length),
        detail: 'Needs review',
        cta: 'Review now',
        icon: Building2,
        tone: 'teal',
        action: () => onNavigateTab('applications'),
      },
      {
        title: 'Payments Review',
        value: String(model.staleAch.length + model.failedPayments.length + model.balanceReviewPayments.length),
        detail: `${formatCurrency(model.pendingAchTotal)} pending ACH`,
        cta: 'Open payments',
        icon: Receipt,
        tone: 'amber',
        action: () => onNavigateTab('audit', { paymentFilter: 'needs-review' }),
      },
    ];
  }, [model, onNavigateTab, overdueTenants, tenants]);

  const recentPayments = model.completedPayments.slice(0, 5);
  const portfolioHealth = model.failedPayments.length + model.balanceReviewPayments.length + model.staleAch.length === 0;
  const displayName = getShortName(managerName);

  return (
    <div className="space-y-2.5 animate-fade-in">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold text-primary">Command Center</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            {getGreeting()}, {displayName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's how your portfolio is performing today.</p>
        </div>
        <Button variant="outline" className="h-10 justify-between gap-4 border-border/70 bg-card/70 text-sm">
          <CalendarClock className="h-4 w-4 text-primary" />
          {format(new Date(), 'MMM d, yyyy')}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </section>

      <section className="-mt-2 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard
          label="Collected this month"
          value={formatCurrency(model.currentMonthCollected)}
          detail={`${formatPercent(model.collectionRate)} of ${formatCurrency(model.expectedMonthlyRent)} goal`}
          trend={`${model.currentMonthCompleted.length} completed payments this month`}
          icon={DollarSign}
          tone="gold"
          progress={model.collectionRate}
          onClick={() => onNavigateTab('audit', { paymentFilter: 'completed' })}
        />
        <KpiCard
          label="Effective balance due"
          value={formatCurrency(model.effectiveOutstanding)}
          detail={model.setupReviewBalance > 0 ? `${formatCurrency(model.setupReviewBalance)} in setup review` : `${formatCurrency(model.outstandingBalance)} official balance`}
          trend="Excludes fresh pending ACH"
          icon={Receipt}
          tone={model.effectiveOutstanding > 0 ? 'amber' : 'green'}
          actionLabel="Aging"
          onClick={() => onNavigateTab('tenants', { tenantFilter: 'balance-due' })}
        />
        <KpiCard
          label="Pending ACH"
          value={formatCurrency(model.pendingAchTotal)}
          detail={`${model.processingAch.length} payments scheduled`}
          trend={model.staleAch.length > 0 ? `${model.staleAch.length} stale` : 'Fresh'}
          icon={Landmark}
          tone="teal"
          actionLabel="Review"
          onClick={() => onNavigateTab('audit', { paymentFilter: 'processing-ach' })}
        />
        <KpiCard
          label="Occupancy"
          value={formatPercent(model.occupancyRate)}
          detail={`${model.occupiedProperties.length} of ${properties.length} properties`}
          trend="Based on property status"
          icon={Target}
          tone="teal"
          onClick={() => onNavigateTab('properties')}
        />
        <KpiCard
          label="Lease renewals"
          value={String(model.leaseRenewals.length)}
          detail="Next 60 days"
          trend={`${formatCurrency(model.leasePotential)} potential`}
          icon={CalendarClock}
          tone="gold"
          onClick={() => onNavigateTab('leases')}
        />
        <KpiCard
          label="Maintenance SLA"
          value={formatPercent(model.maintenanceSla)}
          detail="On-time completion"
          trend={`${model.completedMaintenance.length} completed records`}
          icon={Wrench}
          tone={model.maintenanceSla >= 90 ? 'green' : 'amber'}
          onClick={() => onNavigateTab('maintenance')}
        />
      </section>

      <section className="ops-panel p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="ops-label text-foreground">Priority Actions</p>
            <Badge className="h-5 rounded-full bg-destructive px-2 text-[10px] text-white">
              {priorities.reduce((sum, item) => sum + Number(item.value.replace(/[^0-9.-]/g, '') || 0), 0) > 0 ? priorities.length : 0}
            </Badge>
            <p className="text-xs text-muted-foreground">Focus on these items to keep operations running smoothly.</p>
          </div>
          <button type="button" className="text-[11px] text-primary" onClick={() => onNavigateTab('audit')}>
            View all <ArrowRight className="inline h-3 w-3" />
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {priorities.map((item) => (
            <PriorityCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.1fr_0.7fr]">
        <div className="ops-panel min-h-[132px] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="ops-label text-primary">Portfolio Health</p>
              <p className="text-xs text-muted-foreground">Overall status of your portfolio and operations.</p>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onNavigateTab('analytics')}>
              View full report <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <HealthItem
              icon={ShieldCheck}
              label="Financial Health"
              value={portfolioHealth ? 'Healthy' : 'Warning'}
              detail={portfolioHealth ? 'Strong cash flow and collections' : 'Review payment exceptions'}
              tone={portfolioHealth ? 'green' : 'amber'}
            />
            <HealthItem
              icon={Building2}
              label="Occupancy Health"
              value={model.occupancyRate >= 85 ? 'Healthy' : 'Warning'}
              detail="Above market average"
              tone={model.occupancyRate >= 85 ? 'green' : 'amber'}
            />
            <HealthItem
              icon={Zap}
              label="Operational Health"
              value={model.openMaintenance.length > 0 ? 'Warning' : 'Healthy'}
              detail="Elevated maintenance volume"
              tone={model.openMaintenance.length > 0 ? 'amber' : 'green'}
            />
            <HealthItem
              icon={Gauge}
              label="Leasing Health"
              value={model.pendingApplications.length > 0 ? 'Healthy' : 'Watch'}
              detail="Strong pipeline activity"
              tone={model.pendingApplications.length > 0 ? 'green' : 'amber'}
            />
          </div>
        </div>

        <div className="ops-panel min-h-[132px] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="ops-label text-primary">Quick Actions</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <QuickAction label="Payments" icon={FilePlus2} onClick={() => onNavigateTab('audit')} />
            <QuickAction label="Ledger Review" icon={DollarSign} onClick={() => onNavigateTab('audit', { paymentFilter: 'all' as PaymentControlFilter })} />
            <QuickAction label="Work Orders" icon={Wrench} onClick={() => onNavigateTab('maintenance')} />
            <QuickAction label="Applications" icon={UserPlus} onClick={() => onNavigateTab('applications')} />
            <QuickAction label="Create Lease" icon={FilePlus2} onClick={onCreateLease} />
            <QuickAction label="Add Tenant" icon={UserPlus} onClick={onAddTenant} />
            <QuickAction label="Add Property" icon={Home} onClick={onAddProperty} />
            <QuickAction label="Messages" icon={MessageSquare} onClick={() => onNavigateTab('messages')} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr_0.95fr_1.1fr_1.1fr]">
        <div className="ops-panel p-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="ops-label text-foreground">Cash Flow Snapshot</p>
              <p className="text-[11px] text-muted-foreground">{format(startOfMonth(new Date()), 'MMM d')} - {format(new Date(), 'MMM d, yyyy')}</p>
            </div>
          </div>
          <CashFlowChart points={model.chartPoints} />
        </div>

        <div className="ops-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="ops-label text-foreground">Occupancy Summary</p>
              <p className="text-[11px] text-muted-foreground">By property</p>
            </div>
            <button type="button" className="text-[10px] text-primary" onClick={() => onNavigateTab('properties')}>View all</button>
          </div>
          <div className="space-y-3">
            {properties.slice(0, 5).map((property) => {
              const occupied = property.status === 'occupied' ? 1 : 0;
              return (
                <MiniBar
                  key={property.id}
                  label={property.address}
                  value={occupied}
                  max={1}
                  detail={property.status === 'occupied' ? '100%' : '0%'}
                />
              );
            })}
          </div>
          <div className="mt-4 border-t border-border/60 pt-3">
            <MiniBar label="Total Portfolio" value={model.occupiedProperties.length} max={properties.length || 1} detail={`${formatPercent(model.occupancyRate)}`} />
          </div>
        </div>

        <div className="ops-panel p-4">
          <div className="mb-3">
            <p className="ops-label text-foreground">Leasing Pipeline</p>
            <p className="text-[11px] text-muted-foreground">Total: {applications.length} prospects</p>
          </div>
          <div className="space-y-2">
            {[
              ['New Leads', applications.length],
              ['Under Review', model.pendingApplications.length],
              ['Approved', model.approvedApplications.length],
              ['Pending Signatures', leases.filter((lease) => lease.status.includes('pending')).length],
              ['Leases Signed', leases.filter((lease) => lease.status === 'completed').length],
            ].map(([label, value], index) => (
              <div key={label} className="relative flex items-center justify-between overflow-hidden rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-xs">
                <div
                  className="absolute inset-y-0 right-0 bg-success/20"
                  style={{ width: `${Math.max(18, Number(value) * 9 + 12 - index * 5)}%`, clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)' }}
                />
                <span className="relative text-muted-foreground">{label}</span>
                <span className="relative font-semibold">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-[11px]">
            <div><p className="text-muted-foreground">Conversion Rate</p><p className="font-semibold">{formatPercent(applications.length ? Math.min((leases.filter((lease) => lease.status === 'completed').length / applications.length) * 100, 100) : 0)}</p></div>
            <div><p className="text-muted-foreground">Avg. Days to Lease</p><p className="font-semibold">Not tracked</p></div>
          </div>
        </div>

        <div className="ops-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="ops-label text-foreground">Recent Payments</p>
            <button type="button" className="text-[10px] text-primary" onClick={() => onNavigateTab('audit')}>View all</button>
          </div>
          <div className="space-y-3">
            {recentPayments.map((payment) => {
              const tenant = tenants.find((item) => item.id === payment.tenant_id);
              return (
                <div key={payment.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tenant?.user?.full_name || tenant?.user?.email || 'Tenant payment'}</p>
                    <p className="text-[10px] text-muted-foreground">{format(parseISO(payment.payment_date), 'MMM d, yyyy')}</p>
                  </div>
                  <span className="font-medium">{formatCurrency(Number(payment.amount))}</span>
                  <Badge variant="outline" className={payment.payment_method_type === 'ach' ? 'border-success/30 bg-success/10 text-success' : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-300'}>
                    {payment.payment_method_type || payment.payment_method || 'card'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ops-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="ops-label text-foreground">Maintenance Overview</p>
            <button type="button" className="text-[10px] text-primary" onClick={() => onNavigateTab('maintenance')}>View all</button>
          </div>
          <div className="flex items-center gap-5">
            <Donut
              urgent={model.urgentMaintenance.length}
              progress={Math.max(model.openMaintenance.length - model.urgentMaintenance.length, 0)}
              complete={model.completedMaintenance.length}
            />
            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted-foreground"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-destructive" />Urgent</span><span>{model.urgentMaintenance.length}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-warning" />In Progress</span><span>{Math.max(model.openMaintenance.length - model.urgentMaintenance.length, 0)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-success" />Completed</span><span>{model.completedMaintenance.length}</span></div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-[11px]">
            <div><p className="text-muted-foreground">Avg. Response Time</p><p className="font-semibold">Not tracked</p></div>
            <div><p className="text-muted-foreground">On-Time Completion</p><p className="font-semibold">{formatPercent(model.maintenanceSla)}</p></div>
          </div>
        </div>
      </section>
    </div>
  );
}
