import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  Receipt,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { OverdueRentAlert } from '@/components/notifications/OverdueRentAlert';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { AdminGlobalSearch } from '@/components/admin/AdminGlobalSearch';
import { TenantPropertiesTab } from '@/components/tenants/TenantPropertiesTab';
import { TenantBalanceTab } from '@/components/tenants/TenantBalanceTab';
import { TenantHistoryTab } from '@/components/tenants/TenantHistoryTab';
import { useManagerProperties } from '@/hooks/useProperties';
import { useApplications } from '@/hooks/useApplications';
import { useTenants } from '@/hooks/useTenants';
import { useLeases } from '@/hooks/useLeases';
import { useAllPayments, usePayments, type Payment } from '@/hooks/usePayments';
import { useUnreadCount } from '@/hooks/useMessages';
import { useUnreadPaymentNotifications } from '@/hooks/useUnreadPaymentNotifications';
import { useUnreadInquiriesCount } from '@/hooks/useInquiries';
import { useProfile } from '@/hooks/useProfiles';
import { useApplyLateFee, useRentCharges } from '@/hooks/useRentCharges';
import { computeTenantFinancialHealth, isFailedPaymentStatus, paymentAffectsTenantBalance } from '@/lib/paymentReliability';
import { formatDisplayDate, parseDisplayDate } from '@/lib/dateUtils';
import { getPaymentStatusDisplay, isIncompleteStripePayment } from '@/lib/paymentDisplay';
import type { AdminDashboardTab, TenantAssignedProperty, TenantRecord } from '@/components/admin/adminTypes';
import logo from '@/assets/logo.png';

type DetailTab = 'overview' | 'properties' | 'balance' | 'history';

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

function tenantName(tenant?: TenantRecord | null) {
  return tenant?.user?.full_name || tenant?.user?.email || 'Unnamed Tenant';
}

function shortId(value?: string | null) {
  if (!value) return '1A';
  const compact = value.replace(/[^a-zA-Z0-9]/g, '');
  return compact.slice(-2).toUpperCase() || '1A';
}

function monthsBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const startDate = parseDisplayDate(start);
  const endDate = parseDisplayDate(end);
  if (!startDate || !endDate) return 0;
  return Math.max(0, (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth());
}

function isBalancePayment(payment: Payment) {
  return payment.payment_type !== 'application_fee' && (
    !payment.payment_type || paymentAffectsTenantBalance(payment.payment_type)
  );
}

function paymentTimestamp(payment: Payment) {
  return parseDisplayDate(payment.payment_date)?.getTime()
    || parseDisplayDate(payment.created_at)?.getTime()
    || 0;
}

function sortPaymentsNewestFirst(a: Payment, b: Payment) {
  const dateDifference = paymentTimestamp(b) - paymentTimestamp(a);
  if (dateDifference !== 0) return dateDifference;
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}

function paymentMethodLabel(payment: Payment) {
  const method = (payment.payment_method_type || payment.payment_method || 'stripe').toLowerCase();
  if (method === 'ach') return 'ACH';
  if (method === 'card' || method === 'stripe') return method === 'card' ? 'card' : 'Stripe';
  return method;
}

function paymentActivityCopy(payment: Payment) {
  const amount = formatCurrency(Number(payment.amount || 0));
  const method = paymentMethodLabel(payment);

  if (payment.status === 'completed') {
    return {
      title: 'Payment received',
      detail: `${amount} verified by Stripe via ${method}`,
      className: 'border-success/25 bg-success/10 text-success',
      marker: '$',
    };
  }

  if (payment.status === 'processing') {
    return {
      title: method === 'ACH' ? 'ACH processing' : 'Payment processing',
      detail: `${amount} initiated, awaiting Stripe confirmation`,
      className: 'border-warning/25 bg-warning/10 text-warning',
      marker: '~',
    };
  }

  if (isIncompleteStripePayment(payment)) {
    return {
      title: 'Payment incomplete',
      detail: `${amount} never completed in Stripe; no money moved`,
      className: 'border-warning/25 bg-warning/10 text-warning',
      marker: 'i',
    };
  }

  if (isFailedPaymentStatus(payment.status)) {
    const statusDisplay = getPaymentStatusDisplay(payment);

    return {
      title: `Payment ${statusDisplay.label.toLowerCase()}`,
      detail: `${amount} ${statusDisplay.description.toLowerCase()} via ${method}`,
      className: 'border-destructive/25 bg-destructive/10 text-destructive',
      marker: '!',
    };
  }

  return {
    title: 'Payment status updated',
    detail: `${amount} is ${payment.status || 'under review'} via ${method}`,
    className: 'border-primary/25 bg-primary/10 text-primary',
    marker: 'i',
  };
}

function SmallTrend({ tone = 'gold' }: { tone?: 'gold' | 'red' | 'green' }) {
  const stroke = tone === 'red' ? 'hsl(var(--destructive))' : tone === 'green' ? 'hsl(var(--success))' : 'hsl(var(--primary))';

  return (
    <svg viewBox="0 0 86 22" className="h-6 w-24">
      <path d="M2 16 C13 15, 18 8, 26 13 S40 17, 47 9 S60 8, 67 12 S76 16, 84 7" fill="none" stroke={stroke} strokeWidth="1.4" />
    </svg>
  );
}

function KpiTile({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  action,
  onAction,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  tone: 'gold' | 'red' | 'green';
  action?: string;
  onAction?: () => void;
}) {
  const toneClass = tone === 'red' ? 'text-destructive border-destructive/30 bg-destructive/10' : tone === 'green' ? 'text-success border-success/30 bg-success/10' : 'text-primary border-primary/30 bg-primary/10';

  return (
    <div className="ops-panel h-[92px] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="ops-label">{label}</p>
        <span className={`mt-1 h-1.5 w-8 rounded-full ${toneClass}`} />
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div>
          <p className="text-xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
        </div>
        {action && (
          <button type="button" onClick={onAction} className="text-[10px] text-primary hover:text-primary/80">
            {action} <ArrowRight className="inline h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function InfoPanel({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="ops-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="ops-label text-foreground">{title}</p>
        {action && (
          <Button variant="outline" size="sm" onClick={onAction} className="h-7 border-border/70 bg-card px-2 text-[10px]">
            {action}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function DetailRow({ icon: Icon, label, value, tone }: { icon: typeof Mail; label: string; value: string; tone?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2 border-b border-border/35 py-1.5 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`truncate text-right font-medium ${tone || 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function AdminSidebar({
  active,
  managerName,
  managerEmail,
  counts,
  onSignOut,
}: {
  active: AdminDashboardTab;
  managerName: string;
  managerEmail: string;
  counts: Partial<Record<AdminDashboardTab, number>>;
  onSignOut: () => void;
}) {
  const initials = managerName
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SG';
  const navItems = [
    { id: 'overview' as AdminDashboardTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'properties' as AdminDashboardTab, label: 'Properties', icon: Home },
    { id: 'applications' as AdminDashboardTab, label: 'Applications', icon: ClipboardList },
    { id: 'tenants' as AdminDashboardTab, label: 'Tenants', icon: Users },
    { id: 'leases' as AdminDashboardTab, label: 'Leases', icon: FileText },
    { id: 'messages' as AdminDashboardTab, label: 'Messages', icon: MessageSquare },
    { id: 'inquiries' as AdminDashboardTab, label: 'Inquiries', icon: HelpCircle },
    { id: 'analytics' as AdminDashboardTab, label: 'Analytics', icon: BarChart3 },
    { id: 'audit' as AdminDashboardTab, label: 'Payments', icon: Receipt },
    { id: 'maintenance' as AdminDashboardTab, label: 'Maintenance', icon: Wrench },
  ];

  return (
    <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-[190px] flex-shrink-0 flex-col rounded-xl border border-sidebar-border/85 bg-sidebar/95 p-2 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.9)] lg:flex">
      <Link to="/" className="mb-7 flex h-20 w-full items-center justify-center rounded-xl border border-sidebar-border/80 bg-black/20 px-2">
        <img src={logo} alt="Sterling Gate Properties" className="h-16 w-auto scale-150 object-contain" />
      </Link>

      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              window.location.href = `/dashboard?tab=${item.id}`;
            }}
            className={`group flex min-h-[40px] w-full items-center justify-between overflow-hidden rounded-lg border px-3 py-2 text-left text-[13px] transition-all ${
              active === item.id
                ? 'ops-active-nav border-primary/45 text-primary'
                : 'border-transparent text-sidebar-foreground/68 hover:border-sidebar-border/70 hover:bg-sidebar-accent/25 hover:text-sidebar-foreground'
            }`}
          >
            <span className="flex min-w-0 items-center gap-3 truncate">
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{item.label}</span>
            </span>
            {!!counts[item.id] && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 shrink-0 rounded-full border border-primary/25 bg-primary/15 px-1.5 text-[10px] text-primary">
                {counts[item.id]}
              </Badge>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-5 border-t border-sidebar-border/70 pt-4">
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border/80 bg-black/20 p-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/15 text-xs font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">{managerName}</p>
            <p className="truncate text-[10px] text-sidebar-foreground/55">{managerEmail || 'Property Manager'}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSignOut}
            className="h-8 w-8 shrink-0 rounded-lg text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-primary"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default function TenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role, loading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DetailTab>(() => {
    const tabParam = searchParams.get('tab');
    return tabParam && ['overview', 'properties', 'balance', 'history'].includes(tabParam)
      ? tabParam as DetailTab
      : 'overview';
  });

  useEffect(() => {
    if (searchParams.get('tab')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: properties = [] } = useManagerProperties(user?.id);
  const { data: applications = [] } = useApplications();
  const { data: tenants = [] } = useTenants(user?.id);
  const { data: leases = [] } = useLeases(user?.id, role);
  const { data: allPayments = [] } = useAllPayments();
  const { data: unreadCount = 0 } = useUnreadCount(user?.id);
  const { data: managerProfile } = useProfile(user?.id);
  const { unreadPaymentCount } = useUnreadPaymentNotifications();
  const { data: unreadInquiriesCount = 0 } = useUnreadInquiriesCount(user?.id);
  const { data: tenantPayments = [] } = usePayments(undefined, tenantId);
  const { data: rentCharges = [] } = useRentCharges(tenantId);
  const applyLateFee = useApplyLateFee();

  const { data: tenant, isLoading, refetch } = useQuery({
    queryKey: ['tenant-detail', tenantId],
    queryFn: async (): Promise<TenantRecord | null> => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          current_balance,
          user:profiles!tenants_user_id_fkey (
            id,
            email,
            full_name,
            phone
          ),
          property:properties (
            id,
            address,
            city,
            state
          )
        `)
        .eq('id', tenantId)
        .single();

      if (error) throw error;

      const { data: tenantProperties } = await supabase
        .from('tenant_properties')
        .select(`
          id,
          tenant_id,
          is_primary,
          rent_amount,
          lease_start_date,
          lease_end_date,
          property:properties (
            id,
            address,
            city,
            state,
            rent_amount,
            manager_id
          )
        `)
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false });

      const assignedProperties = ([...(tenantProperties || [])] as TenantAssignedProperty[]).sort(
        (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
      );
      const primary = assignedProperties.find((item) => item.is_primary) || assignedProperties[0];
      const assignmentRentTotal = assignedProperties.reduce(
        (sum, item) => sum + Number(item.rent_amount || item.property?.rent_amount || 0),
        0
      );
      const assignedPropertySummary = assignedProperties
        .map((item) => item.property?.address)
        .filter(Boolean)
        .join(' + ') || null;

      return {
        ...data,
        primary_property: primary?.property || data.property || null,
        assigned_properties: assignedProperties,
        assigned_property_summary: assignedPropertySummary,
        primary_rent_amount: primary?.rent_amount || data.rent_amount || null,
        assignment_rent_total: assignmentRentTotal || primary?.rent_amount || null,
        active_assignment_count: assignedProperties.length,
        primary_lease_start: primary?.lease_start_date || data.lease_start_date || null,
        primary_lease_end: primary?.lease_end_date || data.lease_end_date || null,
        additional_properties_count: Math.max(0, assignedProperties.length - 1),
      } as TenantRecord;
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`tenant-detail-${tenantId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tenantId}` }, () => {
        refetch();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'balance_adjustments', filter: `tenant_id=eq.${tenantId}` }, () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['balance-adjustments', tenantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `tenant_id=eq.${tenantId}` }, () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        queryClient.invalidateQueries({ queryKey: ['balance-adjustments', tenantId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, refetch, queryClient]);

  if (loading) {
    return (
      <div className="ops-shell flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading Sterling Gate...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (isLoading) {
    return (
      <div className="ops-shell flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading tenant...</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="ops-shell flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Tenant not found</p>
        <Button variant="outline" onClick={() => navigate('/dashboard?tab=tenants')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tenants
        </Button>
      </div>
    );
  }

  const managerName = managerProfile?.full_name || managerProfile?.email || user.email || 'Alex Morgan';
  const managerEmail = managerProfile?.email || user.email || '';
  const now = new Date();
  const tenantLeases = leases
    .filter((lease) => lease.tenant_id === tenant.user_id)
    .sort((a, b) => new Date(b.created_at || b.start_date).getTime() - new Date(a.created_at || a.start_date).getTime());
  const activeLease = tenantLeases.find(
    (lease) =>
      lease.status === 'completed' &&
      new Date(lease.start_date) <= now &&
      new Date(lease.end_date) >= now
  );
  const displayLease = activeLease || tenantLeases.find((lease) => ['pending_manager_signature', 'pending_tenant_signature'].includes(lease.status));
  const tenantHealth = computeTenantFinancialHealth(tenant, allPayments);
  const assignedProperties = tenant.assigned_properties || [];
  const assignedPropertyAddresses = assignedProperties
    .map((assignment) => assignment.property?.address)
    .filter(Boolean) as string[];
  const tenantLedgerPayments = tenantPayments
    .filter(isBalancePayment)
    .sort(sortPaymentsNewestFirst);
  const completedPayments = tenantLedgerPayments
    .filter((payment) => payment.status === 'completed')
    .sort(sortPaymentsNewestFirst);
  const paymentActivity = tenantLedgerPayments
    .filter((payment) => ['completed', 'processing', 'failed', 'canceled', 'requires_payment_method'].includes(payment.status || ''))
    .slice(0, 5);
  const lastPayment = completedPayments[0] as Payment | undefined;
  const paymentHistoryLabel = completedPayments.length > 0
    ? `${completedPayments.length} completed payment${completedPayments.length === 1 ? '' : 's'}`
    : 'No completed payments';
  const assignmentCount = assignedProperties.length || Number(tenant.active_assignment_count || 0);
  const assignmentRentTotal = Number(tenant.assignment_rent_total || 0);
  const monthlyRent = Number(assignmentRentTotal || tenant.primary_rent_amount || activeLease?.monthly_rent || tenant.rent_amount || 0);
  const ledgerBalance = Number(tenant.current_balance || 0);
  const effectiveBalance = tenantHealth.needsSetupReview ? 0 : tenantHealth.effectiveBalance;
  const displayBalance = Math.abs(effectiveBalance) < 0.01 ? 0 : effectiveBalance;
  const hasBalanceDue = displayBalance > 0;
  const hasCredit = displayBalance < 0;
  const needsSetupReview = tenantHealth.needsSetupReview || (!assignmentCount && Boolean(displayLease && displayLease.status !== 'completed'));
  const balanceDetail = tenantHealth.pendingACH > 0
    ? `${formatCurrency(ledgerBalance)} official minus pending ACH`
    : needsSetupReview && ledgerBalance > 0
      ? `${formatCurrency(ledgerBalance)} held for setup review`
      : hasBalanceDue
        ? `${formatCurrency(ledgerBalance)} official ledger`
        : hasCredit
          ? 'Credit on account'
          : 'No collectible balance';
  const leaseMonths = monthsBetween(tenant.primary_lease_start || displayLease?.start_date, tenant.primary_lease_end || displayLease?.end_date);
  const lateFeeCandidate = rentCharges.find((charge) => charge.status === 'pending' && !charge.late_fee_applied && !charge.late_fee_waived);
  const primaryPropertyLabel = assignedPropertyAddresses[0] || tenant.primary_property?.address || activeLease?.properties?.address || 'No active assignment';
  const propertySummaryLabel = assignedPropertyAddresses.length > 0
    ? assignedPropertyAddresses.join(' + ')
    : primaryPropertyLabel;
  const assignedSinceDate = assignedProperties
    .map((assignment) => assignment.lease_start_date)
    .filter(Boolean)
    .sort()[0] || tenant.primary_lease_start || tenant.created_at;
  const tenantStatusLabel = needsSetupReview ? 'Setup Review' : assignmentCount || activeLease ? 'Active' : 'Unassigned';
  const leaseStartDate = tenant.primary_lease_start || displayLease?.start_date || null;
  const leaseEndDate = tenant.primary_lease_end || displayLease?.end_date || null;
  const leaseDetail = leaseEndDate ? `Ends ${formatDate(leaseEndDate)}` : displayLease ? 'Lease setup in progress' : 'No lease selected';
  const nextRentChargeLabel = monthlyRent > 0 ? `${formatCurrency(monthlyRent)} on the 1st` : 'No active billing source';
  const paymentDayLabel = monthlyRent > 0 ? '1st of each month' : '--';
  const lateFeeLabel = monthlyRent > 0 ? '5% after 5 days' : 'Inactive until billing source exists';
  const navCounts = {
    applications: applications.filter((application) => ['pending', 'under_review'].includes(application.status)).length,
    leases: leases.filter((lease) => lease.status !== 'completed').length,
    messages: unreadCount,
    inquiries: unreadInquiriesCount,
    audit: unreadPaymentCount,
  };

  const handleOpenLease = () => {
    if (displayLease?.id) {
      navigate(`/sign-lease/${displayLease.id}`);
      return;
    }
    setActiveTab('properties');
  };

  const handleApplyLateFee = async () => {
    if (!lateFeeCandidate) return;
    await applyLateFee.mutateAsync({
      rent_charge_id: lateFeeCandidate.id,
      tenant_id: tenant.id,
      created_by: user.id,
    });
    refetch();
  };

  return (
    <div className="min-h-screen ops-shell p-0 md:p-3">
      <div className="flex min-h-screen w-full gap-3 md:min-h-[calc(100vh-1.5rem)] md:rounded-2xl md:border md:border-border/70 md:bg-background/25 md:p-2 md:shadow-[0_30px_100px_-60px_rgba(0,0,0,0.95)]">
        <AdminSidebar
          active="tenants"
          managerName={managerName}
          managerEmail={managerEmail}
          counts={navCounts}
          onSignOut={signOut}
        />

        <main className="min-w-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-10 border-b border-border/35 bg-background px-3 py-3 md:px-5">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard?tab=tenants')}
                className="h-9 gap-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Tenants
              </Button>

              <div className="hidden flex-1 justify-center md:flex">
                <AdminGlobalSearch
                  properties={properties || []}
                  tenants={tenants || []}
                  applications={applications || []}
                  leases={leases || []}
                  payments={allPayments}
                  onNavigateTab={(tab) => navigate(`/dashboard?tab=${tab}`)}
                  onOpenTenant={(id) => navigate(`/dashboard/tenant/${id}`)}
                />
              </div>

              <div className="flex items-center gap-2">
                <OverdueRentAlert managerId={user.id} />
                <NotificationBell />
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-10 w-10 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary md:inline-flex"
                  aria-label="Help"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
                <SettingsDialog />
              </div>
            </div>
          </div>

          <div className="p-3 pt-1 md:-mt-2 md:p-5">
            <section className="ops-panel p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 text-primary">
                    <UserRound className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="truncate text-2xl font-semibold tracking-tight">{tenantName(tenant)}</h1>
                      <Badge
                        variant="outline"
                        className={
                          needsSetupReview
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : assignmentCount || activeLease
                              ? 'border-success/30 bg-success/10 text-success'
                              : 'border-muted-foreground/25 bg-muted/20 text-muted-foreground'
                        }
                      >
                        {tenantStatusLabel}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-cyan-300" />{tenant.user?.email || 'No email'}</span>
                      <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-cyan-300" />{tenant.user?.phone || 'No phone'}</span>
                      <span className="flex max-w-[520px] items-center gap-1.5"><Home className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{propertySummaryLabel}</span></span>
                      <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{assignmentCount ? `Resident since ${formatDate(assignedSinceDate)}` : 'Assignment required before billing'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:min-w-[360px] md:grid-cols-2">
                  <KpiTile label="Current Balance" value={formatCurrency(displayBalance)} detail={balanceDetail} icon={Wallet} tone={hasBalanceDue ? 'red' : 'green'} />
                  <KpiTile label="Monthly Rent" value={formatCurrency(monthlyRent)} detail={assignmentCount > 1 ? `${assignmentCount} assigned units` : assignmentCount === 1 ? '1 assigned unit' : 'No active billing source'} icon={Home} tone="gold" />
                  <KpiTile label="Last Payment" value={lastPayment ? formatCurrency(Number(lastPayment.amount)) : '--'} detail={lastPayment ? formatDate(lastPayment.payment_date) : 'No payment recorded'} icon={CheckCircle2} tone="green" />
                  <KpiTile label="Lease / Setup" value={leaseMonths ? `${leaseMonths} mo` : tenantStatusLabel} detail={leaseDetail} icon={CalendarDays} tone="gold" action={displayLease ? 'Open Lease' : 'Manage'} onAction={handleOpenLease} />
                </div>
              </div>
            </section>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)} className="mt-3">
              <TabsList className="grid h-9 w-full grid-cols-4 rounded-lg border border-border/70 bg-card p-1">
                <TabsTrigger value="overview" className="h-7 text-[11px] data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="properties" className="h-7 text-[11px] data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  Lease & Property
                </TabsTrigger>
                <TabsTrigger value="balance" className="h-7 text-[11px] data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  Billing & Ledger
                </TabsTrigger>
                <TabsTrigger value="history" className="h-7 text-[11px] data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                  Communication / Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-3 animate-fade-in">
                <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1.15fr]">
                  <InfoPanel title="Profile & Contact">
                    <DetailRow icon={UserRound} label="Full Name" value={tenantName(tenant)} />
                    <DetailRow icon={Mail} label="Email" value={tenant.user?.email || 'No email'} />
                    <DetailRow icon={Phone} label="Phone" value={tenant.user?.phone || 'No phone'} />
                    <DetailRow icon={Users} label="Emergency Contact" value="Not on file" />
                    <DetailRow icon={MessageSquare} label="Preferred Contact" value="Email" />
                    <DetailRow icon={ShieldCheck} label="ID / Notes" value="Not on file" />
                  </InfoPanel>

                  <InfoPanel title="Lease & Property" action={displayLease ? 'Open Lease' : 'Manage'} onAction={handleOpenLease}>
                    {assignedProperties.length > 1 ? (
                      assignedProperties.map((assignment, index) => (
                        <DetailRow
                          key={assignment.id}
                          icon={Home}
                          label={index === 0 ? 'Primary Property' : `Property ${index + 1}`}
                          value={assignment.property?.address || 'No address'}
                        />
                      ))
                    ) : (
                      <DetailRow icon={Home} label="Property" value={propertySummaryLabel} />
                    )}
                    <DetailRow icon={Building2} label="Units Assigned" value={assignmentCount ? `${assignmentCount}` : 'None'} />
                    <DetailRow icon={CalendarDays} label="Lease Start" value={formatDate(leaseStartDate)} />
                    <DetailRow icon={CalendarDays} label="Lease End" value={formatDate(leaseEndDate)} />
                    <DetailRow icon={Users} label="Billing Source" value={assignmentCount ? 'Tenant-property assignment' : displayLease?.status === 'completed' ? 'Completed lease' : 'Setup review'} />
                    <DetailRow icon={Receipt} label="Payment Day" value={paymentDayLabel} />
                    <DetailRow icon={Wallet} label="Rent Amount" value={formatCurrency(monthlyRent)} />
                    <DetailRow icon={ShieldCheck} label="Security Deposit" value="Not tracked" />
                  </InfoPanel>

                  <InfoPanel title="Financial Summary" action="Open Ledger" onAction={() => setActiveTab('balance')}>
                    <DetailRow icon={Wallet} label="Current Balance" value={formatCurrency(displayBalance)} tone={hasBalanceDue ? 'text-destructive' : 'text-success'} />
                    <DetailRow icon={Receipt} label="Next Rent Charge" value={nextRentChargeLabel} />
                    <DetailRow icon={BanknoteIcon} label="Pending ACH" value={tenantHealth.pendingACH ? `${formatCurrency(tenantHealth.pendingACH)} pending` : '--'} tone="text-primary" />
                    <DetailRow icon={ShieldCheck} label="Available Credit" value={hasCredit ? formatCurrency(Math.abs(displayBalance)) : '$0'} />
                    <DetailRow icon={CheckCircle2} label="Autopay" value="Not configured" />
                    <DetailRow icon={ShieldCheck} label="Credit Health" value={needsSetupReview ? 'Setup review' : hasBalanceDue ? 'Balance due' : 'Healthy'} tone={needsSetupReview || hasBalanceDue ? 'text-warning' : 'text-success'} />
                    <DetailRow icon={Receipt} label="Payment History" value={paymentHistoryLabel} tone={completedPayments.length > 0 ? 'text-success' : undefined} />
                  </InfoPanel>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr_0.9fr]">
                  <InfoPanel title="Recent Activity" action="Open Ledger" onAction={() => setActiveTab('balance')}>
                    <div className="space-y-3">
                      {paymentActivity.map((payment) => {
                        const activity = paymentActivityCopy(payment);

                        return (
                          <div key={payment.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 text-xs">
                            <span className={`grid h-7 w-7 place-items-center rounded-full border ${activity.className}`}>{activity.marker}</span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{activity.title}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">{activity.detail}</span>
                            </span>
                            <span className="text-right text-[10px] text-muted-foreground">{formatDate(payment.payment_date)}</span>
                          </div>
                        );
                      })}
                      {paymentActivity.length === 0 && (
                        <div className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                          No payment activity recorded for this tenant yet.
                        </div>
                      )}
                    </div>
                  </InfoPanel>

                  <InfoPanel title="Automation / Billing Settings" action="Manage" onAction={() => setActiveTab('properties')}>
                    <DetailRow icon={CheckCircle2} label="Autopay" value="Not configured" />
                    <DetailRow icon={Receipt} label="Payment Method" value="Not on file" />
                    <DetailRow icon={Wallet} label="Rent Charge" value={nextRentChargeLabel} />
                    <DetailRow icon={Bell} label="Late Fee" value={lateFeeLabel} />
                    <DetailRow icon={MessageSquare} label="Reminders" value="Standard due-date reminders" />
                    <DetailRow icon={CalendarDays} label="Grace Period" value="5 days" />
                  </InfoPanel>

                  <InfoPanel title="Quick Actions">
                    <div className="grid gap-2">
                      <Button variant="outline" onClick={() => setActiveTab('balance')} className="h-8 justify-between border-border/70 bg-card/45 px-3 text-[11px] text-muted-foreground hover:text-primary">
                        Open ledger
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab('properties')} className="h-8 justify-between border-border/70 bg-card/45 px-3 text-[11px] text-muted-foreground hover:text-primary">
                        Manage units
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/dashboard?tab=messages')} className="h-8 justify-between border-border/70 bg-card/45 px-3 text-[11px] text-muted-foreground hover:text-primary">
                        Open messages
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleApplyLateFee}
                        disabled={!lateFeeCandidate || applyLateFee.isPending}
                        className="h-8 justify-between border-border/70 bg-card/45 px-3 text-[11px] text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {lateFeeCandidate ? 'Apply late fee' : 'Late fee current'}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </InfoPanel>
                </div>
              </TabsContent>

              <TabsContent value="properties" className="mt-3 animate-fade-in">
                <div className="ops-panel p-4">
                  <TenantPropertiesTab tenant={tenant} managerId={user.id} onUpdate={refetch} />
                </div>
              </TabsContent>

              <TabsContent value="balance" className="mt-3 animate-fade-in">
                <div className="ops-panel p-4">
                  <TenantBalanceTab tenant={tenant} onUpdate={refetch} />
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-3 animate-fade-in">
                <div className="ops-panel p-4">
                  <TenantHistoryTab tenantId={tenant.id} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

function BanknoteIcon(props: React.ComponentProps<typeof Wallet>) {
  return <Wallet {...props} />;
}
