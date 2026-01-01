import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailableProperties, useProperty } from '@/hooks/useProperties';
import { useApplicationFee } from '@/hooks/useAppSettings';
import { useMyApplications, useCreateApplication } from '@/hooks/useApplications';
import { useLeases } from '@/hooks/useLeases';
import { useMessages, useUnreadCount } from '@/hooks/useMessages';
import { useStripeCheckout } from '@/hooks/useStripePayments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { TenantMessagingCenter } from '@/components/messages/TenantMessagingCenter';
import { AuditCertificate } from '@/components/leases/AuditCertificate';
import { 
  Building2, 
  Home, 
  FileText, 
  MessageSquare, 
  ClipboardList,
  LogOut,
  Bed,
  Bath,
  MapPin,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Shield,
  AlertTriangle,
  Upload,
  Key,
  ArrowRight,
  Folder,
  PenTool,
  Download,
  CreditCard,
  Loader2
} from 'lucide-react';

type PortalTab = 'browse' | 'applications' | 'leases' | 'documents' | 'messages';

export default function TenantPortal() {
  const { user, role, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<PortalTab>('browse');
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [applicationStep, setApplicationStep] = useState(1);

  const { data: properties, isLoading: propertiesLoading } = useAvailableProperties();
  const { data: myApplications, isLoading: applicationsLoading } = useMyApplications(user?.id);
  const { data: leases, isLoading: leasesLoading } = useLeases(user?.id, role);
  const { data: unreadCount } = useUnreadCount(user?.id);
  const { data: propertyDetails } = useProperty(selectedProperty || undefined);

  const createApplication = useCreateApplication();
  const { payApplicationFee, paySecurityDeposit, payRent, isLoading: isPaymentLoading } = useStripeCheckout();
  const [pendingPayment, setPendingPayment] = useState<{ type: string; id: string; amount?: number } | null>(null);
  
  const { data: applicationFee, isLoading: feeLoading } = useApplicationFee();
  const feeAmountDisplay = applicationFee ? `$${(applicationFee.amount / 100).toFixed(0)}` : '$50';

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

  const handleStartApplication = (propertyId: string) => {
    setSelectedProperty(propertyId);
    setApplicationStep(1);
    setIsApplyDialogOpen(true);
  };

  const handlePayApplicationFee = async () => {
    if (!selectedProperty) return;
    
    const result = await payApplicationFee(selectedProperty);
    if (result.success) {
      toast.info('Complete payment in the new tab, then return to continue your application');
      // Move to step 2 while they pay
      setApplicationStep(2);
    }
  };

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

  const handleSubmitApplication = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProperty) return;

    const formData = new FormData(e.currentTarget);
    const backgroundConsent = formData.get('background_consent') === 'on';

    if (!backgroundConsent) {
      toast.error('You must consent to the background check to proceed');
      return;
    }

    await createApplication.mutateAsync({
      property_id: selectedProperty,
      applicant_id: user.id,
      personal_info: {
        current_address: formData.get('current_address') as string,
        phone: formData.get('phone') as string,
      },
      employment_info: {
        employer: formData.get('employer') as string,
        job_title: formData.get('job_title') as string,
        annual_income: formData.get('annual_income') as string,
      },
      background_check_consent: backgroundConsent,
    });

    setIsApplyDialogOpen(false);
    setSelectedProperty(null);
    setActiveTab('applications');
  };

  const navItems = [
    { id: 'browse', label: 'Browse Properties', icon: Search },
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
            <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
              <Key className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <span className="text-lg font-serif text-sidebar-foreground block">Tenant Portal</span>
              <span className="text-xs text-sidebar-foreground/60">PropertyFlow Pro</span>
            </div>
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
          {/* Browse Properties Tab */}
          {activeTab === 'browse' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Browse Properties</h1>
                <p className="text-muted-foreground">Find your perfect rental home</p>
              </div>

              {propertiesLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <div className="h-48 bg-muted" />
                      <CardContent className="p-4">
                        <div className="h-6 bg-muted rounded w-1/2 mb-2" />
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : properties && properties.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.map((property) => (
                    <Card key={property.id} className="overflow-hidden hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 group">
                      <div className="h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
                        <Building2 className="h-16 w-16 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-300" />
                        <Badge className="absolute top-4 right-4 bg-success text-success-foreground">
                          Available
                        </Badge>
                      </div>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-serif text-2xl">
                            ${Number(property.rent_amount).toLocaleString()}
                            <span className="text-base text-muted-foreground">/mo</span>
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground mb-3">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm truncate">{property.address}, {property.city}, {property.state}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span className="flex items-center gap-1">
                            <Bed className="h-4 w-4" /> {property.bedrooms} bed
                          </span>
                          <span className="flex items-center gap-1">
                            <Bath className="h-4 w-4" /> {property.bathrooms} bath
                          </span>
                        </div>
                        {property.description && (
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{property.description}</p>
                        )}
                        <Button 
                          className="w-full" 
                          onClick={() => handleStartApplication(property.id)}
                        >
                          Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center border-dashed">
                  <Building2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-xl font-serif mb-2">No Properties Available</h3>
                  <p className="text-muted-foreground">Check back soon for new listings!</p>
                </Card>
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
                  <Button onClick={() => setActiveTab('browse')}>
                    <Search className="mr-2 h-4 w-4" /> Browse Properties
                  </Button>
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

      {/* Application Dialog */}
      <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {applicationStep === 1 && 'Application Fee Notice'}
              {applicationStep === 2 && 'Personal Information'}
              {applicationStep === 3 && 'Employment & Income'}
              {applicationStep === 4 && 'Document Upload'}
              {applicationStep === 5 && 'Background Check Consent'}
            </DialogTitle>
            <DialogDescription>
              Step {applicationStep} of 5 — {propertyDetails?.address}
            </DialogDescription>
          </DialogHeader>

          {applicationStep === 1 && (
            <div className="space-y-6 py-4">
              <Card className="p-6 bg-warning/5 border-warning/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <DollarSign className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl mb-2">Application Fee: {feeAmountDisplay}</h3>
                    <p className="text-muted-foreground">
                      A non-refundable application fee of {feeAmountDisplay} is required to process your rental application. 
                      This covers background check, credit check, and application processing.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  By proceeding, you acknowledge that the application fee is non-refundable regardless of the application outcome. 
                  Payment will be collected upon submission.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>
                  Cancel
                </Button>
              <Button onClick={handlePayApplicationFee} disabled={isPaymentLoading || feeLoading}>
                  {isPaymentLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" /> Pay {feeAmountDisplay} & Continue
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {applicationStep >= 2 && (
            <form onSubmit={handleSubmitApplication}>
              {applicationStep === 2 && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" name="phone" type="tel" required placeholder="(555) 123-4567" />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="current_address">Current Address</Label>
                      <Input id="current_address" name="current_address" required placeholder="456 Current St, City, State 12345" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setApplicationStep(1)}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => setApplicationStep(3)}>
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {applicationStep === 3 && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="employer">Employer Name</Label>
                      <Input id="employer" name="employer" required placeholder="Company Inc." />
                    </div>
                    <div>
                      <Label htmlFor="job_title">Job Title</Label>
                      <Input id="job_title" name="job_title" required placeholder="Software Engineer" />
                    </div>
                    <div>
                      <Label htmlFor="annual_income">Annual Income</Label>
                      <Input id="annual_income" name="annual_income" type="number" required placeholder="75000" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setApplicationStep(2)}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => setApplicationStep(4)}>
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {applicationStep === 4 && (
                <div className="space-y-4 py-4">
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center gap-3 mb-4">
                      <Shield className="h-5 w-5 text-accent" />
                      <span className="font-medium">Your documents are encrypted and secure</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      All documents are encrypted using bank-level security and stored securely. 
                      Only authorized property managers can access your documents.
                    </p>
                  </Card>

                  <div className="space-y-4">
                    <div>
                      <Label>Driver's License</Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or PDF up to 10MB</p>
                      </div>
                    </div>
                    <div>
                      <Label>Social Security Card</Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or PDF up to 10MB</p>
                      </div>
                    </div>
                    <div>
                      <Label>Proof of Income (optional)</Label>
                      <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Pay stubs, tax returns, or bank statements</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or PDF up to 10MB</p>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setApplicationStep(3)}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => setApplicationStep(5)}>
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {applicationStep === 5 && (
                <div className="space-y-6 py-4">
                  <Card className="p-6 bg-primary/5 border-primary/20">
                    <h3 className="font-serif text-lg mb-3">Background Check Authorization</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      By checking the box below, you authorize PropertyFlow Pro and its partners to conduct 
                      a comprehensive background check, which may include:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        Credit history and credit score
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        Criminal background check
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        Eviction history
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                        Employment verification
                      </li>
                    </ul>
                  </Card>

                  <div className="flex items-start gap-3">
                    <Checkbox id="background_consent" name="background_consent" className="mt-1" />
                    <Label htmlFor="background_consent" className="text-sm leading-relaxed cursor-pointer">
                      I authorize PropertyFlow Pro to conduct a background check and verify the information 
                      provided in this application. I understand this may affect my credit score and that 
                      the results will be shared with the property manager.
                    </Label>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setApplicationStep(4)}>
                      Back
                    </Button>
                    <Button type="submit" disabled={createApplication.isPending}>
                      {createApplication.isPending ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
