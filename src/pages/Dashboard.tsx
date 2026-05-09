import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerProperties, useCreateProperty, useUpdateProperty, useDeleteProperty } from '@/hooks/useProperties';
import { useApplications, useUpdateApplication } from '@/hooks/useApplications';
import { ApplicationDetailsDialog } from '@/components/applications/ApplicationDetailsDialog';
import { useTenants, useAddTenant, useUpdateTenant, useDeleteTenant, useRevokeTenantAccess, useHardDeleteTenant } from '@/hooks/useTenants';
import { useAllPayments } from '@/hooks/usePayments';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { OverdueRentAlert } from '@/components/notifications/OverdueRentAlert';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { ImageUploader } from '@/components/properties/ImageUploader';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { EditPropertyDialog } from '@/components/properties/EditPropertyDialog';
import { CreateLeaseWizard } from '@/components/leases/CreateLeaseWizard';
import { EditLeaseDialog } from '@/components/leases/EditLeaseDialog';
import { AuditCertificate } from '@/components/leases/AuditCertificate';
import { AdminCommandCenter } from '@/components/admin/AdminCommandCenter';
import { AdminGlobalSearch } from '@/components/admin/AdminGlobalSearch';
import { AdminButton, AdminStatusBadge, EmptyState, FilterTabs, PageHeader, StatCard } from '@/components/admin/AdminDesignSystem';
import type {
  AdminDashboardTab,
  AdminNavigationOptions,
  ApplicationRecord,
  LeaseRecord,
  PaymentControlFilter,
  TenantHealthFilter,
  TenantRecord,
} from '@/components/admin/adminTypes';
import type { Database } from '@/integrations/supabase/types';
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
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Trash2,
  Edit,
  BarChart3,
  Receipt,
  PenTool,
  Shield,
  Menu,
  HelpCircle,
  Wrench
} from 'lucide-react';
import logo from '@/assets/logo.png';

type DashboardTab = AdminDashboardTab;
type Property = Database['public']['Tables']['properties']['Row'];
type PropertyStatusFilter = 'all' | 'occupied' | 'available' | 'off_market';
type PropertySortMode = 'newest' | 'rent-high' | 'rent-low' | 'address';

function formatAdminCurrency(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  const hasCents = Math.abs(amount % 1) > 0.001;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}

const AnalyticsDashboard = lazy(() =>
  import('@/components/analytics/AnalyticsDashboard').then((module) => ({ default: module.AnalyticsDashboard }))
);
const AuditDashboard = lazy(() =>
  import('@/components/audit/AuditDashboard').then((module) => ({ default: module.AuditDashboard }))
);
const MessagingCenter = lazy(() =>
  import('@/components/messages/MessagingCenter').then((module) => ({ default: module.MessagingCenter }))
);
const InquiriesTab = lazy(() =>
  import('@/components/inquiries/InquiriesTab').then((module) => ({ default: module.InquiriesTab }))
);
const MaintenanceDashboard = lazy(() =>
  import('@/components/maintenance/MaintenanceDashboard').then((module) => ({ default: module.MaintenanceDashboard }))
);

function DashboardTabFallback({ label }: { label: string }) {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">
      Loading {label}...
    </Card>
  );
}

export default function Dashboard() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [paymentQuickFilter, setPaymentQuickFilter] = useState<PaymentControlFilter>('all');
  const [tenantHealthFilter, setTenantHealthFilter] = useState<TenantHealthFilter>('all');
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isCreateLeaseOpen, setIsCreateLeaseOpen] = useState(false);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [isTenantDetailsOpen, setIsTenantDetailsOpen] = useState(false);
  const [propertyImages, setPropertyImages] = useState<string[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLeaseForCert, setSelectedLeaseForCert] = useState<LeaseRecord | null>(null);
  const [selectedLeaseForEdit, setSelectedLeaseForEdit] = useState<LeaseRecord | null>(null);
  const [isEditLeaseOpen, setIsEditLeaseOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRecord | null>(null);
  const [isApplicationDetailsOpen, setIsApplicationDetailsOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<PropertyStatusFilter>('all');
  const [propertySortMode, setPropertySortMode] = useState<PropertySortMode>('newest');

  const isMobile = useIsMobile();

  const queryClient = useQueryClient();
  const { data: properties, isLoading: propertiesLoading } = useManagerProperties(user?.id);
  const { data: applications, isLoading: applicationsLoading, isError: applicationsError, refetch: refetchApplications } = useApplications();
  const { data: tenants, isLoading: tenantsLoading } = useTenants(user?.id);
  const { data: leases, isLoading: leasesLoading } = useLeases(user?.id, role);
  const { data: allPayments = [] } = useAllPayments();
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

  // Handle tab navigation from URL query params. The URL remains the source of truth for reloads.
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'properties', 'applications', 'tenants', 'leases', 'messages', 'inquiries', 'analytics', 'audit', 'maintenance'].includes(tabParam)) {
      setActiveTab(tabParam as DashboardTab);
    } else if (!tabParam) {
      setActiveTab('overview');
    }
  }, [searchParams]);

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
      const freshTenant = tenants.find((t: TenantRecord) => t.id === selectedTenant.id);
      if (freshTenant && JSON.stringify(freshTenant) !== JSON.stringify(selectedTenant)) {
        setSelectedTenant(freshTenant);
      }
    }
  }, [tenants, selectedTenant]);

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

  // Safety timeout for loading state
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (loading || (user && role === null)) {
      const timer = setTimeout(() => setLoadingTimedOut(true), 10000);
      return () => clearTimeout(timer);
    }
    setLoadingTimedOut(false);
  }, [loading, user, role]);

  const propertySummary = useMemo(() => {
    const list = properties || [];
    return {
      total: list.length,
      occupied: list.filter((property) => property.status === 'occupied').length,
      available: list.filter((property) => property.status === 'available').length,
      rentRoll: list.reduce((sum, property) => sum + Number(property.rent_amount || 0), 0),
    };
  }, [properties]);

  const visibleProperties = useMemo(() => {
    const normalizedQuery = propertySearch.trim().toLowerCase();
    return [...(properties || [])]
      .filter((property) => propertyStatusFilter === 'all' || property.status === propertyStatusFilter)
      .filter((property) => {
        if (!normalizedQuery) return true;
        return [property.address, property.city, property.state, property.zip_code, property.property_type]
          .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (propertySortMode === 'rent-high') return Number(b.rent_amount || 0) - Number(a.rent_amount || 0);
        if (propertySortMode === 'rent-low') return Number(a.rent_amount || 0) - Number(b.rent_amount || 0);
        if (propertySortMode === 'address') return a.address.localeCompare(b.address);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [properties, propertySearch, propertySortMode, propertyStatusFilter]);

  // Wait for both auth and role to be fully loaded before redirecting

  if (loading || (user && role === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {loadingTimedOut ? (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Something took longer than expected.</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : (
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        )}
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

  const managerDisplayName = managerProfile?.full_name || managerProfile?.email || user.email || 'Property Manager';
  const managerEmail = managerProfile?.email || user.email || '';
  const managerInitials = managerDisplayName
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SG';

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

  const handleNavigateTab = (tab: DashboardTab, options?: AdminNavigationOptions) => {
    if (options?.paymentFilter) {
      setPaymentQuickFilter(options.paymentFilter);
    }
    if (options?.tenantFilter) {
      setTenantHealthFilter(options.tenantFilter);
    }
    setActiveTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab });
    setIsMobileMenuOpen(false);
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
      <Link
        to="/"
        className="mb-7 flex h-20 w-full items-center justify-center rounded-xl border border-sidebar-border/80 bg-black/20 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      >
        <img src={logo} alt="Sterling Gate Properties" className="h-16 w-auto scale-150 object-contain" />
      </Link>
      
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              handleNavigateTab(item.id as DashboardTab);
              onNavClick?.();
            }}
            className={`group flex min-h-[40px] w-full items-center justify-between overflow-hidden rounded-lg border px-3 py-2 text-left text-[13px] transition-all ${
              activeTab === item.id
                ? 'ops-active-nav border-primary/45 text-primary'
                : 'border-transparent text-sidebar-foreground/68 hover:border-sidebar-border/70 hover:bg-sidebar-accent/25 hover:text-sidebar-foreground'
            }`}
          >
            <span className="flex min-w-0 items-center gap-3 truncate">
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{item.label}</span>
            </span>
            {item.badge && item.badge > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 shrink-0 rounded-full border border-primary/25 bg-primary/15 px-1.5 text-[10px] text-primary">
                {item.badge}
              </Badge>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-5 border-t border-sidebar-border/70 pt-4">
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border/80 bg-black/20 p-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/15 text-xs font-bold text-primary">
            {managerInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">{managerDisplayName}</p>
            <p className="truncate text-[10px] text-sidebar-foreground/55">{managerEmail || 'Property Manager'}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            className="h-8 w-8 shrink-0 rounded-lg text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-primary"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen ops-shell p-0 md:p-3">
      <div className="flex min-h-screen w-full gap-3 md:min-h-[calc(100vh-1.5rem)] md:rounded-2xl md:border md:border-border/70 md:bg-background/25 md:p-2 md:shadow-[0_30px_100px_-60px_rgba(0,0,0,0.95)]">
        {/* Mobile Sidebar Sheet */}
        {isMobile && (
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetContent side="left" className="flex w-72 flex-col border-sidebar-border bg-sidebar p-3">
              <SheetHeader className="sr-only">
                <SheetTitle>Admin navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent onNavClick={() => setIsMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        )}

        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside className="sticky top-5 flex h-[calc(100vh-2.5rem)] w-[190px] flex-shrink-0 flex-col rounded-xl border border-sidebar-border/85 bg-sidebar/95 p-2 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.9)]">
            <SidebarContent />
          </aside>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 overflow-auto overscroll-contain">
          {/* Top Header Bar */}
          <div className="sticky top-0 z-10 border-b border-border/35 bg-background px-3 py-3 md:px-5">
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
              <div className="hidden min-w-[170px] lg:block" />
              <div className="flex min-w-0 flex-1 justify-center">
                <AdminGlobalSearch
                  properties={properties || []}
                  tenants={tenants || []}
                  applications={applications || []}
                  leases={leases || []}
                  payments={allPayments}
                  onNavigateTab={handleNavigateTab}
                  onOpenTenant={(tenantId) => navigate(`/dashboard/tenant/${tenantId}`)}
                />
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <OverdueRentAlert managerId={user?.id} />
                <PwaInstallPrompt />
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

          <div className="relative z-20 overflow-visible p-3 pt-4 md:p-5">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <AdminCommandCenter
              managerId={user.id}
              managerName={managerDisplayName}
              properties={properties || []}
              applications={applications || []}
              tenants={tenants || []}
              leases={leases || []}
              payments={allPayments}
              unreadMessages={unreadCount || 0}
              unreadInquiries={unreadInquiriesCount || 0}
              paymentNotifications={unreadPaymentCount || 0}
              onNavigateTab={handleNavigateTab}
              onAddProperty={() => setIsAddPropertyOpen(true)}
              onAddTenant={() => setIsAddTenantOpen(true)}
              onCreateLease={() => setIsCreateLeaseOpen(true)}
              onOpenTenant={(tenantId) => navigate(`/dashboard/tenant/${tenantId}`)}
            />
          )}

          {/* Properties Tab */}
          {activeTab === 'properties' && (
            <div className="space-y-4 animate-fade-in">
              <PageHeader
                title="Properties"
                subtitle="Manage rental properties, units, occupancy, and portfolio performance."
                actions={<AdminButton onClick={() => setIsAddPropertyOpen(true)}>Add Property</AdminButton>}
              />

              <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard label="Total properties" value={propertySummary.total} detail="Portfolio records" tone="gold" />
                <StatCard label="Occupied units" value={propertySummary.occupied} detail={`${propertySummary.total ? Math.round((propertySummary.occupied / propertySummary.total) * 100) : 0}% occupied`} tone="success" />
                <StatCard label="Available units" value={propertySummary.available} detail="Ready or needs leasing" tone="warning" />
                <StatCard label="Monthly rent roll" value={formatAdminCurrency(propertySummary.rentRoll)} detail="Configured monthly rent" tone="teal" />
              </section>

              <section className="ops-panel p-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <FilterTabs
                    value={propertyStatusFilter}
                    onChange={setPropertyStatusFilter}
                    items={[
                      { id: 'all', label: 'All', count: propertySummary.total },
                      { id: 'occupied', label: 'Occupied', count: propertySummary.occupied },
                      { id: 'available', label: 'Available', count: propertySummary.available },
                      { id: 'off_market', label: 'Setup Needed', count: (properties || []).filter((property) => property.status === 'off_market').length },
                    ]}
                  />
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Input
                      value={propertySearch}
                      onChange={(event) => setPropertySearch(event.target.value)}
                      placeholder="Search properties..."
                      className="h-9 w-full rounded-md border-border/70 bg-card text-xs sm:min-w-[260px]"
                    />
                    <select
                      value={propertySortMode}
                      onChange={(event) => setPropertySortMode(event.target.value as PropertySortMode)}
                      className="h-9 w-full rounded-md border border-border/70 bg-card px-3 text-xs text-muted-foreground outline-none sm:w-auto"
                    >
                      <option value="newest">Sort: Newest</option>
                      <option value="address">Sort: Address</option>
                      <option value="rent-high">Sort: Rent high</option>
                      <option value="rent-low">Sort: Rent low</option>
                    </select>
                  </div>
                </div>
              </section>

              {propertiesLoading ? (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <div className="h-32 bg-muted" />
                      <CardContent className="p-4">
                        <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : properties && properties.length > 0 && visibleProperties.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {visibleProperties.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onEdit={handleEditProperty}
                      onDelete={handleDeleteProperty}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              ) : properties && properties.length > 0 ? (
                <EmptyState
                  title="No properties match this view"
                  description="Adjust the search or filter tabs to bring properties back into view."
                />
              ) : (
                <EmptyState
                  title="No properties yet"
                  description="Add the first property to start building the portfolio operations view."
                  action={<AdminButton onClick={() => setIsAddPropertyOpen(true)}>Add Property</AdminButton>}
                />
              )}
            </div>
          )}

          {/* Applications Tab */}
          {activeTab === 'applications' && (
            <div className="space-y-4 animate-fade-in">
              <PageHeader
                title="Applications"
                subtitle="Review applicant status, missing information, and leasing decisions."
                actions={<AdminButton onClick={() => handleNavigateTab('applications')}>Review Queue</AdminButton>}
              />

              <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard label="Pending review" value={applications?.filter((app) => ['pending', 'under_review'].includes(app.status)).length || 0} detail="Needs manager attention" tone="warning" />
                <StatCard label="Approved" value={applications?.filter((app) => app.status === 'approved').length || 0} detail="Ready for leasing" tone="success" />
                <StatCard label="Denied" value={applications?.filter((app) => app.status === 'rejected').length || 0} detail="Closed applications" tone="danger" />
                <StatCard label="Total applications" value={applications?.length || 0} detail="All-time application records" tone="gold" />
              </section>

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
                  {applications.map((app: ApplicationRecord) => (
                    <Card 
                      key={app.id} 
                      className="cursor-pointer p-4 transition-colors hover:border-primary/35"
                      onClick={() => {
                        setSelectedApplication(app);
                        setIsApplicationDetailsOpen(true);
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold">{app.profiles?.full_name || 'Applicant'}</h3>
                            <Badge 
                              variant="outline"
                              className={
                                app.status === 'approved' ? 'border-success/30 bg-success/10 text-success' :
                                app.status === 'rejected' ? 'border-destructive/30 bg-destructive/10 text-destructive' :
                                'border-warning/30 bg-warning/10 text-warning'
                              }
                            >
                              {app.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-1 text-sm truncate">
                            {app.properties?.address}, {app.properties?.city}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Applied: {new Date(app.created_at).toLocaleDateString()}
                          </p>
                          {app.background_check_consent && (
                          <Badge variant="secondary" className="mt-2">
                              Background check consent given
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
                              Reject
                            </Button>
                            <Button 
                              size="sm"
                              className="flex-1 border border-primary/35 bg-primary/15 text-primary hover:bg-primary/25 sm:flex-initial"
                              onClick={() => handleApproveApplication(app.id)}
                            >
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState title="No applications" description="Applications will appear here when tenants apply to your properties." />
              )}
            </div>
          )}

          {/* Tenants Tab */}
          {activeTab === 'tenants' && (
            <div className="animate-fade-in">
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
                  payments={allPayments}
                  healthFilter={tenantHealthFilter}
                  onHealthFilterChange={setTenantHealthFilter}
                  onNavigate={(tenantId) => navigate(`/dashboard/tenant/${tenantId}`)} 
                  onAddTenant={() => setIsAddTenantOpen(true)}
                />
              ) : (
                <EmptyState
                  title="No tenants yet"
                  description="Add your first tenant or approve applicants to start managing the rent ledger."
                  action={<AdminButton onClick={() => setIsAddTenantOpen(true)}>Add Tenant</AdminButton>}
                />
              )}
            </div>
          )}

          {/* Leases Tab */}
          {activeTab === 'leases' && (
            <div className="space-y-4 animate-fade-in">
              <PageHeader
                title="Leases"
                subtitle="Track active terms, renewal windows, pending signatures, and rent obligations."
                actions={<AdminButton onClick={() => setIsCreateLeaseOpen(true)}>Create Lease</AdminButton>}
              />

              <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard label="Active leases" value={leases?.filter((lease) => lease.status === 'completed').length || 0} detail="Fully signed lease records" tone="success" />
                <StatCard label="Expiring soon" value={leases?.filter((lease) => lease.status === 'completed' && differenceInDays(new Date(lease.end_date), new Date()) <= 60).length || 0} detail="Next 60 days" tone="warning" />
                <StatCard label="Pending signatures" value={leases?.filter((lease) => lease.status.includes('pending')).length || 0} detail="Tenant or manager action" tone="gold" />
                <StatCard label="Monthly rent" value={formatAdminCurrency((leases || []).filter((lease) => lease.status === 'completed').reduce((sum, lease) => sum + Number(lease.monthly_rent || 0), 0))} detail="Active lease rent roll" tone="teal" />
              </section>

              {leasesLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Card key={i} className="p-4 animate-pulse">
                      <div className="h-24 bg-muted rounded" />
                    </Card>
                  ))}
                </div>
              ) : leases && leases.length > 0 ? (
                <div className="ops-panel overflow-hidden">
                  <div className="mobile-scroll-x overflow-x-auto">
                    <Table className="min-w-[980px]">
                      <TableHeader>
                        <TableRow className="border-border/60 bg-muted/15 hover:bg-muted/15">
                          <TableHead>Tenant</TableHead>
                          <TableHead>Property</TableHead>
                          <TableHead>Term</TableHead>
                          <TableHead>Rent</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Renewal Window</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                  {leases.map((lease: LeaseRecord) => {
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
                    const daysUntilEnd = differenceInDays(new Date(lease.end_date), new Date());
                    const statusTone =
                      lease.status === 'completed'
                        ? 'success'
                        : lease.status.includes('pending')
                          ? 'warning'
                          : lease.status === 'expired'
                            ? 'danger'
                            : 'neutral';

                    const navigateToLease = () => {
                      // Keep existing behavior: clicking the card opens the sign/view page
                      navigate(`/sign-lease/${lease.id}`);
                    };

                    return (
                      <TableRow key={lease.id} className="cursor-pointer border-border/45 hover:bg-muted/20" onClick={navigateToLease}>
                        <TableCell>
                          <div className="font-medium">{lease.tenant?.full_name || lease.tenant?.email || 'Unassigned'}</div>
                          <div className="text-xs text-muted-foreground">{lease.tenant?.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[260px] truncate">{lease.properties?.address || 'No property'}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(lease.start_date).toLocaleDateString()} - {new Date(lease.end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">{formatAdminCurrency(Number(lease.monthly_rent || 0))}/mo</TableCell>
                        <TableCell>
                          <AdminStatusBadge tone={statusTone as 'success' | 'warning' | 'danger' | 'neutral'}>{config.label}</AdminStatusBadge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lease.status === 'completed'
                            ? daysUntilEnd < 0
                              ? 'Expired'
                              : daysUntilEnd <= 60
                                ? `${daysUntilEnd} days left`
                                : 'Not in window'
                            : 'Signature pending'}
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Link to={`/sign-lease/${lease.id}`}>
                              <Button size="sm" variant="outline" className="h-8 border-border/70 bg-card text-xs">View</Button>
                            </Link>
                            {lease.status === 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-border/70 bg-card text-xs"
                                onClick={() => setSelectedLeaseForCert(lease)}
                              >
                                Certificate
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-border/70 bg-card text-xs"
                              onClick={() => {
                                setSelectedLeaseForEdit(lease);
                                setIsEditLeaseOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="h-8 border-border/70 bg-card text-xs text-muted-foreground hover:text-destructive">
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Lease</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the lease for <strong>{lease.properties?.address}</strong>? This action cannot be undone.
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No leases"
                  description="Create the first lease for an approved applicant."
                  action={<AdminButton onClick={() => setIsCreateLeaseOpen(true)}>Create Lease</AdminButton>}
                />
              )}
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="space-y-4 animate-fade-in">
              <PageHeader title="Messages" subtitle="Communicate with tenants and keep operational context in one place." />

              <Suspense fallback={<DashboardTabFallback label="messages" />}>
                <MessagingCenter />
              </Suspense>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <Suspense fallback={<DashboardTabFallback label="analytics" />}>
              <AnalyticsDashboard />
            </Suspense>
          )}

          {/* Inquiries Tab */}
          {activeTab === 'inquiries' && (
            <Suspense fallback={<DashboardTabFallback label="inquiries" />}>
              <InquiriesTab managerId={user.id} />
            </Suspense>
          )}

          {/* Audit Tab */}
          {activeTab === 'audit' && (
            <Suspense fallback={<DashboardTabFallback label="payments" />}>
              <AuditDashboard
                quickFilter={paymentQuickFilter}
                onQuickFilterChange={setPaymentQuickFilter}
              />
            </Suspense>
          )}

          {/* Maintenance Tab */}
          {activeTab === 'maintenance' && (
            <Suspense fallback={<DashboardTabFallback label="maintenance" />}>
              <MaintenanceDashboard />
            </Suspense>
          )}
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
        existingTenantUserIds={tenants?.map((tenant: TenantRecord) => tenant.user_id) || []}
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
