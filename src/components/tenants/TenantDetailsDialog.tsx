import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useUpdateTenant, useDeleteTenant, useRevokeTenantAccess } from '@/hooks/useTenants';
import { useAuth } from '@/contexts/AuthContext';
import { BalanceSection } from './BalanceSection';
import { AutomationSettings } from './AutomationSettings';
import { RentChargeHistory } from './RentChargeHistory';
import { QuickRentActions } from './QuickRentActions';
import { TenantPropertiesSection } from './TenantPropertiesSection';
import { Users, Mail, Phone, FileText, Shield, Trash2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];

interface TenantWithRelations {
  id: string;
  user_id: string;
  property_id: string | null;
  rent_amount: number | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  notes: string | null;
  is_active: boolean;
  manager_id: string | null;
  current_balance: number | null;
  auto_charge_rent?: boolean;
  auto_apply_late_fees?: boolean;
  user?: {
    id: string;
    email: string | null;
    full_name: string | null;
    phone?: string | null;
  } | null;
  property?: {
    id: string;
    address: string;
    city: string | null;
    state: string | null;
  } | null;
}

interface TenantDetailsDialogProps {
  tenant: TenantWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
}

export function TenantDetailsDialog({ tenant, open, onOpenChange, properties }: TenantDetailsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentBalance, setCurrentBalance] = useState(tenant?.current_balance || 0);
  const [automationSettings, setAutomationSettings] = useState({
    autoChargeRent: tenant?.auto_charge_rent ?? true,
    autoApplyLateFees: tenant?.auto_apply_late_fees ?? true,
  });
  const [editedTenant, setEditedTenant] = useState<{
    notes: string | null;
  }>({
    notes: (tenant as any)?.notes || null,
  });

  // Fetch active lease for this tenant's user to get late fee config
  const { data: activeLease } = useQuery({
    queryKey: ['tenant-lease', tenant?.user_id],
    queryFn: async () => {
      if (!tenant?.user_id) return null;
      
      const { data, error } = await supabase
        .from('leases')
        .select('*')
        .eq('tenant_id', tenant.user_id)
        .in('status', ['completed', 'pending_manager_signature', 'pending_tenant_signature'])
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.user_id && open,
  });

  const leaseInfo = activeLease ? {
    rentDueDay: activeLease.rent_due_day || 1,
    gracePeriodDays: activeLease.grace_period_days || 5,
    lateFeeType: activeLease.late_fee_type || 'percentage',
    lateFeePercentage: activeLease.late_fee_percentage || 5,
    lateFeeFlatAmount: activeLease.late_fee_flat_amount || 0,
    lateFeeDailyAmount: activeLease.late_fee_daily_amount || 0,
    lateFeeMaxAmount: activeLease.late_fee_max_amount || undefined,
  } : null;

  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();
  const revokeAccess = useRevokeTenantAccess();

  // Sync balance when tenant changes
  useEffect(() => {
    if (tenant) {
      setCurrentBalance(tenant.current_balance || 0);
    }
  }, [tenant?.id, tenant?.current_balance]);

  // Handle balance update - update local state immediately with new balance from RPC
  const handleBalanceUpdate = (newBalance: number) => {
    setCurrentBalance(newBalance);
    // Invalidate tenants query for parent refresh
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
  };

  // Reset form when tenant changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && tenant) {
      setEditedTenant({
        notes: (tenant as any)?.notes || null,
      });
      setAutomationSettings({
        autoChargeRent: tenant.auto_charge_rent ?? true,
        autoApplyLateFees: tenant.auto_apply_late_fees ?? true,
      });
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!tenant) return;
    
    await updateTenant.mutateAsync({
      id: tenant.id,
      notes: editedTenant.notes,
    });
    
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!tenant) return;
    await deleteTenant.mutateAsync(tenant.id);
    onOpenChange(false);
  };

  const handleRevokeAccess = async () => {
    if (!tenant) return;
    await revokeAccess.mutateAsync(tenant.user_id);
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5 text-accent" />
            </div>
            {tenant.user?.full_name || 'Unnamed Tenant'}
          </DialogTitle>
          <DialogDescription>
            View and manage tenant details, property assignment, and portal access.
          </DialogDescription>
        </DialogHeader>

        {/* Contact Info (Read-only) */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{tenant.user?.email}</span>
          </div>
          {tenant.user?.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{tenant.user.phone}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Multi-Property Assignment Section */}
        <TenantPropertiesSection tenantId={tenant.id} properties={properties} />

        <Separator />

        {/* Notes */}
        <div>
          <Label htmlFor="notes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Notes
          </Label>
          <Textarea
            id="notes"
            value={editedTenant.notes || ''}
            onChange={(e) => setEditedTenant(prev => ({ ...prev, notes: e.target.value || null }))}
            placeholder="Add notes about this tenant..."
            className="mt-1.5 min-h-[100px]"
          />
        </div>

        <Separator />

        {/* Balance Section */}
        {user && tenant.manager_id && (
          <BalanceSection
            tenantId={tenant.id}
            currentBalance={currentBalance}
            rentAmount={tenant.rent_amount}
            leaseStartDate={tenant.lease_start_date}
            managerId={user.id}
            onBalanceUpdate={handleBalanceUpdate}
          />
        )}

        {/* Quick Rent Actions */}
        {user && tenant.manager_id && (
          <QuickRentActions
            tenantId={tenant.id}
            managerId={user.id}
            rentAmount={tenant.rent_amount}
          />
        )}

        {/* Rent Charge History */}
        {user && tenant.manager_id && (
          <RentChargeHistory
            tenantId={tenant.id}
            managerId={user.id}
          />
        )}

        {/* Automation Settings */}
        {user && tenant.manager_id && (
          <AutomationSettings
            tenantId={tenant.id}
            autoChargeRent={automationSettings.autoChargeRent}
            autoApplyLateFees={automationSettings.autoApplyLateFees}
            leaseInfo={leaseInfo}
            onSettingsChange={setAutomationSettings}
          />
        )}

        <Separator />

        {/* Access & Status Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Access & Status</h4>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 rounded-lg p-4">
            <div>
              <p className="font-medium">Tenant Portal Access</p>
              <p className="text-sm text-muted-foreground">
                Revoke access to prevent tenant from logging into the portal
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-warning border-warning hover:bg-warning/10 whitespace-nowrap flex-shrink-0 w-full sm:w-auto">
                  <Shield className="h-4 w-4 mr-2 flex-shrink-0" /> 
                  <span>Revoke Access</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke Portal Access?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the tenant role from {tenant.user?.full_name || 'this user'}. 
                    They will no longer be able to access the tenant portal, view lease documents, 
                    or send messages through the system.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleRevokeAccess}
                    className="bg-warning text-warning-foreground hover:bg-warning/90"
                  >
                    Revoke Access
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Separator />

        {/* Danger Zone */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-destructive/30 rounded-lg p-4">
            <div>
              <p className="font-medium">Delete Tenant</p>
              <p className="text-sm text-muted-foreground">
                Remove this tenant from your records (can be restored later)
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Tenant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will deactivate the tenant record for {tenant.user?.full_name || 'this user'}. 
                    The tenant will be removed from your active tenants list. This action can be undone 
                    by contacting support.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Tenant
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateTenant.isPending}
          >
            <Save className="h-4 w-4 mr-2" /> 
            {updateTenant.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
