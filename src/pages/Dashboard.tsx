import { useState, useEffect, useCallback, useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerProperties, useCreateProperty, useUpdateProperty, useDeleteProperty } from '@/hooks/useProperties';
import { useApplications, useUpdateApplication } from '@/hooks/useApplications';
import { ApplicationDetailsDialog } from '@/components/applications/ApplicationDetailsDialog';
import { useTenants, useAddTenant, useUpdateTenant, useDeleteTenant, useRevokeTenantAccess, useHardDeleteTenant } from '@/hooks/useTenants';
import { AddTenantDialog } from '@/components/tenants/AddTenantDialog';
import { TenantsTable } from '@/components/tenants/TenantsTable';
import { TenantDetailsDialog } from '@/components/tenants/TenantDetailsDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLeases, useDeleteLease } from '@/hooks/useLeases';
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
import { useUnreadCount } from '@/hooks/useMessages';
import { usePropertyImages } from '@/hooks/usePropertyImages';
import { useProfile } from '@/hooks/useProfiles';
import { useUnreadPaymentNotifications } from '@/hooks/useUnreadPaymentNotifications';
import { useUnreadInquiriesCount } from '@/hooks/useInquiries';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { OverdueRentAlert } from '@/components/notifications/OverdueRentAlert';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { AuditDashboard } from '@/components/audit/AuditDashboard';
import { ImageUploader } from '@/components/properties/ImageUploader';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { EditPropertyDialog } from '@/components/properties/EditPropertyDialog';
import { CreateLeaseWizard } from '@/components/leases/CreateLeaseWizard';
import { EditLeaseDialog } from '@/components/leases/EditLeaseDialog';
import { MessagingCenter } from '@/components/messages/MessagingCenter';
import { AuditCertificate } from '@/components/leases/AuditCertificate';
import { InquiriesTab } from '@/components/inquiries/InquiriesTab';
import type { Database } from '@/integrations/supabase/types';
import { MaintenanceDashboard } from '@/components/maintenance/MaintenanceDashboard';
import { 
  LayoutDashboard, 
  Home, 
  Users, 
  FileText, 
  MessageSquare, 
  ClipboardList,
  Plus,
  LogOut,
  MapPin,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Edit,
  BarChart3,
  Receipt,
  Layers,
  Download,
  PenTool,
  Shield,
  Menu,
  HelpCircle,
  Wrench
} from 'lucide-react';
import logo from '@/assets/logo.png';

type DashboardTab = 'overview' | 'properties' | 'applications' | 'tenants' | 'leases' | 'messages' | 'inquiries' | 'analytics' | 'audit' | 'maintenance';
type Property = Database['public']['Tables']['properties']['Row'];

export default function Dashboard() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isCreateLeaseOpen, setIsCreateLeaseOpen] = useState(false);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [isTenantDetailsOpen, setIsTenantDetailsOpen] = useState(false);
  const [propertyImages, setPropertyImages] = useState<string[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLeaseForCert, setSelectedLeaseForCert] = useState<any>(null);
  const [selectedLeaseForEdit, setSelectedLeaseForEdit] = useState<any>(null);
  const [isEditLeaseOpen, setIsEditLeaseOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [isApplicationDetailsOpen, setIsApplicationDetailsOpen] = useState(false);

  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  const { data: properties, isLoading: propertiesLoading } = useManagerProperties(user?.id);
  const { data: applications, isLoading: applicationsLoading, isError: applicationsError, refetch: refetchApplications } = useApplications();
  const { data: tenants, isLoading: tenantsLoading } = useTenants(user?.id);
  const { data: leases, isLoading: leasesLoading } = useLeases(user?.id, role);
  const { data: unreadCount } = useUnreadCount(user?.id);
  const { data: managerProfile } = useProfile(user?.id);
  const { unreadPaymentCount, markAllPaymentNotificationsRead } = useUnreadPaymentNotifications();
  const { data: unreadInquiriesCount } = useUnreadInquiriesCount(user?.id);

  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const updateApplication = useUpdateApplication();
  const deleteLease = useDeleteLease();
  const { uploadImages, uploading, maxImages } = usePropertyImages();

  // Mark payment notifications as read when Audit tab is opened
  const handleMarkPaymentNotificationsRead = useCallback(() => {
    if (activeTab === 'audit') {
      markAllPaymentNotificationsRead();
    }
  }, [activeTab, markAllPaymentNotificationsRead]);

  useEffect(() => {
    handleMarkPaymentNotificationsRead();
  }, [handleMarkPaymentNotificationsRead]);

  // Handle tab navigation from URL query params (for notification clicks)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'properties', 'applications', 'tenants', 'leases', 'messages', 'inquiries', 'analytics', 'audit', 'maintenance'].includes(tabParam)) {
      setActiveTab(tabParam as DashboardTab);
      // Clear the query param after setting the tab
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Realtime subscription for properties
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('properties-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties',
          filter: `manager_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['properties', 'manager', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Realtime subscription for tenants
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('tenants-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
          filter: `manager_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tenants', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Sync selectedTenant with fresh data after tenants refetch
  useEffect(() => {
    if (selectedTenant && tenants && Array.isArray(tenants)) {
      const freshTenant = tenants.find((t: any) => t.id === selectedTenant.id);
      if (freshTenant && JSON.stringify(freshTenant) !== JSON.stringify(selectedTenant)) {
        setSelectedTenant(freshTenant);
      }
    }
  }, [tenants, selectedTenant?.id]);

  // Realtime subscription for leases
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('leases-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leases',
          filter: `manager_id=eq.${user.id}`,
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

  // Realtime subscription for applications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('applications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['applications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Calculate expiring leases for warnings (must be declared before any early returns)
  const expiringLeases = useMemo(() => {
    if (!leases) return { all: [], expired: [], critical: [], warning: [] };

    const today = new Date();
    const completedLeases = leases.filter((l: any) => l.status === 'completed');

    const all = completedLeases.filter((l: any) => {
      const daysUntilEnd = differenceInDays(new Date(l.end_date), today);
      return daysUntilEnd <= 30;
    });

    const expired = all.filter((l: any) => differenceInDays(new Date(l.end_date), today) < 0);

    const critical = all.filter((l: any) => {
      const days = differenceInDays(new Date(l.end_date), today);
      return days >= 0 && days <= 7;
    });

    const warning = all.filter((l: any) => {
      const days = differenceInDays(new Date(l.end_date), today);
      return days > 7 && days <= 30;
    });

    return { all, expired, critical, warning };
  }, [leases]);

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

  if (role !== 'property_manager') {
    return <Navigate to="/tenant" replace />;
  }

  const stats = {
    totalProperties: properties?.length || 0,
    availableProperties: properties?.filter(p => p.status === 'available').length || 0,
    occupiedProperties: properties?.filter(p => p.status === 'occupied').length || 0,
    pendingApplications: applications?.filter(a => a.status === 'pending' || a.status === 'under_review').length || 0,
    activeTenants: tenants?.length || 0,
    pendingLeases: leases?.filter(l => l.status !== 'completed').length || 0,
  };


  const handleAddProperty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Create property first
    const newProperty = await createProperty.mutateAsync({
      manager_id: user.id,
      address: formData.get('address') as string,
      city: formData.get('city') as string,
      state: formData.get('state') as string,
      zip_code: formData.get('zip_code') as string,
      rent_amount: parseFloat(formData.get('rent_amount') as string),
      square_feet: formData.get('square_feet') ? parseInt(formData.get('square_feet') as string) : null,
      description: formData.get('description') as string || null,
      status: 'available',
    });

    // Upload images if any
    if (pendingImageFiles.length > 0 && newProperty) {
      const uploadedUrls = await uploadImages(pendingImageFiles, newProperty.id);
      if (uploadedUrls.length > 0) {
        await updateProperty.mutateAsync({
          id: newProperty.id,
          photos: uploadedUrls,
        });
      }
    }

    // Reset state
    setPropertyImages([]);
    setPendingImageFiles([]);
    setIsAddPropertyOpen(false);
  };

  const handleFilesSelect = (files: File[]) => {
    setPendingImageFiles(prev => [...prev, ...files].slice(0, maxImages));
    // Create preview URLs
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPropertyImages(prev => [...prev, ...newPreviews].slice(0, maxImages));
  };

  const handleImagesChange = (newImages: string[]) => {
    // Find which images were removed
    const removedIndexes = propertyImages
      .map((img, idx) => newImages.includes(img) ? -1 : idx)
      .filter(idx => idx !== -1);
    
    // Update pending files accordingly
    const newPendingFiles = pendingImageFiles.filter((_, idx) => !removedIndexes.includes(idx));
    setPendingImageFiles(newPendingFiles);
    setPropertyImages(newImages);
  };

  const handleApproveApplication = async (applicationId: string) => {
    await updateApplication.mutateAsync({
      id: applicationId,
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    });
    toast.success('Application approved!');
  };

  const handleRejectApplication = async (applicationId: string, reason: string) => {
    await updateApplication.mutateAsync({
      id: applicationId,
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    });
    toast.success('Application rejected');
  };

  const handleEditProperty = (property: Property) => {
    setEditingProperty(property);
    setIsEditDialogOpen(true);
  };

  const handleSaveProperty = async (id: string, updates: Partial<Property>) => {
    await updateProperty.mutateAsync({ id, ...updates });
    setIsEditDialogOpen(false);
    setEditingProperty(null);
  };

  const handleDeleteProperty = async (id: string) => {
    await deleteProperty.mutateAsync(id);
  };

  const handleStatusChange = async (id: string, status: 'available' | 'occupied' | 'off_market') => {
    await updateProperty.mutateAsync({ id, status });
  };

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'properties', label: 'Properties', icon: Home },
    { id: 'applications', label: 'Applications', icon: ClipboardList, badge: stats.pendingApplications },
    { id: 'tenants', label: 'Tenants', icon: Users },
    { id: 'leases', label: 'Leases', icon: FileText },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadCount },
    { id: 'inquiries', label: 'Inquiries', icon: HelpCircle, badge: unreadInquiriesCount },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'audit', label: 'Payments', icon: Receipt, badge: unreadPaymentCount },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  ];


  // Sidebar content component
  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      <Link to="/" className="flex items-center mb-8 w-full">
        <img src={logo} alt="Sterling Gate Properties" className="h-16 md:h-24 w-auto object-contain" />
      </Link>
      
      <nav className="space-y-1 flex-1 overflow-hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id as DashboardTab);
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
                  {navItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h2>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <OverdueRentAlert managerId={user?.id} />
                <NotificationBell />
                <SettingsDialog />
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8 overflow-hidden">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
                <div>
                  <h1 className="text-2xl md:text-3xl font-serif">Dashboard</h1>
                  <p className="text-muted-foreground text-sm md:text-base">Welcome back! Here's your property overview.</p>
                </div>
                <Button onClick={() => setIsAddPropertyOpen(true)} className="w-full sm:w-auto min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" /> Add Property
                </Button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
                <Card className="hover:shadow-card transition-smooth">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Total Properties</p>
                        <p className="text-4xl font-serif mt-1">{stats.totalProperties}</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Home className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        {stats.availableProperties} available
                      </Badge>
                      <Badge variant="secondary">
                        {stats.occupiedProperties} occupied
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-card transition-smooth">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Active Tenants</p>
                        <p className="text-4xl font-serif mt-1">{stats.activeTenants}</p>
                      </div>
                      <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                        <Users className="h-6 w-6 text-accent" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-card transition-smooth">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Pending Applications</p>
                        <p className="text-4xl font-serif mt-1">{stats.pendingApplications}</p>
                      </div>
                      <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                        <ClipboardList className="h-6 w-6 text-warning" />
                      </div>
                    </div>
                    {stats.pendingApplications > 0 && (
                      <Button 
                        variant="link" 
                        className="p-0 h-auto mt-2 text-sm"
                        onClick={() => setActiveTab('applications')}
                      >
                        Review applications →
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="hover:shadow-card transition-smooth">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground text-sm">Pending Leases</p>
                        <p className="text-4xl font-serif mt-1">{stats.pendingLeases}</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Lease Expiration Warnings */}
              {expiringLeases.all.length > 0 && (
                <Card className="border-warning/50 bg-warning/5 mb-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-serif text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-warning" />
                      Lease Attention Required
                    </CardTitle>
                    <CardDescription>
                      {expiringLeases.expired.length > 0 && `${expiringLeases.expired.length} expired · `}
                      {expiringLeases.critical.length > 0 && `${expiringLeases.critical.length} expiring within 7 days · `}
                      {expiringLeases.warning.length > 0 && `${expiringLeases.warning.length} expiring within 30 days`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {expiringLeases.all.slice(0, 5).map((lease: any) => {
                        const daysUntilEnd = differenceInDays(new Date(lease.end_date), new Date());
                        const isExpired = daysUntilEnd < 0;
                        const isCritical = daysUntilEnd >= 0 && daysUntilEnd <= 7;
                        
                        return (
                          <div 
                            key={lease.id} 
                            className="flex items-center justify-between p-3 bg-background rounded-lg border cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => navigate(`/sign-lease/${lease.id}`)}
                          >
                            <div>
                              <p className="font-medium">{lease.properties?.address}</p>
                              <p className="text-sm text-muted-foreground">
                                {lease.tenant?.full_name || lease.tenant?.email} · Ends {new Date(lease.end_date).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={
                                isExpired ? 'bg-destructive/10 text-destructive border-destructive' :
                                isCritical ? 'bg-destructive/10 text-destructive border-destructive' :
                                'bg-warning/10 text-warning border-warning'
                              }
                            >
                              {isExpired ? 'Expired' : `${daysUntilEnd} days left`}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                    {expiringLeases.all.length > 5 && (
                      <Button variant="link" className="mt-2 p-0 h-auto" onClick={() => setActiveTab('leases')}>
                        View all {expiringLeases.all.length} leases →
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif">Recent Applications</CardTitle>
                    <CardDescription>Review and respond to new applications</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {applications && applications.filter(a => a.status === 'pending').length > 0 ? (
                      <div className="space-y-3">
                        {applications.filter(a => a.status === 'pending').slice(0, 3).map((app: any) => (
                          <div key={app.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium">{app.profiles?.full_name || 'Applicant'}</p>
                              <p className="text-sm text-muted-foreground">{app.properties?.address}</p>
                            </div>
                            <Badge variant="outline" className="text-warning border-warning">
                              <Clock className="h-3 w-3 mr-1" /> Pending
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No pending applications</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-serif">Quick Actions</CardTitle>
                    <CardDescription>Common tasks at your fingertips</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full justify-start" variant="outline" onClick={() => setIsAddPropertyOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add New Property
                    </Button>
                    <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('applications')}>
                      <ClipboardList className="mr-2 h-4 w-4" /> Review Applications
                    </Button>
                    <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab('messages')}>
                      <MessageSquare className="mr-2 h-4 w-4" /> View Messages
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Properties Tab */}
          {activeTab === 'properties' && (
            <div className="animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
                <div>
                  <h1 className="text-2xl md:text-3xl font-serif">Properties</h1>
                  <p className="text-muted-foreground text-sm md:text-base">Manage your rental properties</p>
                </div>
                <Button onClick={() => setIsAddPropertyOpen(true)} className="w-full sm:w-auto min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" /> Add Property
                </Button>
              </div>

              {propertiesLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <div className="h-40 bg-muted" />
                      <CardContent className="p-4">
                        <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : properties && properties.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onEdit={handleEditProperty}
                      onDelete={handleDeleteProperty}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center border-dashed">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-xl font-serif mb-2">No Properties Yet</h3>
                  <p className="text-muted-foreground mb-6">Add your first property to get started</p>
                  <Button onClick={() => setIsAddPropertyOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Property
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* Applications Tab */}
          {activeTab === 'applications' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Applications</h1>
                <p className="text-muted-foreground">Review and manage rental applications</p>
              </div>

              {applicationsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-4 animate-pulse">
                      <div className="h-20 bg-muted rounded" />
                    </Card>
                  ))}
                </div>
              ) : applicationsError ? (
                <Card className="p-12 text-center border-destructive border-dashed">
                  <XCircle className="h-12 w-12 mx-auto text-destructive/50 mb-4" />
                  <h3 className="text-xl font-serif mb-2">Unable to Load Applications</h3>
                  <p className="text-muted-foreground mb-6">There was an error loading applications. Please try again.</p>
                  <Button onClick={() => refetchApplications()} variant="outline">
                    Retry
                  </Button>
                </Card>
              ) : applications && applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map((app: any) => (
                    <Card 
                      key={app.id} 
                      className="p-6 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => {
                        setSelectedApplication(app);
                        setIsApplicationDetailsOpen(true);
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-serif text-lg sm:text-xl">{app.profiles?.full_name || 'Applicant'}</h3>
                            <Badge 
                              variant="outline"
                              className={
                                app.status === 'approved' ? 'border-success text-success' :
                                app.status === 'rejected' ? 'border-destructive text-destructive' :
                                'border-warning text-warning'
                              }
                            >
                              {app.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {app.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                              {app.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                              {app.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-1 text-sm truncate">
                            <MapPin className="h-4 w-4 inline mr-1" />
                            {app.properties?.address}, {app.properties?.city}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Applied: {new Date(app.created_at).toLocaleDateString()}
                          </p>
                          {app.background_check_consent && (
                            <Badge variant="secondary" className="mt-2">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Background check consent given
                            </Badge>
                          )}
                        </div>
                        {app.status === 'pending' && (
                          <div className="flex gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="flex-1 sm:flex-initial"
                              onClick={() => handleRejectApplication(app.id, 'Application did not meet requirements')}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                            <Button 
                              size="sm"
                              className="flex-1 sm:flex-initial"
                              onClick={() => handleApproveApplication(app.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center border-dashed">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-xl font-serif mb-2">No Applications</h3>
                  <p className="text-muted-foreground">Applications will appear here when tenants apply to your properties</p>
                </Card>
              )}
            </div>
          )}

          {/* Tenants Tab */}
          {activeTab === 'tenants' && (
            <div className="animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
                <div>
                  <h1 className="text-2xl md:text-3xl font-serif">Tenants</h1>
                  <p className="text-muted-foreground text-sm md:text-base">Manage your current tenants</p>
                </div>
                <Button onClick={() => setIsAddTenantOpen(true)} className="w-full sm:w-auto min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" /> Add Tenant
                </Button>
              </div>

              {tenantsLoading ? (
                <Card>
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                </Card>
              ) : tenants && tenants.length > 0 ? (
                <TenantsTable 
                  tenants={tenants} 
                  onNavigate={(tenantId) => navigate(`/dashboard/tenant/${tenantId}`)} 
                />
              ) : (
                <Card className="p-12 text-center border-dashed">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-xl font-serif mb-2">No Tenants Yet</h3>
                  <p className="text-muted-foreground mb-6">Add your first tenant or approve applicants to get started</p>
                  <Button onClick={() => setIsAddTenantOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Tenant
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* Leases Tab */}
          {activeTab === 'leases' && (
            <div className="animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
                <div>
                  <h1 className="text-2xl md:text-3xl font-serif">Leases</h1>
                  <p className="text-muted-foreground text-sm md:text-base">Manage and track lease agreements</p>
                </div>
                <Button onClick={() => setIsCreateLeaseOpen(true)} className="btn-platinum w-full sm:w-auto min-h-[44px]">
                  <Plus className="h-4 w-4 mr-2" /> Create Lease
                </Button>
              </div>

              {leasesLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Card key={i} className="p-4 animate-pulse">
                      <div className="h-24 bg-muted rounded" />
                    </Card>
                  ))}
                </div>
              ) : leases && leases.length > 0 ? (
                <div className="space-y-4">
                  {leases.map((lease: any) => {
                    // Status badge configuration
                    const statusConfig = {
                      draft: { 
                        label: 'Draft', 
                        className: 'bg-muted text-muted-foreground border-muted' 
                      },
                      pending_tenant_signature: { 
                        label: 'Awaiting Tenant', 
                        className: 'bg-warning/10 text-warning border-warning' 
                      },
                      pending_manager_signature: { 
                        label: 'Ready for Your Signature', 
                        className: 'bg-primary/10 text-primary border-primary' 
                      },
                      completed: { 
                        label: 'Fully Signed', 
                        className: 'bg-success/10 text-success border-success' 
                      },
                      expired: { 
                        label: 'Expired', 
                        className: 'bg-muted text-muted-foreground border-muted' 
                      },
                    };
                    const config = statusConfig[lease.status as keyof typeof statusConfig] || statusConfig.draft;

                    const navigateToLease = () => {
                      // Keep existing behavior: clicking the card opens the sign/view page
                      navigate(`/sign-lease/${lease.id}`);
                    };

                    return (
                      <div key={lease.id} className="block">
                        <Card
                          role="button"
                          tabIndex={0}
                          onClick={navigateToLease}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigateToLease();
                            }
                          }}
                          className="p-6 hover:shadow-card transition-smooth cursor-pointer hover:border-primary/30"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-serif text-lg sm:text-xl mb-1 truncate">{lease.properties?.address}</h3>
                              <p className="text-muted-foreground text-sm truncate">Tenant: {lease.tenant?.full_name || lease.tenant?.email}</p>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-muted-foreground">
                                <span>{new Date(lease.start_date).toLocaleDateString()} - {new Date(lease.end_date).toLocaleDateString()}</span>
                                <span>${Number(lease.monthly_rent).toLocaleString()}/mo</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Badge 
                                variant="outline"
                                className={config.className}
                              >
                                {config.label}
                              </Badge>
                              
                              {lease.status === 'completed' && (() => {
                                const daysUntilEnd = differenceInDays(new Date(lease.end_date), new Date());
                                if (daysUntilEnd < 0) {
                                  return (
                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive">
                                      Expired
                                    </Badge>
                                  );
                                } else if (daysUntilEnd <= 7) {
                                  return (
                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive">
                                      {daysUntilEnd} days left
                                    </Badge>
                                  );
                                } else if (daysUntilEnd <= 30) {
                                  return (
                                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                                      {daysUntilEnd} days left
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              
                              {lease.status === 'pending_tenant_signature' && (
                                <Link to={`/sign-lease/${lease.id}`}>
                                  <Button size="sm" variant="outline">
                                    <Eye className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">View</span>
                                  </Button>
                                </Link>
                              )}
                              
                              {lease.status === 'pending_manager_signature' && (
                                <Link to={`/sign-lease/${lease.id}`}>
                                  <Button size="sm" className="btn-platinum">
                                    <PenTool className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Sign Now</span>
                                  </Button>
                                </Link>
                              )}
                              
                              {lease.status === 'completed' && (
                                <>
                                  <Link to={`/sign-lease/${lease.id}`}>
                                    <Button size="sm" variant="outline">
                                      <Eye className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">View</span>
                                    </Button>
                                  </Link>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLeaseForCert(lease);
                                    }}
                                  >
                                    <Shield className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Certificate</span>
                                  </Button>
                                </>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLeaseForEdit(lease);
                                  setIsEditLeaseOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Lease</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the lease for{' '}
                                      <strong>{lease.properties?.address}</strong>?
                                      <br /><br />
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        deleteLease.mutate(lease.id);
                                      }}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete Lease
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-12 text-center border-dashed">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-xl font-serif mb-2">No Leases</h3>
                  <p className="text-muted-foreground mb-4">Create your first lease for an approved applicant</p>
                  <Button onClick={() => setIsCreateLeaseOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Create Lease
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <h1 className="text-3xl font-serif">Messages</h1>
                <p className="text-muted-foreground">Communicate with your tenants</p>
              </div>

              <MessagingCenter />
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && <AnalyticsDashboard />}

          {/* Inquiries Tab */}
          {activeTab === 'inquiries' && <InquiriesTab managerId={user.id} />}

          {/* Audit Tab */}
          {activeTab === 'audit' && <AuditDashboard />}

          {/* Maintenance Tab */}
          {activeTab === 'maintenance' && <MaintenanceDashboard />}
          </div>
        </main>
      </div>

      {/* Add Property Dialog */}
      <Dialog open={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen}>
        <DialogContent className="max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-serif text-2xl">Add New Property</DialogTitle>
            <DialogDescription>Enter the property details below.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddProperty} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto pr-4">
              <div className="grid grid-cols-2 gap-4 pb-4">
                <div className="col-span-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input id="address" name="address" required placeholder="123 Main St" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" required placeholder="Los Angeles" />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" required placeholder="CA" />
                </div>
                <div>
                  <Label htmlFor="zip_code">ZIP Code</Label>
                  <Input id="zip_code" name="zip_code" required placeholder="90001" />
                </div>
                <div>
                  <Label htmlFor="rent_amount">Monthly Rent ($)</Label>
                  <Input id="rent_amount" name="rent_amount" type="number" required placeholder="2500" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="square_feet">Square Feet (optional)</Label>
                  <Input id="square_feet" name="square_feet" type="number" placeholder="5000" />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Modern commercial space with excellent visibility..."
                  />
                </div>
                <div className="col-span-2">
                  <Label>Property Photos (up to {maxImages})</Label>
                  <ImageUploader
                    images={propertyImages}
                    onImagesChange={handleImagesChange}
                    onFilesSelect={handleFilesSelect}
                    maxImages={maxImages}
                    uploading={uploading}
                  />
                </div>
              </div>
            </div>

            <div className="flex-shrink-0 pt-4 border-t border-border mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPropertyImages([]);
                  setPendingImageFiles([]);
                  setIsAddPropertyOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProperty.isPending || uploading}>
                {createProperty.isPending || uploading ? 'Adding...' : 'Add Property'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Property Dialog */}
      <EditPropertyDialog
        property={editingProperty}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSaveProperty}
        saving={updateProperty.isPending}
      />

      {/* Create Lease Wizard */}
      <CreateLeaseWizard
        open={isCreateLeaseOpen}
        onOpenChange={setIsCreateLeaseOpen}
        properties={properties || []}
        managerId={user?.id || ''}
        managerName={managerProfile?.full_name || managerProfile?.email || ''}
        managerEmail={managerProfile?.email || ''}
      />

      {/* Lease Certificate Dialog */}
      <Dialog open={!!selectedLeaseForCert} onOpenChange={() => setSelectedLeaseForCert(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Document Certificate</DialogTitle>
          </DialogHeader>
          {selectedLeaseForCert && (
            <AuditCertificate
              leaseId={selectedLeaseForCert.id}
              documentHash={selectedLeaseForCert.document_hash}
              createdAt={selectedLeaseForCert.created_at}
              signatures={selectedLeaseForCert.signatures || []}
              signerNames={{
                [selectedLeaseForCert.tenant_id]: selectedLeaseForCert.tenant?.full_name || selectedLeaseForCert.tenant?.email || 'Tenant',
                [selectedLeaseForCert.manager_id]: managerProfile?.full_name || managerProfile?.email || 'Manager',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Tenant Dialog */}
      <AddTenantDialog
        open={isAddTenantOpen}
        onOpenChange={setIsAddTenantOpen}
        existingTenantUserIds={tenants?.map((t: any) => t.user_id) || []}
        managerId={user.id}
      />

      {/* Tenant Details Dialog */}
      <TenantDetailsDialog
        tenant={selectedTenant}
        open={isTenantDetailsOpen}
        onOpenChange={setIsTenantDetailsOpen}
        properties={properties || []}
      />

      {/* Application Details Dialog */}
      <ApplicationDetailsDialog
        application={selectedApplication}
        open={isApplicationDetailsOpen}
        onOpenChange={setIsApplicationDetailsOpen}
        onApprove={handleApproveApplication}
        onReject={handleRejectApplication}
      />

      {/* Edit Lease Dialog */}
      <EditLeaseDialog
        open={isEditLeaseOpen}
        onOpenChange={setIsEditLeaseOpen}
        lease={selectedLeaseForEdit}
      />
    </div>
  );
}
