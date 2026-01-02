import { useState, useEffect, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useMyApplications } from '@/hooks/useApplications';
import { useLeases } from '@/hooks/useLeases';
import { useUnreadCount } from '@/hooks/useMessages';
import { useStripeCheckout } from '@/hooks/useStripePayments';
import { useProfile } from '@/hooks/useProfiles';
import { usePayments } from '@/hooks/usePayments';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { TenantMessagingCenter } from '@/components/messages/TenantMessagingCenter';
import { NotificationBell } from '@/components/notifications/NotificationBell';
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
  TrendingUp,
  TrendingDown,
  Receipt,
  Menu,
  User,
  LayoutDashboard,
  AlertCircle,
  CalendarDays,
  Bell
} from 'lucide-react';
import logo from '@/assets/logo.png';

type PortalTab = 'dashboard' | 'applications' | 'leases' | 'payments' | 'documents' | 'messages';

export default function TenantPortal() {
  const { user, role, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const { data: myApplications, isLoading: applicationsLoading } = useMyApplications(user?.id);
  const { data: leases, isLoading: leasesLoading } = useLeases(user?.id, role);
  const { data: unreadCount } = useUnreadCount(user?.id);
  const { data: tenantProfile } = useProfile(user?.id);

  const { paySecurityDeposit, payRent, isLoading: isPaymentLoading } = useStripeCheckout();
  const [pendingPayment, setPendingPayment] = useState<{ type: string; id: string; amount?: number } | null>(null);

  // Fetch tenant's payment history
  const { data: payments, isLoading: paymentsLoading } = usePayments(undefined, user?.id);

  // Fetch tenant's actual balance from tenants table
  const { data: tenantRecord, refetch: refetchTenant } = useQuery({
    queryKey: ['tenant-balance', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('id, current_balance, rent_amount, lease_start_date')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

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

  const handlePayDeposit = async (leaseId: string, amount: number) => {
    setPendingPayment({ type: 'deposit', id: leaseId, amount });
    const result = await paySecurityDeposit(leaseId, amount);
    if (result.success) {
      toast.info('Complete your deposit payment in the new tab');
    }
    setPendingPayment(null);
  };

  const handlePayRent = async (leaseId: string, amount: number) => {
    setPendingPayment({ type: 'rent', id: leaseId, amount });
    const result = await payRent(leaseId, amount);
    if (result.success) {
      toast.info('Complete your rent payment in the new tab');
    }
    setPendingPayment(null);
  };

  // Calculate balance summary
  const totalPaid = payments?.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const pendingPayments = payments?.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  // Dashboard calculations
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
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs md:text-sm text-muted-foreground">Current Balance</p>
                        <p className={`text-xl md:text-2xl font-serif mt-1 truncate ${isOverdue ? 'text-destructive' : ''}`}>
                          ${Math.abs(currentBalance).toLocaleString()}
                        </p>
                        {isOverdue && (
                          <Badge variant="destructive" className="mt-1 text-xs">
                            Amount Due
                          </Badge>
                        )}
                        {currentBalance < 0 && (
                          <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary">
                            Credit
                          </Badge>
                        )}
                      </div>
                      <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        <DollarSign className={`h-5 w-5 md:h-6 md:w-6 ${isOverdue ? 'text-destructive' : 'text-primary'}`} />
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 md:p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs md:text-sm text-muted-foreground">Next Rent Due</p>
                        <p className="text-xl md:text-2xl font-serif mt-1 truncate">
                          ${nextRent.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{nextRentDueDate}</p>
                      </div>
                      <div className="w-10 h-10 md:w-11 md:h-11 bg-accent/50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="h-5 w-5 md:h-6 md:w-6 text-foreground/70" />
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 md:p-5 hover:shadow-md transition-shadow">
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

                  <Card className="p-4 md:p-5 hover:shadow-md transition-shadow">
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
                            disabled={isPaymentLoading}
                          >
                            {isPaymentLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : null}
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
                              <Button className="mt-4" size="sm">
                                View Lease <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
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
                ) : leases && leases.length > 0 ? (
                  <div className="space-y-4">
                    {leases.map((lease: any) => (
                      <Card key={lease.id} className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-serif text-xl mb-1">{lease.properties?.address}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>{new Date(lease.start_date).toLocaleDateString()} - {new Date(lease.end_date).toLocaleDateString()}</span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                ${Number(lease.monthly_rent).toLocaleString()}/mo
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant="outline"
                              className={
                                lease.status === 'completed' ? 'border-success text-success' :
                                lease.status === 'pending_tenant_signature' ? 'border-warning text-warning' :
                                'border-muted text-muted-foreground'
                              }
                            >
                              {lease.status.replace(/_/g, ' ')}
                            </Badge>
                            {lease.status === 'pending_tenant_signature' && (
                              <Link to={`/sign-lease/${lease.id}`}>
                                <Button>
                                  <PenTool className="h-4 w-4 mr-2" /> Sign Lease
                                </Button>
                              </Link>
                            )}
                            {lease.status === 'completed' && (
                              <>
                                {lease.security_deposit && (
                                  <Button 
                                    variant="outline"
                                    onClick={() => handlePayDeposit(lease.id, Number(lease.security_deposit))}
                                    disabled={isPaymentLoading && pendingPayment?.id === lease.id && pendingPayment?.type === 'deposit'}
                                  >
                                    {isPaymentLoading && pendingPayment?.id === lease.id && pendingPayment?.type === 'deposit' ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <CreditCard className="h-4 w-4 mr-2" />
                                    )}
                                    Pay Deposit (${Number(lease.security_deposit).toLocaleString()})
                                  </Button>
                                )}
                                <Button 
                                  onClick={() => handlePayRent(lease.id, Number(lease.monthly_rent))}
                                  disabled={isPaymentLoading && pendingPayment?.id === lease.id && pendingPayment?.type === 'rent'}
                                >
                                  {isPaymentLoading && pendingPayment?.id === lease.id && pendingPayment?.type === 'rent' ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <CreditCard className="h-4 w-4 mr-2" />
                                  )}
                                  Pay Rent (${Number(lease.monthly_rent).toLocaleString()})
                                </Button>
                                <Link to={`/sign-lease/${lease.id}`}>
                                  <Button variant="ghost" size="sm">
                                    <Download className="h-4 w-4 mr-2" /> View
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
                  <p className="text-muted-foreground">View your payment history and balance</p>
                </div>

                {/* Balance Summary Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Total Paid</p>
                        <p className="text-3xl font-serif mt-1 text-success">${totalPaid.toLocaleString()}</p>
                      </div>
                      <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-success" />
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Pending</p>
                        <p className="text-3xl font-serif mt-1 text-warning">${pendingPayments.toLocaleString()}</p>
                      </div>
                      <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                        <Clock className="h-6 w-6 text-warning" />
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Total Transactions</p>
                        <p className="text-3xl font-serif mt-1">{payments?.length || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Receipt className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </Card>
                </div>

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
                  ) : payments && payments.length > 0 ? (
                    <div className="divide-y divide-border">
                      {payments.map((payment) => (
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
                      <h3 className="text-xl font-serif mb-2">No Payments Yet</h3>
                      <p className="text-muted-foreground">Your payment history will appear here once you make your first payment</p>
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
    </div>
  );
}
