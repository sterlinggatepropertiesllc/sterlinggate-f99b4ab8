import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AdminButton, AdminStatusBadge, PageHeader, SectionCard, StatCard } from '@/components/admin/AdminDesignSystem';

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
  const collectionMax = Math.max(
    analytics.currentMonthRevenue,
    analytics.pendingAchTotal,
    analytics.outstandingBalanceDue,
    1
  );
  const topProperties = analytics.revenueByProperty.slice(0, 6);
  const topPropertyMax = Math.max(...topProperties.map((property) => property.revenue), 1);
  const leaseActive = analytics.activeLeases;
  const leasePending = analytics.pendingLeases;
  const leaseTotal = Math.max(leaseActive + leasePending, 1);

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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="MTD collected" value={formatCurrency(analytics.currentMonthRevenue)} detail={`${analytics.currentMonthPaymentCount} completed this month`} tone="success" />
        <StatCard label="Collection rate" value={formatPercent(analytics.collectionRate)} detail={`${formatCurrency(analytics.expectedMonthlyRent)} expected rent`} tone={analytics.collectionRate >= 90 ? 'success' : 'warning'} progress={analytics.collectionRate} />
        <StatCard label="Occupancy rate" value={formatPercent(analytics.occupancyRate)} detail={`${analytics.occupiedProperties} of ${analytics.totalProperties} properties`} tone="teal" progress={analytics.occupancyRate} />
        <StatCard label="Balance due" value={formatCurrency(analytics.outstandingBalanceDue)} detail="Open tenant ledger balance" tone={analytics.outstandingBalanceDue > 0 ? 'warning' : 'success'} />
        <StatCard label="Pending ACH" value={formatCurrency(analytics.pendingAchTotal)} detail={`${analytics.failedPaymentCount} payment exceptions`} tone={analytics.pendingAchTotal > 0 ? 'gold' : 'neutral'} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <SectionCard title="Revenue & Collections Trend" subtitle="Completed Stripe and manual payments over the past 12 months.">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyRevenue} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
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
            </ResponsiveContainer>
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

      <SectionCard title="Top Property Performance" subtitle="Collected revenue by property with current occupancy state.">
        <div className="space-y-3">
          {topProperties.length > 0 ? topProperties.map((property) => {
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
          }) : (
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
