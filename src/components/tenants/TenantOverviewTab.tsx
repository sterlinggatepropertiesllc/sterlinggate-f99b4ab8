import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Save, Trash2, ShieldX, Calendar, Mail, Phone, User, AlertTriangle } from 'lucide-react';
import { useUpdateTenant, useDeleteTenant, useRevokeTenantAccess } from '@/hooks/useTenants';
import { AutomationSettings } from './AutomationSettings';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface TenantOverviewTabProps {
  tenant: any;
  onUpdate: () => void;
}

export function TenantOverviewTab({ tenant, onUpdate }: TenantOverviewTabProps) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState(tenant.notes || '');
  const [hasChanges, setHasChanges] = useState(false);

  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();
  const revokeAccess = useRevokeTenantAccess();

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(value !== (tenant.notes || ''));
  };

  const handleSaveNotes = async () => {
    try {
      await updateTenant.mutateAsync({ id: tenant.id, notes });
      setHasChanges(false);
      onUpdate();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTenant.mutateAsync(tenant.id);
      toast.success('Tenant removed');
      navigate('/dashboard?tab=tenants');
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleRevokeAccess = async () => {
    if (!tenant.user_id) return;
    try {
      await revokeAccess.mutateAsync(tenant.user_id);
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
          <CardDescription>Tenant's profile information from their account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border-l-4 border-l-primary hover:from-primary/15 transition-colors">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Full Name</p>
                <p className="font-medium text-foreground truncate">{tenant.user?.full_name || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-transparent border-l-4 border-l-blue-500 hover:from-blue-500/15 transition-colors overflow-hidden">
              <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="font-medium text-foreground truncate">{tenant.user?.email || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-transparent border-l-4 border-l-emerald-500 hover:from-emerald-500/15 transition-colors overflow-hidden">
              <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                <Phone className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Phone</p>
                <p className="font-medium text-foreground truncate">{tenant.user?.phone || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Lease Period from tenant record */}
          {tenant.lease_start_date && tenant.lease_end_date && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-transparent border-l-4 border-l-amber-500 hover:from-amber-500/15 transition-colors">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Calendar className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Lease Period (Primary)</p>
                <p className="font-medium text-foreground">
                  {new Date(tenant.lease_start_date).toLocaleDateString()} — {new Date(tenant.lease_end_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
          <CardDescription>Private notes about this tenant (only visible to you)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes about this tenant..."
              className="min-h-[120px]"
            />
          </div>
          {hasChanges && (
            <Button onClick={handleSaveNotes} disabled={updateTenant.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateTenant.isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Automation Settings</CardTitle>
          <CardDescription>Configure automatic rent charging and late fees for this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          <AutomationSettings
            tenantId={tenant.id}
            autoChargeRent={tenant.auto_charge_rent ?? false}
            autoApplyLateFees={tenant.auto_apply_late_fees ?? false}
            onSettingsChange={() => onUpdate()}
          />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions that affect this tenant's access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-warning/30 bg-gradient-to-r from-warning/5 to-transparent">
            <div>
              <p className="font-medium text-foreground">Revoke Portal Access</p>
              <p className="text-sm text-muted-foreground">Remove tenant's ability to access the tenant portal</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-warning hover:text-warning">
                  <ShieldX className="mr-2 h-4 w-4" />
                  Revoke Access
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke Portal Access?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove {tenant.user?.full_name || 'this tenant'}'s ability to access the tenant portal.
                    They will no longer be able to view leases, make payments, or send messages.
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

          <Separator />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-destructive/30">
            <div>
              <p className="font-medium">Remove Tenant</p>
              <p className="text-sm text-muted-foreground">Permanently remove this tenant from your account</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Tenant
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Tenant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove {tenant.user?.full_name || 'this tenant'} from your tenant list.
                    Their account will remain active, but they will no longer be associated with your properties.
                    <br /><br />
                    <strong>This action cannot be undone.</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove Tenant
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
