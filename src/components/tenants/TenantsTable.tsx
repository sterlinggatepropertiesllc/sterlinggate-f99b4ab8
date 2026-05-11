import { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
  MoreHorizontal,
  Search,
  Trash2,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useHardDeleteTenant } from '@/hooks/useTenants';
import { useIsMobile } from '@/hooks/use-mobile';
import { AdminButton, FilterTabs } from '@/components/admin/AdminDesignSystem';
import { MobileSwipeActions } from '@/components/admin/MobileSwipeActions';
import type { Payment } from '@/hooks/usePayments';
import type { TenantHealthFilter, TenantRecord } from '@/components/admin/adminTypes';
import { computeTenantFinancialHealth } from '@/lib/paymentReliability';
import { formatDisplayDate, parseDisplayDate } from '@/lib/dateUtils';

interface TenantsTableProps {
  tenants: TenantRecord[];
  payments?: Payment[];
  healthFilter?: TenantHealthFilter;
  onHealthFilterChange?: (filter: TenantHealthFilter) => void;
  onNavigate: (tenantId: string) => void;
  onAddTenant?: () => void;
}

type LeaseStatus = 'active' | 'pending' | 'expired' | 'unassigned';
type SortMode = 'name' | 'balance' | 'payment' | 'due';

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

function formatDate(value?: string | null) {
  return formatDisplayDate(value);
}

function tenantName(tenant: TenantRecord) {
  return tenant.user?.full_name || tenant.user?.email || 'Unassigned Tenant';
}

function balanceLabel(value: number) {
  if (value > 0) return `${formatCurrency(value)} due`;
  if (value < 0) return `${formatCurrency(Math.abs(value))} credit`;
  return 'Current';
}

function rentLabel(tenant: TenantRecord) {
  const totalRent = Number(tenant.assignment_rent_total || tenant.primary_rent_amount || 0);
  return totalRent > 0 ? `${formatCurrency(totalRent)}/mo` : '--';
}

function assignedPropertyLabel(tenant: TenantRecord) {
  const addresses = tenant.assigned_properties
    ?.map((assignment) => assignment.property?.address)
    .filter(Boolean) as string[] | undefined;

  if (addresses?.length) {
    return addresses.length > 1 ? `${addresses[0]} + ${addresses.length - 1} more` : addresses[0];
  }

  return tenant.assigned_property_summary || tenant.primary_property?.address || '--';
}

function leaseStatus(tenant: TenantRecord): LeaseStatus {
  if (!tenant.primary_property) return 'unassigned';
  if (!tenant.primary_lease_start || !tenant.primary_lease_end) return 'pending';

  const now = new Date();
  const start = new Date(tenant.primary_lease_start);
  const end = new Date(tenant.primary_lease_end);

  if (end < now) return 'expired';
  if (start > now) return 'pending';
  return 'active';
}

function healthMatchesFilter(health: ReturnType<typeof computeTenantFinancialHealth>, filter: TenantHealthFilter) {
  switch (filter) {
    case 'balance-due':
      return health.hasBalanceDue;
    case 'pending-ach':
      return health.pendingACH > 0;
    case 'unassigned':
      return health.isUnassigned;
    case 'paid-up':
      return health.isPaidUp;
    default:
      return true;
  }
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone: 'gold' | 'red' | 'green';
}) {
  const toneClass = tone === 'red' ? 'text-destructive border-destructive/25 bg-destructive/10' : tone === 'green' ? 'text-success border-success/25 bg-success/10' : 'text-primary border-primary/25 bg-primary/10';

  return (
    <div className="ops-panel min-h-[96px] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="ops-label">{label}</p>
        <span className={`mt-1 h-1.5 w-8 rounded-full ${toneClass}`} />
      </div>
      <p className="mt-3 text-2xl font-bold leading-none">{value}</p>
      <p className={tone === 'red' ? 'mt-1.5 text-[10px] text-destructive' : 'mt-1.5 text-[10px] text-muted-foreground'}>{detail}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: LeaseStatus }) {
  const copy = {
    active: 'Active',
    pending: 'Pending',
    expired: 'Past due',
    unassigned: 'Unassigned',
  }[status];
  const className = {
    active: 'border-success/35 bg-success/10 text-success',
    pending: 'border-warning/35 bg-warning/10 text-warning',
    expired: 'border-destructive/35 bg-destructive/10 text-destructive',
    unassigned: 'border-primary/35 bg-primary/10 text-primary',
  }[status];

  return <Badge variant="outline" className={`rounded-md px-2 py-0.5 text-[10px] ${className}`}>{copy}</Badge>;
}

function DeleteTenantButton({
  tenant,
  deletingTenantId,
  onDelete,
}: {
  tenant: TenantRecord;
  deletingTenantId: string | null;
  onDelete: (id: string) => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md border border-border/60 bg-card/40 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          disabled={deletingTenantId === tenant.id}
          aria-label="More tenant actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently Delete Tenant?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete <strong className="text-foreground">{tenant.user?.full_name || 'this tenant'}</strong>?
              </p>
              <p className="font-medium text-foreground">This removes assignments, rent charge history, payments, and balance adjustments.</p>
              <p className="text-sm pt-2 border-t">
                <strong className="text-foreground">This action cannot be undone.</strong>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(tenant.id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Tenant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TenantsTable({
  tenants,
  payments = [],
  healthFilter = 'all',
  onHealthFilterChange,
  onNavigate,
  onAddTenant,
}: TenantsTableProps) {
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeaseStatus>('all');
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const hardDeleteTenant = useHardDeleteTenant();
  const isMobile = useIsMobile();

  const tenantsWithHealth = useMemo(() => tenants.map((tenant) => ({
    tenant,
    health: computeTenantFinancialHealth(tenant, payments),
    status: leaseStatus(tenant),
  })), [payments, tenants]);

  const healthCounts = {
    all: tenantsWithHealth.length,
    'balance-due': tenantsWithHealth.filter(({ health }) => health.hasBalanceDue).length,
    'pending-ach': tenantsWithHealth.filter(({ health }) => health.pendingACH > 0).length,
    unassigned: tenantsWithHealth.filter(({ health }) => health.isUnassigned).length,
    'paid-up': tenantsWithHealth.filter(({ health }) => health.isPaidUp).length,
  };

  const visibleTenants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tenantsWithHealth
      .filter(({ health }) => healthMatchesFilter(health, healthFilter))
      .filter(({ status }) => statusFilter === 'all' || status === statusFilter)
      .filter(({ tenant }) => {
        if (!normalizedQuery) return true;
        return [
          tenant.user?.full_name,
          tenant.user?.email,
          tenant.user?.phone,
          tenant.assigned_property_summary,
          tenant.primary_property?.address,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (sortMode === 'balance') return b.health.effectiveBalance - a.health.effectiveBalance;
        if (sortMode === 'payment') {
          return (parseDisplayDate(b.health.lastCompletedPayment?.payment_date)?.getTime() || 0) - (parseDisplayDate(a.health.lastCompletedPayment?.payment_date)?.getTime() || 0);
        }
        if (sortMode === 'due') {
          return new Date(a.tenant.primary_lease_end || 8640000000000000).getTime() - new Date(b.tenant.primary_lease_end || 8640000000000000).getTime();
        }
        return tenantName(a.tenant).localeCompare(tenantName(b.tenant));
      });
  }, [healthFilter, query, sortMode, statusFilter, tenantsWithHealth]);

  const balanceDue = tenantsWithHealth.reduce((sum, { health }) => (health.hasBalanceDue ? sum + Math.max(health.effectiveBalance, 0) : sum), 0);
  const pendingAch = tenantsWithHealth.reduce((sum, { health }) => sum + health.pendingACH, 0);
  const atRisk = tenantsWithHealth.filter(({ health, status }) => health.hasBalanceDue || status === 'unassigned').length;

  const handleDelete = async (tenantId: string) => {
    setDeletingTenantId(tenantId);
    try {
      await hardDeleteTenant.mutateAsync(tenantId);
    } finally {
      setDeletingTenantId(null);
    }
  };

  const filterItems = [
    { id: 'all' as TenantHealthFilter, label: 'All', count: healthCounts.all },
    { id: 'paid-up' as TenantHealthFilter, label: 'Current', count: healthCounts['paid-up'] },
    { id: 'balance-due' as TenantHealthFilter, label: 'Balance Due', count: healthCounts['balance-due'] },
    { id: 'pending-ach' as TenantHealthFilter, label: 'Pending ACH', count: healthCounts['pending-ach'] },
    { id: 'unassigned' as TenantHealthFilter, label: 'Unassigned', count: healthCounts.unassigned },
  ];

  if (isMobile) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage and support your active tenant base.</p>
          </div>
          <AdminButton onClick={onAddTenant} className="shrink-0">Add</AdminButton>
        </div>

        <section className="grid grid-cols-2 gap-3">
          <MetricCard label="Tenants" value={String(tenants.length)} detail={`${healthCounts['paid-up']} current`} icon={Users} tone="gold" />
          <MetricCard label="Balance due" value={formatCurrency(balanceDue)} detail="Open balance" icon={WalletCards} tone="red" />
          <MetricCard label="Pending ACH" value={formatCurrency(pendingAch)} detail="Processing" icon={Banknote} tone="gold" />
          <MetricCard label="At risk" value={String(atRisk)} detail="Needs review" icon={UserRound} tone="green" />
        </section>

        <FilterTabs items={filterItems} value={healthFilter} onChange={(item) => onHealthFilterChange?.(item)} />

        <section className="ops-panel p-3">
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tenants..."
                className="h-10 rounded-md border-border/70 bg-card pl-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | LeaseStatus)}
                className="h-10 rounded-md border border-border/70 bg-card px-3 text-xs text-muted-foreground outline-none"
              >
                <option value="all">Lease status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Past due</option>
                <option value="unassigned">Unassigned</option>
              </select>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-10 rounded-md border border-border/70 bg-card px-3 text-xs text-muted-foreground outline-none"
              >
                <option value="name">Name A-Z</option>
                <option value="balance">Balance due</option>
                <option value="payment">Last payment</option>
                <option value="due">Next due</option>
              </select>
            </div>
          </div>
        </section>

        <div className="grid gap-3">
          {visibleTenants.map(({ tenant, health, status }) => {
            const lastPayment = health.lastCompletedPayment;
            const needsSetup = health.needsSetupReview || status === 'unassigned';
            const financialStatus = needsSetup
              ? 'Setup review'
              : health.hasBalanceDue
                ? 'Balance due'
                : health.pendingACH > 0
                  ? 'ACH pending'
                  : 'Healthy';
            const financialClass = needsSetup
              ? 'border-warning/30 bg-warning/10 text-warning'
              : health.hasBalanceDue
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : health.pendingACH > 0
                  ? 'border-warning/30 bg-warning/10 text-warning'
                  : 'border-success/30 bg-success/10 text-success';

            return (
              <MobileSwipeActions
                key={tenant.id}
                ariaLabel={`Open tenant actions for ${tenantName(tenant)}`}
                onTap={() => onNavigate(tenant.id)}
                actions={[
                  {
                    key: 'open',
                    label: 'Open',
                    icon: Eye,
                    tone: 'primary',
                    onClick: () => onNavigate(tenant.id),
                  },
                  {
                    key: 'message',
                    label: 'Message',
                    icon: MessageSquare,
                    tone: 'success',
                    onClick: () => {
                      window.location.href = '/dashboard?tab=messages';
                    },
                  },
                ]}
              >
                <article className="ops-panel tap-feedback p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{tenantName(tenant)}</p>
                      <p className="truncate text-xs text-muted-foreground">{tenant.user?.email || 'No contact email'}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{assignedPropertyLabel(tenant)}</p>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border/55 bg-muted/10 p-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Balance</p>
                    <p className={health.hasBalanceDue ? 'mt-1 font-semibold text-destructive' : 'mt-1 font-semibold text-success'}>
                      {health.needsSetupReview ? `${formatCurrency(health.currentBalance)} review` : balanceLabel(health.effectiveBalance)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/55 bg-muted/10 p-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Rent</p>
                    <p className="mt-1 font-semibold text-foreground">{rentLabel(tenant)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/45 pt-3 text-xs">
                  <div className="min-w-0">
                    <Badge variant="outline" className={`rounded-md border px-2 py-0.5 text-[10px] ${financialClass}`}>
                      {financialStatus}
                    </Badge>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {lastPayment ? `Last paid ${formatCurrency(Number(lastPayment.amount))} on ${formatDate(lastPayment.payment_date)}` : 'No completed payment on file'}
                    </p>
                  </div>
                  <span className="shrink-0 text-primary">Tap / swipe</span>
                </div>
                </article>
              </MobileSwipeActions>
            );
          })}

          {visibleTenants.length === 0 && (
            <div className="ops-panel border-dashed p-6 text-center text-sm text-muted-foreground">
              No tenants match this mobile view.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage, track, and support your active tenant base.</p>
        </div>
        <AdminButton onClick={onAddTenant}>
          Add Tenant
        </AdminButton>
      </div>

      <section className="grid gap-3 lg:grid-cols-4">
        <MetricCard label="Total tenants" value={String(tenants.length)} detail={`${healthCounts['paid-up']} currently paid up`} icon={Users} tone="gold" />
        <MetricCard label="Balance due" value={formatCurrency(balanceDue)} detail="Open effective balance" icon={WalletCards} tone="red" />
        <MetricCard label="Pending ACH" value={formatCurrency(pendingAch)} detail="Bank payments in processing" icon={Banknote} tone="gold" />
        <MetricCard label="At risk / unassigned" value={String(atRisk)} detail="Balance or setup review" icon={UserRound} tone="green" />
      </section>

      <FilterTabs items={filterItems} value={healthFilter} onChange={(item) => onHealthFilterChange?.(item)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative min-w-[320px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tenants by name, email, or phone..."
            className="h-9 rounded-md border-border/70 bg-card pl-9 text-xs"
          />
        </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | LeaseStatus)}
            className="h-9 rounded-md border border-border/70 bg-card px-3 text-xs text-muted-foreground outline-none"
          >
            <option value="all">Lease Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="expired">Past due</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            value={healthFilter}
            onChange={(event) => onHealthFilterChange?.(event.target.value as TenantHealthFilter)}
            className="h-9 rounded-md border border-border/70 bg-card px-3 text-xs text-muted-foreground outline-none"
          >
            <option value="all">Financial Health</option>
            <option value="paid-up">Current</option>
            <option value="balance-due">Balance due</option>
            <option value="pending-ach">Pending ACH</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-9 rounded-md border border-border/70 bg-card px-3 text-xs text-muted-foreground outline-none"
          >
            <option value="name">Sort by: Name (A-Z)</option>
            <option value="balance">Sort by: Balance due</option>
            <option value="payment">Sort by: Last payment</option>
            <option value="due">Sort by: Next due</option>
          </select>
        </div>
      </div>

      <div className="ops-panel overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/70 bg-muted/20 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Tenant</th>
              <th className="px-4 py-3 font-semibold">Assigned Property / Unit</th>
              <th className="px-4 py-3 font-semibold">Lease Status</th>
              <th className="px-4 py-3 font-semibold">Financial Health</th>
              <th className="px-4 py-3 font-semibold">Rent / Lease</th>
              <th className="px-4 py-3 font-semibold">Last Payment</th>
              <th className="px-4 py-3 font-semibold">Next Due</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/45">
            {visibleTenants.map(({ tenant, health, status }) => {
              const lastPayment = health.lastCompletedPayment;
              const needsSetup = health.needsSetupReview || status === 'unassigned';
              const balanceTone = health.hasBalanceDue ? 'text-destructive' : health.hasCredit ? 'text-primary' : needsSetup ? 'text-warning' : 'text-success';
              const totalRent = Number(tenant.assignment_rent_total || tenant.primary_rent_amount || 0);
              const nextDueAmount = needsSetup ? 0 : Math.max(totalRent, health.hasBalanceDue ? health.effectiveBalance : 0);
              const financialStatus = needsSetup
                ? 'Setup review'
                : health.hasBalanceDue
                  ? 'Balance due'
                  : health.pendingACH > 0
                    ? 'ACH pending'
                    : 'Healthy';
              const financialClass = needsSetup
                ? 'border-warning/30 bg-warning/10 text-warning'
                : health.hasBalanceDue
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : health.pendingACH > 0
                    ? 'border-warning/30 bg-warning/10 text-warning'
                    : 'border-success/30 bg-success/10 text-success';

              return (
                <tr
                  key={tenant.id}
                  className="cursor-pointer transition-colors hover:bg-muted/25"
                  onClick={() => onNavigate(tenant.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{tenantName(tenant)}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{tenant.user?.email || 'No email'}</p>
                        <p className="text-[10px] text-muted-foreground">{tenant.user?.phone || 'No phone'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[190px] truncate text-foreground">{assignedPropertyLabel(tenant)}</p>
                    <Badge variant="secondary" className="mt-1 rounded bg-muted/60 px-1.5 py-0 text-[9px] text-muted-foreground">
                      {tenant.primary_property ? `Unit ${tenant.additional_properties_count ? `+${tenant.additional_properties_count}` : '1A'}` : 'Not assigned'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {tenant.primary_lease_start && tenant.primary_lease_end
                        ? `${formatDate(tenant.primary_lease_start)} - ${formatDate(tenant.primary_lease_end)}`
                        : 'No active lease'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`rounded-md border px-2 py-0.5 text-[10px] ${financialClass}`}>
                      {financialStatus}
                    </Badge>
                    <p className={`mt-1 text-[10px] ${balanceTone}`}>
                      {needsSetup ? 'No active billing source' : balanceLabel(health.effectiveBalance)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{rentLabel(tenant)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {lastPayment ? (
                      <div>
                        <p className="text-muted-foreground">{formatDate(lastPayment.payment_date)}</p>
                        <p className="font-medium">{formatCurrency(Number(lastPayment.amount))} <CheckCircle2 className="inline h-3 w-3 text-success" /></p>
                      </div>
                    ) : (
                      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">No payment</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-primary">{needsSetup ? '--' : tenant.primary_lease_end ? formatDate(tenant.primary_lease_end) : 'May 1, 2026'}</p>
                    <p className={health.hasBalanceDue ? 'font-medium text-destructive' : 'font-medium text-primary'}>{nextDueAmount ? formatCurrency(nextDueAmount) : '--'}</p>
                  </td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md border border-border/60 bg-card/40 text-muted-foreground hover:text-primary" onClick={() => onNavigate(tenant.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md border border-border/60 bg-card/40 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          window.location.href = '/dashboard?tab=messages';
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                      <DeleteTenantButton tenant={tenant} deletingTenantId={deletingTenantId} onDelete={handleDelete} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-[11px] text-muted-foreground">
          <span>Showing 1 to {visibleTenants.length} of {tenants.length} tenants</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled className="h-7 w-7 rounded-md border border-border/60 bg-card/45 opacity-60">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              className="h-7 w-7 rounded-md border border-primary/40 bg-primary/15 p-0 text-[11px] text-primary"
            >
              1
            </Button>
            <Button variant="ghost" size="icon" disabled className="h-7 w-7 rounded-md border border-border/60 bg-card/45 opacity-60">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {visibleTenants.length === 0 && (
        <div className="ops-panel border-dashed p-8 text-center text-muted-foreground">
          No tenants match this filter.
        </div>
      )}
    </div>
  );
}
