import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyApplications } from '@/hooks/useApplications';
import { useLeases } from '@/hooks/useLeases';
import { useUnreadCount } from '@/hooks/useMessages';
import { useStripeCheckout } from '@/hooks/useStripePayments';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { TenantMessagingCenter } from '@/components/messages/TenantMessagingCenter';
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
  Loader2
} from 'lucide-react';
import logo from '@/assets/logo.png';

type PortalTab = 'applications' | 'leases' | 'documents' | 'messages';

export default function TenantPortal() {
  const { user, role, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<PortalTab>('applications');

  const { data: myApplications, isLoading: applicationsLoading } = useMyApplications(user?.id);
  const { data: leases, isLoading: leasesLoading } = useLeases(user?.id, role);
  const { data: unreadCount } = useUnreadCount(user?.id);

  const { paySecurityDeposit, payRent, isLoading: isPaymentLoading } = useStripeCheckout();
  const [pendingPayment, setPendingPayment] = useState<{ type: string; id: string; amount?: number } | null>(null);

  if (loading) {
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

  const navItems = [
    { id: 'applications', label: 'My Applications', icon: ClipboardList },
    { id: 'leases', label: 'My Leases', icon: FileText },
    { id: 'documents', label: 'Documents', icon: Folder },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar min-h-screen p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <img src={logo} alt="Sterling Gate Properties" className="h-14 w-auto object-contain" />
          </div>
          
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as PortalTab)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-smooth text-left ${
                  activeTab === item.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <span className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <Badge variant="secondary" className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {item.badge}
                  </Badge>
                )}
              </button>
            ))}
          </nav>

          <Separator className="my-4 bg-sidebar-border" />
          
          <Link to="/" className="block mb-2">
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50">
              <Home className="mr-3 h-5 w-5" /> Back to Home
            </Button>
          </Link>
          
          <Button 
            variant="ghost" 
            onClick={() => signOut()} 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="mr-3 h-5 w-5" /> Sign Out
          </Button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-auto">
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
        </main>
      </div>
    </div>
  );
}
