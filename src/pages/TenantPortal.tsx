import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useMyApplications } from '@/hooks/useApplications';
import { useLeases } from '@/hooks/useLeases';
import { useUnreadCount } from '@/hooks/useMessages';
import { RentPaymentDialog } from '@/components/payments/RentPaymentDialog';
import { useProfile } from '@/hooks/useProfiles';
import { usePayments } from '@/hooks/usePayments';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { TenantMessagingCenter } from '@/components/messages/TenantMessagingCenter';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { format, startOfMonth, subDays, subMonths, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Building2, 
  Home, 
  FileText, 
  MessageSquare, 
  ClipboardList,
  LogOut,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ArrowRight,
  Folder,
  PenTool,
  Download,
  CreditCard,
  Loader2,
  Wallet,
  Receipt,
  Menu,
  User,
  LayoutDashboard,
  AlertCircle,
  CalendarDays,
  Bell,
  CalendarIcon
} from 'lucide-react';
import logo from '@/assets/logo.png';

type PortalTab = 'dashboard' | 'applications' | 'leases' | 'payments' | 'documents' | 'messages';

export default function TenantPortal() {
  const { user, role, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Payment filter state
  type DateFilter = 'all' | 'this-month' | 'last-30' | 'last-3-months' | 'this-year' | 'custom';
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: myApplications, isLoading: applicationsLoading } = useMyApplications(user?.id);
  const { data: leases, isLoading: leasesLoading } = useLeases(user?.id, role);
  const { data: unreadCount } = useUnreadCount(user?.id);
  const { data: tenantProfile } = useProfile(user?.id);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [rentPaymentDialog, setRentPaymentDialog] = useState<{
    open: boolean;
    leaseId: string;
    amount: number;
    type: 'rent' | 'security_deposit';
  } | null>(null);

  // Fetch tenant's actual balance from tenants table
  const { data: tenantRecord, refetch: refetchTenant } = useQuery({
    queryKey: ['tenant-balance', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('id, current_balance, rent_amount, lease_start_date, property_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if tenant has a property assigned
  const hasPropertyAssigned = tenantRecord?.property_id !== null && tenantRecord?.property_id !== undefined;


  // Fetch tenant's payment history using tenant record ID (not user ID)
  const { data: payments, isLoading: paymentsLoading } = usePayments(undefined, tenantRecord?.id);

  // Filter payments by date range (must be declared before any early returns)
  const filteredPayments = useMemo(() => {
    if (!payments) return [];

    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (dateFilter) {
      case 'this-month':
        startDate = startOfMonth(now);
        endDate = now;
        break;
      case 'last-30':
        startDate = subDays(now, 30);
        endDate = now;
        break;
      case 'last-3-months':
        startDate = subMonths(now, 3);
        endDate = now;
        break;
      case 'this-year':
        startDate = startOfYear(now);
        endDate = now;
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        // 'all' - no filtering
        return payments;
    }

    return payments.filter((payment) => {
      const paymentDate = new Date(payment.payment_date);
      if (startDate && paymentDate < startDate) return false;
      if (endDate && paymentDate > endDate) return false;
      return true;
    });
  }, [payments, dateFilter, customStartDate, customEndDate]);

  // Realtime subscription for tenant's balance
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('tenant-balance-portal')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refetchTenant();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchTenant]);

  // Realtime subscription for tenant's leases
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('tenant-leases-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leases',
          filter: `tenant_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leases'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Realtime subscription for tenant's payments
  useEffect(() => {
    if (!tenantRecord?.id) return;

    const channel = supabase
      .channel('tenant-payments-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payments',
          filter: `tenant_id=eq.${tenantRecord.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payments'] });
          refetchTenant(); // Also refresh balance
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantRecord?.id, queryClient, refetchTenant]);

  // Realtime subscription for tenant's property assignments
  useEffect(() => {
    if (!tenantRecord?.id) return;

    const channel = supabase
      .channel('tenant-properties-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_properties',
          filter: `tenant_id=eq.${tenantRecord.id}`,
        },
        () => {
          // Refetch tenant record (includes property_id) and leases
          refetchTenant();
          queryClient.invalidateQueries({ queryKey: ['leases'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantRecord?.id, queryClient, refetchTenant]);

  // Handle tab navigation from URL query params (for notification clicks)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['dashboard', 'applications', 'leases', 'payments', 'documents', 'messages'].includes(tabParam)) {
      setActiveTab(tabParam as PortalTab);
      // Clear the query param after setting the tab
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Wait for both auth and role to be fully loaded before redirecting
  if (loading || (user && role === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role !== 'tenant') {
    return <Navigate to="/dashboard" replace />;
  }

  const handlePayDeposit = (leaseId: string, amount: number) => {
    setRentPaymentDialog({ open: true, leaseId, amount, type: 'security_deposit' });
  };

  const handlePayRent = (leaseId: string, amount: number) => {
    setRentPaymentDialog({ open: true, leaseId, amount, type: 'rent' });
  };


  // (moved) filteredPayments useMemo is declared above to avoid hook order issues

  const pendingLeases = leases?.filter((l: any) => l.status === 'pending_tenant_signature') || [];
  const activeLeases = leases?.filter((l: any) => l.status === 'completed') || [];
  const nextRent = activeLeases.length > 0 ? Number(activeLeases[0].monthly_rent) : 0;
  
  // Calculate next rent due date (1st of next month)
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextRentDueDate = nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Use actual balance from tenant record
  const currentBalance = tenantRecord?.current_balance ?? 0;
  const isOverdue = currentBalance > 0;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'applications', label: 'My Applications', icon: ClipboardList },
    { id: 'leases', label: 'My Leases', icon: FileText },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'documents', label: 'Documents', icon: Folder },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadCount },
  ];

  // Sidebar content component
  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      <Link to="/" className="flex items-center mb-4 w-full">
        <img src={logo} alt="Sterling Gate Properties" className="h-16 md:h-24 w-auto object-contain" />
      </Link>

      {/* Tenant Portal Label + Profile */}
      <div className="mb-6 px-2">
        <Badge variant="secondary" className="mb-3 bg-primary/10 text-primary border-primary/20">
          Tenant Portal
        </Badge>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/30">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sidebar-foreground truncate text-sm">
              {tenantProfile?.full_name || 'Tenant'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {tenantProfile?.email || user?.email}
            </p>
          </div>
        </div>
      </div>
      
      <Separator className="mb-4 bg-sidebar-border" />
      
      <nav className="space-y-1 flex-1 overflow-hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id as PortalTab);
              onNavClick?.();
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-smooth text-left min-h-[48px] active:bg-sidebar-accent/70 overflow-hidden ${
              activeTab === item.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            }`}
          >
            <span className="flex items-center gap-3 min-w-0 truncate">
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
            {item.badge && item.badge > 0 && (
              <Badge variant="secondary" className="bg-sidebar-primary text-sidebar-primary-foreground text-xs shrink-0 ml-2">
                {item.badge}
              </Badge>
            )}
          </button>
        ))}
      </nav>

      <Separator className="my-4 bg-sidebar-border" />
      
      <Link to="/" className="block mb-2">
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 min-h-[48px]">
          <Home className="mr-3 h-5 w-5" /> Back to Home
        </Button>
      </Link>
      
      <Button 
        variant="ghost" 
        onClick={() => signOut()} 
        className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 min-h-[48px]"
      >
        <LogOut className="mr-3 h-5 w-5" /> Sign Out
      </Button>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex w-full">
        {/* Mobile Sidebar Sheet */}
        {isMobile && (
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetContent side="left" className="w-72 p-4 bg-sidebar flex flex-col">
              <SidebarContent onNavClick={() => setIsMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        )}

        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside className="w-64 bg-sidebar min-h-screen p-2 flex flex-col flex-shrink-0">
            <SidebarContent />
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto min-w-0">
          {/* Top Header Bar */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 md:px-8 py-3 md:py-4">
            <div className="flex items-center justify-between gap-3">
              {/* Mobile hamburger */}
              {isMobile && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base md:text-lg font-serif text-foreground truncate">
                  {navItems.find(item => item.id === activeTab)?.label || 'Portal'}
                </h2>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <NotificationBell />
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8 overflow-hidden">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="animate-fade-in space-y-6">
                {/* No Property Assigned State */}
                {!hasPropertyAssigned ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                      <Building2 className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-serif mb-3">No Property Assigned</h2>
                    <p className="text-muted-foreground max-w-md mb-6">
                      You haven't been assigned to a property yet. Once your property manager assigns you to a property, your dashboard will be available here.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link to="/properties">
                        <Button variant="outline" className="gap-2">
                          <Home className="h-4 w-4" />
                          Browse Properties
                        </Button>
                      </Link>
                      <Button variant="ghost" onClick={() => setActiveTab('applications')} className="gap-2">
                        <FileText className="h-4 w-4" />
                        View Applications
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Welcome Header */}
                    <div className="mb-2">
                      <h1 className="text-2xl md:text-3xl font-serif">
                        Welcome back, {tenantProfile?.full_name?.split(' ')[0] || 'Tenant'}
                      </h1>
                      <p className="text-muted-foreground">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>


                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                      <Card className={`p-4 md:p-5 hover:shadow-md transition-shadow ${isOverdue ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                        <div className="flex items-start justify-between mb-auto">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs md:text-sm text-muted-foreground">Current Balance</p>
                            <p className={`text-xl md:text-2xl font-serif mt-1 truncate ${isOverdue ? 'text-destructive' : ''}`}>
                              ${Math.abs(currentBalance).toLocaleString()}
                            </p>
                            {currentBalance < 0 && (
                              <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary">
                                Credit
                              </Badge>
                            )}
                            {currentBalance > 0 && !isOverdue && (
                              <p className="text-xs text-muted-foreground mt-1">Due this cycle</p>
                            )}
                            {isOverdue && (
                              <p className="text-xs text-destructive mt-1">Overdue</p>
                            )}
                          </div>
                          <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                            <DollarSign className={`h-5 w-5 md:h-6 md:w-6 ${isOverdue ? 'text-destructive' : 'text-primary'}`} />
                          </div>
                        </div>
                        {currentBalance > 0 && tenantRecord?.id && (
                          <Button
                            variant={isOverdue ? "destructive" : "default"}
                            size="sm"
                            className="w-full mt-3 card-action-btn"
                            onClick={() => setShowPaymentDialog(true)}
                          >
                            Make Payment
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </Card>

                      <Card className="p-4 md:p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs md:text-sm text-muted-foreground">Monthly Rent</p>
                            <p className="text-xl md:text-2xl font-serif mt-1 truncate">
                              ${Number(tenantRecord?.rent_amount || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Due 1st of month</p>
                          </div>
                          <div className="w-10 h-10 md:w-11 md:h-11 bg-accent/50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="h-5 w-5 md:h-6 md:w-6 text-foreground/70" />
                          </div>
                        </div>
                      </Card>

                      <Card 
                        className="p-4 md:p-5 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setActiveTab('leases')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs md:text-sm text-muted-foreground">Pending Actions</p>
                            <p className="text-xl md:text-2xl font-serif mt-1">
                              {pendingLeases.length}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {pendingLeases.length === 1 ? 'lease to sign' : 'leases to sign'}
                            </p>
                          </div>
                          <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            pendingLeases.length > 0 ? 'bg-warning/10' : 'bg-success/10'
                          }`}>
                            {pendingLeases.length > 0 ? (
                              <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-warning" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-success" />
                            )}
                          </div>
                        </div>
                      </Card>

                      <Card 
                        className="p-4 md:p-5 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setActiveTab('messages')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs md:text-sm text-muted-foreground">Messages</p>
                            <p className="text-xl md:text-2xl font-serif mt-1">
                              {unreadCount || 0}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">unread</p>
                          </div>
                          <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            (unreadCount || 0) > 0 ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            <MessageSquare className={`h-5 w-5 md:h-6 md:w-6 ${
                              (unreadCount || 0) > 0 ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                          </div>
                        </div>
                      </Card>
                    </div>

                {/* Action Required Section */}
                {pendingLeases.length > 0 && (
                  <Card className="border-warning/30 bg-warning/5">
                    <div className="p-4 md:p-5 border-b border-warning/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-warning" />
                        <h3 className="font-serif text-lg">Action Required</h3>
                      </div>
                    </div>
                    <div className="divide-y divide-warning/10">
                      {pendingLeases.map((lease: any) => (
                        <div key={lease.id} className="p-4 md:p-5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-warning/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="h-5 w-5 md:h-6 md:w-6 text-warning" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{lease.properties?.address || 'Property'}</p>
                              <p className="text-sm text-muted-foreground">
                                ${Number(lease.monthly_rent).toLocaleString()}/mo · Pending your signature
                              </p>
                            </div>
                          </div>
                          <Link to={`/sign-lease/${lease.id}`}>
                            <Button size="sm" className="gap-1.5 whitespace-nowrap">
                              Sign Now <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* All Caught Up */}
                {pendingLeases.length === 0 && (
                  <Card className="border-success/30 bg-success/5 p-6 text-center">
                    <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" />
                    <h3 className="font-serif text-lg mb-1">You're all caught up!</h3>
                    <p className="text-muted-foreground text-sm">No pending actions at this time</p>
                  </Card>
                )}

                {/* Upcoming Payment Preview */}
                {activeLeases.length > 0 && (
                  <Card>
                    <div className="p-4 md:p-5 border-b border-border">
                      <h3 className="font-serif text-lg">Upcoming Payment</h3>
                    </div>
                    <div className="p-4 md:p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CreditCard className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{activeLeases[0].properties?.address || 'Property'}</p>
                            <p className="text-sm text-muted-foreground">
                              Due {nextRentDueDate}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl md:text-2xl font-serif">${nextRent.toLocaleString()}</p>
                          <Button 
                            size="sm" 
                            className="mt-2"
                            onClick={() => handlePayRent(activeLeases[0].id, nextRent)}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pay Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Quick Links */}
                <div>
                  <h3 className="font-serif text-lg mb-3">Quick Links</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button 
                      onClick={() => setActiveTab('leases')}
                      className="p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
                    >
                      <FileText className="h-6 w-6 text-muted-foreground group-hover:text-foreground mb-2" />
                      <p className="font-medium text-sm">View Leases</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('payments')}
                      className="p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
                    >
                      <Receipt className="h-6 w-6 text-muted-foreground group-hover:text-foreground mb-2" />
                      <p className="font-medium text-sm">Payment History</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('documents')}
                      className="p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
                    >
                      <Folder className="h-6 w-6 text-muted-foreground group-hover:text-foreground mb-2" />
                      <p className="font-medium text-sm">My Documents</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('messages')}
                      className="p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
                    >
                      <MessageSquare className="h-6 w-6 text-muted-foreground group-hover:text-foreground mb-2" />
                      <p className="font-medium text-sm">Send Message</p>
                    </button>
                  </div>
                </div>
                  </>
                )}
              </div>
            )}

            {/* My Applications Tab */}
            {activeTab === 'applications' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <h1 className="text-3xl font-serif">My Applications</h1>
                  <p className="text-muted-foreground">Track the status of your rental applications</p>
                </div>

                {applicationsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <Card key={i} className="p-4 animate-pulse">
                        <div className="h-24 bg-muted rounded" />
                      </Card>
                    ))}
                  </div>
                ) : myApplications && myApplications.length > 0 ? (
                  <div className="space-y-4">
                    {myApplications.map((app: any) => (
                      <Card key={app.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-4">
                            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <div>
                              <h3 className="font-serif text-xl mb-1">{app.properties?.address}</h3>
                              <p className="text-muted-foreground text-sm mb-2">
                                {app.properties?.city}, {app.properties?.state}
                              </p>
                              <p className="text-lg font-medium">
                                ${Number(app.properties?.rent_amount).toLocaleString()}/mo
                              </p>
                              <p className="text-sm text-muted-foreground mt-2">
                                Applied: {new Date(app.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant="outline"
                              className={`text-base px-4 py-1 ${
                                app.status === 'approved' ? 'border-success text-success bg-success/10' :
                                app.status === 'rejected' ? 'border-destructive text-destructive bg-destructive/10' :
                                'border-warning text-warning bg-warning/10'
                              }`}
                            >
                              {app.status === 'approved' && <CheckCircle2 className="h-4 w-4 mr-2" />}
                              {app.status === 'rejected' && <XCircle className="h-4 w-4 mr-2" />}
                              {(app.status === 'pending' || app.status === 'under_review') && <Clock className="h-4 w-4 mr-2" />}
                              {app.status.replace(/_/g, ' ')}
                            </Badge>
                            {app.status === 'rejected' && app.rejection_reason && (
                              <p className="text-sm text-destructive mt-2 max-w-xs">
                                {app.rejection_reason}
                              </p>
                            )}
                              {app.status === 'approved' && (
                                <div className="mt-4">
                                  {leases?.some(lease => 
                                    lease.property_id === app.property_id && 
                                    lease.tenant_id === user?.id
                                  ) ? (
                                    <Button size="sm" onClick={() => setActiveTab('leases')}>
                                      View Lease <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      Awaiting lease preparation
                                    </p>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center border-dashed">
                    <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-xl font-serif mb-2">No Applications Yet</h3>
                    <p className="text-muted-foreground mb-6">Browse available properties and submit your first application</p>
                    <Link to="/properties">
                      <Button>
                        <Search className="mr-2 h-4 w-4" /> Browse Properties
                      </Button>
                    </Link>
                  </Card>
                )}
              </div>
            )}

            {/* My Leases Tab */}
            {activeTab === 'leases' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <h1 className="text-3xl font-serif">My Leases</h1>
                  <p className="text-muted-foreground">View and sign your lease agreements</p>
                </div>

                {leasesLoading ? (
                  <div className="space-y-4">
                    {[1].map((i) => (
                      <Card key={i} className="p-4 animate-pulse">
                        <div className="h-32 bg-muted rounded" />
                      </Card>
                    ))}
                  </div>
                ) : leases && leases.filter((l: any) => l.status !== 'pending_manager_signature').length > 0 ? (
                  <div className="space-y-6">
                    {leases.filter((lease: any) => lease.status !== 'pending_manager_signature').map((lease: any) => (
                      <Card key={lease.id} className="overflow-hidden">
                        {/* Header with Property & Status */}
                        <div className="p-6 pb-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-serif text-2xl font-medium text-foreground truncate">
                                {lease.properties?.address}
                              </h3>
                              <p className="text-muted-foreground mt-1">
                                {lease.properties?.city}, {lease.properties?.state} {lease.properties?.zip_code}
                              </p>
                            </div>
                            <Badge 
                              className={`shrink-0 text-sm px-4 py-2 font-medium ${
                                lease.status === 'completed' 
                                  ? 'bg-success/15 text-success border-success/30' 
                                  : lease.status === 'pending_tenant_signature' 
                                  ? 'bg-warning/15 text-warning border-warning/30' 
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {lease.status === 'completed' && <CheckCircle2 className="h-4 w-4 mr-2" />}
                              {lease.status === 'pending_tenant_signature' && <Clock className="h-4 w-4 mr-2" />}
                              {lease.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </Badge>
                          </div>
                        </div>

                        {/* Lease Details */}
                        <div className="px-6 py-4 bg-muted/30 border-y border-border/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <CalendarDays className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Lease Period</p>
                                <p className="text-lg font-medium text-foreground mt-0.5">
                                  {format(new Date(lease.start_date), 'MMM d, yyyy')} → {format(new Date(lease.end_date), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <DollarSign className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Monthly Rent</p>
                                <p className="text-lg font-medium text-foreground mt-0.5">
                                  ${Number(lease.monthly_rent).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 pt-4">
                          <div className="flex flex-wrap gap-3">
                            {lease.status === 'pending_tenant_signature' && (
                              <Link to={`/sign-lease/${lease.id}`} className="flex-1 sm:flex-none">
                                <Button className="w-full sm:w-auto" size="lg">
                                  <PenTool className="h-5 w-5 mr-2" /> Sign Lease
                                </Button>
                              </Link>
                            )}
                            {lease.status === 'completed' && (
                              <>
                                {lease.security_deposit && (
                                  <Button 
                                    variant="outline"
                                    size="lg"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => handlePayDeposit(lease.id, Number(lease.security_deposit))}
                                  >
                                    <CreditCard className="h-5 w-5 mr-2" />
                                    Pay Deposit · ${Number(lease.security_deposit).toLocaleString()}
                                  </Button>
                                )}
                                <Button 
                                  size="lg"
                                  className="flex-1 sm:flex-none"
                                  onClick={() => handlePayRent(lease.id, Number(lease.monthly_rent))}
                                >
                                  <CreditCard className="h-5 w-5 mr-2" />
                                  Pay Rent · ${Number(lease.monthly_rent).toLocaleString()}
                                </Button>
                                <Link to={`/sign-lease/${lease.id}`} className="flex-1 sm:flex-none">
                                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                                    <FileText className="h-5 w-5 mr-2" /> View Lease
                                  </Button>
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center border-dashed">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-xl font-serif mb-2">No Leases</h3>
                    <p className="text-muted-foreground">Your lease agreements will appear here once your application is approved</p>
                  </Card>
                )}
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <h1 className="text-3xl font-serif">Payments</h1>
                  <p className="text-muted-foreground">View your payment history</p>
                </div>

                {/* Date Filters */}
                <Card className="p-4 mb-6">
                  <div className="flex flex-col gap-4">
                    {/* Quick Filters */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'all', label: 'All Time' },
                        { key: 'this-month', label: 'This Month' },
                        { key: 'last-30', label: 'Last 30 Days' },
                        { key: 'last-3-months', label: 'Last 3 Months' },
                        { key: 'this-year', label: 'This Year' },
                      ].map(filter => (
                        <Button
                          key={filter.key}
                          variant={dateFilter === filter.key ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setDateFilter(filter.key as DateFilter);
                            if (filter.key !== 'custom') {
                              setCustomStartDate(undefined);
                              setCustomEndDate(undefined);
                            }
                          }}
                        >
                          {filter.label}
                        </Button>
                      ))}
                    </div>

                    {/* Custom Date Range */}
                    <div className="flex flex-wrap items-center gap-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "justify-start text-left font-normal",
                              !customStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customStartDate ? format(customStartDate, "MMM d, yyyy") : "From"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customStartDate}
                            onSelect={(date) => {
                              setCustomStartDate(date);
                              setDateFilter('custom');
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>

                      <span className="text-muted-foreground">to</span>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "justify-start text-left font-normal",
                              !customEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customEndDate ? format(customEndDate, "MMM d, yyyy") : "To"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customEndDate}
                            onSelect={(date) => {
                              setCustomEndDate(date);
                              setDateFilter('custom');
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>

                      {(customStartDate || customEndDate) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCustomStartDate(undefined);
                            setCustomEndDate(undefined);
                            setDateFilter('all');
                          }}
                        >
                          Clear
                        </Button>
                      )}

                      <span className="ml-auto text-sm text-muted-foreground">
                        {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Payment History */}
                <Card>
                  <div className="p-4 border-b border-border">
                    <h3 className="font-serif text-lg">Payment History</h3>
                  </div>
                  {paymentsLoading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                      ))}
                    </div>
                  ) : filteredPayments.length > 0 ? (
                    <div className="divide-y divide-border">
                      {filteredPayments.map((payment) => (
                        <div key={payment.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              payment.status === 'completed' ? 'bg-success/10' : 
                              payment.status === 'pending' ? 'bg-warning/10' : 'bg-destructive/10'
                            }`}>
                              {payment.status === 'completed' ? (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              ) : payment.status === 'pending' ? (
                                <Clock className="h-5 w-5 text-warning" />
                              ) : (
                                <XCircle className="h-5 w-5 text-destructive" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium capitalize">{payment.payment_type || 'Payment'}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(payment.payment_date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-serif text-lg">${Number(payment.amount).toLocaleString()}</p>
                            <Badge 
                              variant="outline" 
                              className={`text-xs capitalize ${
                                payment.status === 'completed' ? 'border-success text-success' :
                                payment.status === 'pending' ? 'border-warning text-warning' :
                                'border-destructive text-destructive'
                              }`}
                            >
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <Wallet className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <h3 className="text-xl font-serif mb-2">No Payments Found</h3>
                      <p className="text-muted-foreground">
                        {payments && payments.length > 0 
                          ? "No payments match your selected date range" 
                          : "Your payment history will appear here once you make your first payment"}
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <h1 className="text-3xl font-serif">Documents</h1>
                  <p className="text-muted-foreground">Access your uploaded and signed documents</p>
                </div>

                <Card className="p-12 text-center border-dashed">
                  <Folder className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-xl font-serif mb-2">Document Center</h3>
                  <p className="text-muted-foreground">Your documents and signed leases will be stored here</p>
                </Card>
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <h1 className="text-3xl font-serif">Messages</h1>
                  <p className="text-muted-foreground">Communicate with your property manager</p>
                </div>

                <TenantMessagingCenter />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Balance Payment Dialog */}
      {tenantRecord?.id && (
        <PaymentDialog
          open={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          tenantId={tenantRecord.id}
          currentBalance={currentBalance}
          rentAmount={tenantRecord.rent_amount ?? undefined}
          onSuccess={() => {
            refetchTenant();
          }}
        />
      )}

      {/* Rent/Deposit Payment Dialog */}
      <RentPaymentDialog
        open={rentPaymentDialog?.open ?? false}
        onClose={() => setRentPaymentDialog(null)}
        leaseId={rentPaymentDialog?.leaseId ?? ''}
        amount={rentPaymentDialog?.amount ?? 0}
        paymentType={rentPaymentDialog?.type ?? 'rent'}
        onSuccess={() => {
          refetchTenant();
          toast.success('Payment completed successfully!');
          setRentPaymentDialog(null);
        }}
      />
    </div>
  );
}
