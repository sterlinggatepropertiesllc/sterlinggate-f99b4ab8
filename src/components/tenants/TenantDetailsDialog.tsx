import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUpdateTenant, useDeleteTenant, useRevokeTenantAccess } from '@/hooks/useTenants';
import { useAuth } from '@/contexts/AuthContext';
import { BalanceSection } from './BalanceSection';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Users, Mail, Phone, MapPin, DollarSign, CalendarIcon, FileText, Shield, Trash2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
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
  user: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
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
  const [editedTenant, setEditedTenant] = useState<{
    property_id: string | null;
    rent_amount: number | null;
    lease_start_date: string | null;
    lease_end_date: string | null;
    notes: string | null;
  }>({
    property_id: tenant?.property_id || null,
    rent_amount: tenant?.rent_amount || null,
    lease_start_date: tenant?.lease_start_date || null,
    lease_end_date: tenant?.lease_end_date || null,
    notes: (tenant as any)?.notes || null,
  });

  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();
  const revokeAccess = useRevokeTenantAccess();

  // Sync balance when tenant changes
  useEffect(() => {
    if (tenant) {
      setCurrentBalance(tenant.current_balance || 0);
    }
  }, [tenant?.id, tenant?.current_balance]);

  // Handle balance update - refetch from DB and update local state
  const handleBalanceUpdate = async () => {
    if (!tenant) return;
    
    const { data } = await supabase
      .from('tenants')
      .select('current_balance')
      .eq('id', tenant.id)
      .maybeSingle();
    
    if (data) {
      setCurrentBalance(data.current_balance || 0);
    }
    
    // Invalidate tenants query for parent refresh
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
  };

  // Reset form when tenant changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && tenant) {
      setEditedTenant({
        property_id: tenant.property_id,
        rent_amount: tenant.rent_amount,
        lease_start_date: tenant.lease_start_date,
        lease_end_date: tenant.lease_end_date,
        notes: (tenant as any)?.notes || null,
      });
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!tenant) return;
    
    await updateTenant.mutateAsync({
      id: tenant.id,
      property_id: editedTenant.property_id,
      rent_amount: editedTenant.rent_amount,
      lease_start_date: editedTenant.lease_start_date,
      lease_end_date: editedTenant.lease_end_date,
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

  const availableProperties = properties?.filter(p => p.status === 'available' || p.id === tenant.property_id) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

        {/* Editable Fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Property Assignment */}
            <div className="col-span-2">
              <Label htmlFor="property" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Assigned Property
              </Label>
              <Select
                value={editedTenant.property_id || 'none'}
                onValueChange={(value) => setEditedTenant(prev => ({ 
                  ...prev, 
                  property_id: value === 'none' ? null : value 
                }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Property Assigned</SelectItem>
                  {availableProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.address}, {property.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rent Amount */}
            <div>
              <Label htmlFor="rent_amount" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Monthly Rent
              </Label>
              <Input
                id="rent_amount"
                type="number"
                value={editedTenant.rent_amount || ''}
                onChange={(e) => setEditedTenant(prev => ({ 
                  ...prev, 
                  rent_amount: e.target.value ? parseFloat(e.target.value) : null 
                }))}
                placeholder="0"
                className="mt-1.5"
              />
            </div>

            {/* Placeholder for spacing */}
            <div />

            {/* Lease Start Date */}
            <div>
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" /> Lease Start
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 mt-1.5 bg-background hover:bg-muted/50 border-input",
                      !editedTenant.lease_start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {editedTenant.lease_start_date 
                      ? format(parseISO(editedTenant.lease_start_date), "MMMM d, yyyy") 
                      : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editedTenant.lease_start_date ? parseISO(editedTenant.lease_start_date) : undefined}
                    onSelect={(date) => setEditedTenant(prev => ({ 
                      ...prev, 
                      lease_start_date: date ? format(date, 'yyyy-MM-dd') : null 
                    }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Lease End Date */}
            <div>
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" /> Lease End
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 mt-1.5 bg-background hover:bg-muted/50 border-input",
                      !editedTenant.lease_end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {editedTenant.lease_end_date 
                      ? format(parseISO(editedTenant.lease_end_date), "MMMM d, yyyy") 
                      : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editedTenant.lease_end_date ? parseISO(editedTenant.lease_end_date) : undefined}
                    onSelect={(date) => setEditedTenant(prev => ({ 
                      ...prev, 
                      lease_end_date: date ? format(date, 'yyyy-MM-dd') : null 
                    }))}
                    disabled={(date) => editedTenant.lease_start_date ? date < parseISO(editedTenant.lease_start_date) : false}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

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

        <Separator />

        {/* Access & Status Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Access & Status</h4>
          <div className="flex items-center justify-between bg-muted/30 rounded-lg p-4">
            <div>
              <p className="font-medium">Tenant Portal Access</p>
              <p className="text-sm text-muted-foreground">
                Revoke access to prevent tenant from logging into the portal
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-warning border-warning hover:bg-warning/10 whitespace-nowrap flex-shrink-0">
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
          <div className="flex items-center justify-between border border-destructive/30 rounded-lg p-4">
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