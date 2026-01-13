import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, User, Building2, Wallet, History, Mail, Phone } from 'lucide-react';
import { TenantOverviewTab } from '@/components/tenants/TenantOverviewTab';
import { TenantPropertiesTab } from '@/components/tenants/TenantPropertiesTab';
import { TenantBalanceTab } from '@/components/tenants/TenantBalanceTab';
import { TenantHistoryTab } from '@/components/tenants/TenantHistoryTab';

export default function TenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Initialize activeTab from URL query param
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'properties', 'balance', 'history'].includes(tabParam)) {
      return tabParam;
    }
    return 'overview';
  });

  // Clear the query param after reading it for cleaner URLs
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Fetch tenant with profile and property info
  const { data: tenant, isLoading, refetch } = useQuery({
    queryKey: ['tenant-detail', tenantId],
    queryFn: async () => {
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
      return data;
    },
    enabled: !!tenantId,
  });

  // Realtime subscription for tenant updates
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`tenant-detail-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenantId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, refetch]);

  // Realtime subscription for balance adjustments
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`tenant-balance-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'balance_adjustments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['balance-adjustments', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, refetch, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading tenant...</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Tenant not found</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const currentBalance = tenant.current_balance ?? 0;
  const isOverdue = currentBalance > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/dashboard?tab=tenants')}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tenants
          </Button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-primary/30 shadow-lg shadow-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-serif">
                  {tenant.user?.full_name || 'Unnamed Tenant'}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm mt-1">
                  {tenant.user?.email && (
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="text-muted-foreground">{tenant.user.email}</span>
                    </span>
                  )}
                  {tenant.user?.phone && (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="text-muted-foreground">{tenant.user.phone}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-success/10 text-success border border-success/20 shadow-sm shadow-success/10">
                Active
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="shadow-sm shadow-destructive/20 animate-pulse">
                  Balance Due: ${currentBalance.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Properties</span>
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="animate-fade-in">
            <TenantOverviewTab tenant={tenant} onUpdate={refetch} />
          </TabsContent>

          <TabsContent value="properties" className="animate-fade-in">
            <TenantPropertiesTab tenantId={tenant.id} managerId={user?.id} />
          </TabsContent>

          <TabsContent value="balance" className="animate-fade-in">
            <TenantBalanceTab tenant={tenant} onUpdate={refetch} />
          </TabsContent>

          <TabsContent value="history" className="animate-fade-in">
            <TenantHistoryTab tenantId={tenant.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
