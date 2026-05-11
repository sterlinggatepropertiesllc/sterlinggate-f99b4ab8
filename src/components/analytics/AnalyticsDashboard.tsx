import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AdminButton, AdminStatusBadge, PageHeader, SectionCard, StatCard } from '@/components/admin/AdminDesignSystem';

const PROPERTY_PERFORMANCE_PAGE_SIZE = 10;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatPercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

function InsightPanel({
  tone,
  title,
  value,
  detail,
}: {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
      <AdminStatusBadge tone={tone}>{title}</AdminStatusBadge>
      <p className="mt-3 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  max,
  tone = 'success',
  formatter = formatCurrency,
}: {
  label: string;
  value: number;
  max: number;
  tone?: 'success' | 'warning' | 'danger' | 'gold';
  formatter?: (value: number) => string;
}) {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = tone === 'danger' ? 'bg-destructive' : tone === 'warning' ? 'bg-warning' : tone === 'gold' ? 'bg-primary' : 'bg-success';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatter(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/65">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(width, value > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const analytics = useAnalytics(user?.id);
  const [isPropertyPerformanceOpen, setIsPropertyPerformanceOpen] = useState(false);
  const [propertyPerformancePage, setPropertyPerformancePage] = useState(1);
  const collectionMax = Math.max(
    analytics.currentMonthRevenue,
    analytics.pendingAchTotal,
    analytics.outstandingBalanceDue,
    1
  );
  const propertyPerformanceItems = analytics.revenueByProperty;
  const propertyPerformancePageCount = Math.max(
    Math.ceil(propertyPerformanceItems.length / PROPERTY_PERFORMANCE_PAGE_SIZE),
    1
  );
  const propertyPerformanceStart = (propertyPerformancePage - 1) * PROPERTY_PERFORMANCE_PAGE_SIZE;
  const visiblePropertyPerformance = useMemo(
    () => propertyPerformanceItems.slice(
      propertyPerformanceStart,
      propertyPerformanceStart + PROPERTY_PERFORMANCE_PAGE_SIZE
    ),
    [propertyPerformanceItems, propertyPerformanceStart]
  );
  const propertyPerformanceSummary = useMemo(() => {
    const totalRevenue = propertyPerformanceItems.reduce((sum, property) => sum + property.revenue, 0);
    const occupiedCount = propertyPerformanceItems.filter((property) => property.status === 'occupied').length;
    const availableCount = propertyPerformanceItems.filter((property) => property.status === 'available').length;
    const setupNeededCount = Math.max(propertyPerformanceItems.length - occupiedCount - availableCount, 0);

    return {
      totalRevenue,
      occupiedCount,
      availableCount,
      setupNeededCount,
      topProperty: propertyPerformanceItems[0],
    };
  }, [propertyPerformanceItems]);
  const topPropertyMax = Math.max(...propertyPerformanceItems.map((property) => property.revenue), 1);
  const leaseActive = analytics.activeLeases;
  const leasePending = analytics.pendingLeases;
  const leaseTotal = Math.max(leaseActive + leasePending, 1);

  useEffect(() => {
    setPropertyPerformancePage((page) => Math.min(page, propertyPerformancePageCount));
  }, [propertyPerformancePageCount]);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Portfolio Analytics"
        subtitle="Real-time insight into portfolio performance, collections, and occupancy."
        actions={
          <>
            <select className="h-9 rounded-md border border-border/70 bg-card px-3 text-xs text-muted-foreground outline-none">
              <option>May 2026</option>
              <option>Last 30 days</option>
              <option>Quarter to date</option>
            </select>
            <select className="h-9 rounded-md border border-border/70 bg-card px-3 text-xs text-muted-foreground outline-none">
              <option>All properties</option>
              {analytics.revenueByProperty.map((property) => (
                <option key={property.id}>{property.name}</option>
              ))}
            </select>
            <AdminButton variant="secondary">Export report</AdminButton>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="MTD collected" value={formatCurrency(analytics.currentMonthRevenue)} detail={`${analytics.currentMonthPaymentCount} completed this month`} tone="success" />
        <StatCard label="Collection rate" value={formatPercent(analytics.collectionRate)} detail={`${formatCurrency(analytics.expectedMonthlyRent)} expected rent`} tone={analytics.collectionRate >= 90 ? 'success' : 'warning'} progress={analytics.collectionRate} />
        <StatCard label="Occupancy rate" value={formatPercent(analytics.occupancyRate)} detail={`${analytics.occupiedProperties} of ${analytics.totalProperties} properties`} tone="teal" progress={analytics.occupancyRate} />
        <StatCard label="Balance due" value={formatCurrency(analytics.outstandingBalanceDue)} detail="Open tenant ledger balance" tone={analytics.outstandingBalanceDue > 0 ? 'warning' : 'success'} />
        <StatCard label="Pending ACH" value={formatCurrency(analytics.pendingAchTotal)} detail={`${analytics.failedPaymentCount} payment exceptions`} tone={analytics.pendingAchTotal > 0 ? 'gold' : 'neutral'} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <SectionCard title="Revenue & Collections Trend" subtitle="Completed Stripe and manual payments over the past 12 months.">
          <div className="h-[280px]">
            <AreaChart
              data={analytics.monthlyRevenue}
              margin={{ top: 12, right: 8, left: -14, bottom: 0 }}
              responsive
              style={{ width: '100%', height: '100%' }}
            >
              <defs>
                <linearGradient id="sterlingRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
              <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 10,
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#sterlingRevenueFill)" />
            </AreaChart>
          </div>
        </SectionCard>

        <SectionCard title="Collections Breakdown" subtitle="Cash that is settled, pending, or still owed.">
          <div className="space-y-5">
            <BreakdownRow label="Collected MTD" value={analytics.currentMonthRevenue} max={collectionMax} tone="success" />
            <BreakdownRow label="Pending ACH" value={analytics.pendingAchTotal} max={collectionMax} tone="gold" />
            <BreakdownRow label="Outstanding" value={analytics.outstandingBalanceDue} max={collectionMax} tone="warning" />
            <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
              Failed payments are kept visible as exceptions, not counted as collected cash.
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Top Property Performance"
        subtitle="Collected revenue by property with current occupancy state."
        action={
          <AdminButton
            type="button"
            variant="secondary"
            onClick={() => setIsPropertyPerformanceOpen((open) => !open)}
          >
            {isPropertyPerformanceOpen ? 'Collapse' : 'View details'}
            {isPropertyPerformanceOpen ? <ChevronUp className="ml-2 h-3.5 w-3.5" /> : <ChevronDown className="ml-2 h-3.5 w-3.5" />}
          </AdminButton>
        }
      >
        <div className="space-y-4">
          {propertyPerformanceItems.length > 0 ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-border/55 bg-muted/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tracked</p>
                  <p className="mt-2 text-xl font-semibold">{propertyPerformanceItems.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">properties in portfolio</p>
                </div>
                <div className="rounded-lg border border-success/25 bg-success/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Collected</p>
                  <p className="mt-2 text-xl font-semibold text-success">{formatCurrency(propertyPerformanceSummary.totalRevenue)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">from property ledger</p>
                </div>
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Top performer</p>
                  <p className="mt-2 truncate text-sm font-semibold">{propertyPerformanceSummary.topProperty?.name || 'No data'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(propertyPerformanceSummary.topProperty?.revenue || 0)}</p>
                </div>
                <div className="rounded-lg border border-border/55 bg-muted/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status mix</p>
                  <p className="mt-2 text-sm font-semibold">
                    {propertyPerformanceSummary.occupiedCount} occupied · {propertyPerformanceSummary.availableCount} available
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{propertyPerformanceSummary.setupNeededCount} setup needed</p>
                </div>
              </div>

              {isPropertyPerformanceOpen && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 border-t border-border/55 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Showing {propertyPerformanceStart + 1}-{Math.min(propertyPerformanceStart + PROPERTY_PERFORMANCE_PAGE_SIZE, propertyPerformanceItems.length)} of {propertyPerformanceItems.length} properties.
                    </p>
                    {propertyPerformancePageCount > 1 && (
                      <div className="flex items-center gap-2">
                        <AdminButton
                          type="button"
                          variant="secondary"
                          disabled={propertyPerformancePage === 1}
                          onClick={() => setPropertyPerformancePage((page) => Math.max(page - 1, 1))}
                        >
                          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                          Previous
                        </AdminButton>
                        <span className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                          Page {propertyPerformancePage} of {propertyPerformancePageCount}
                        </span>
                        <AdminButton
                          type="button"
                          variant="secondary"
                          disabled={propertyPerformancePage === propertyPerformancePageCount}
                          onClick={() => setPropertyPerformancePage((page) => Math.min(page + 1, propertyPerformancePageCount))}
                        >
                          Next
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </AdminButton>
                      </div>
                    )}
                  </div>

                  {visiblePropertyPerformance.map((property) => {
                    const percent = topPropertyMax > 0 ? (property.revenue / topPropertyMax) * 100 : 0;
                    return (
                      <div key={property.id} className="grid gap-3 rounded-lg border border-border/45 bg-muted/10 p-3 md:grid-cols-[1fr_140px_150px] md:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{property.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{property.status === 'occupied' ? 'Occupied' : property.status === 'available' ? 'Available' : 'Setup needed'}</p>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-success" style={{ width: `${Math.max(percent, property.revenue > 0 ? 4 : 0)}%` }} />
                        </div>
                        <p className="text-right text-sm font-semibold">{formatCurrency(property.revenue)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">No property revenue yet.</div>
          )}
        </div>
      </SectionCard>

      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Occupancy Mix" subtitle="Configured property status.">
          <div className="space-y-3">
            {analytics.propertyStatusDistribution.length > 0 ? analytics.propertyStatusDistribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">No property status data yet.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Lease Status / Renewals" subtitle="Signature pipeline and active terms.">
          <div className="space-y-4">
            <BreakdownRow label="Active leases" value={leaseActive} max={leaseTotal} tone="success" formatter={(value) => String(value)} />
            <BreakdownRow label="Pending signatures" value={leasePending} max={leaseTotal} tone="warning" formatter={(value) => String(value)} />
          </div>
        </SectionCard>

        <SectionCard title="Aging Balance Overview" subtitle="Outstanding balance pressure.">
          <div className="space-y-3">
            <p className="text-3xl font-semibold tracking-tight">{formatCurrency(analytics.outstandingBalanceDue)}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {analytics.outstandingBalanceDue > 0
                ? 'Keep the aging report and ACH queue aligned before sending late notices.'
                : 'No outstanding tenant balance is currently visible in the ledger.'}
            </p>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-3 rounded-xl border border-border/70 bg-card p-3 lg:grid-cols-3">
        <InsightPanel tone="success" title="Positive" value={`${analytics.occupiedProperties} occupied`} detail="Occupancy remains the main operational anchor for the portfolio." />
        <InsightPanel tone="warning" title="Watch" value={formatCurrency(analytics.pendingAchTotal)} detail="Pending ACH should stay out of late notices until it clears or fails." />
        <InsightPanel tone="danger" title="Risk" value={formatCurrency(analytics.outstandingBalanceDue)} detail="Open balances should be reviewed against payments before tenant outreach." />
      </section>
    </div>
  );
}
