import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, DollarSign, Calendar as CalendarIcon, Building2, Pencil, Check, X } from 'lucide-react';
import { useTenantProperties, useAddTenantProperty, useRemoveTenantProperty, useUpdateTenantProperty } from '@/hooks/useTenantProperties';
import { useManagerProperties } from '@/hooks/useProperties';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TenantPropertiesTabProps {
  tenantId: string;
  managerId: string | undefined;
}

export function TenantPropertiesTab({ tenantId, managerId }: TenantPropertiesTabProps) {
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [rentAmount, setRentAmount] = useState<string>('');
  const [leaseStartDate, setLeaseStartDate] = useState<Date | undefined>();
  const [leaseEndDate, setLeaseEndDate] = useState<Date | undefined>();
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Edit state
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editRentAmount, setEditRentAmount] = useState<string>('');
  const [editLeaseStartDate, setEditLeaseStartDate] = useState<Date | undefined>();
  const [editLeaseEndDate, setEditLeaseEndDate] = useState<Date | undefined>();
  const [editStartDateOpen, setEditStartDateOpen] = useState(false);
  const [editEndDateOpen, setEditEndDateOpen] = useState(false);

  const queryClient = useQueryClient();
  const { data: tenantProperties, isLoading } = useTenantProperties(tenantId);
  const { data: allProperties } = useManagerProperties(managerId);
  const addProperty = useAddTenantProperty();
  const removeProperty = useRemoveTenantProperty(tenantId);
  const updateProperty = useUpdateTenantProperty();
  

  // Realtime subscription for tenant property changes
  useEffect(() => {
    const channel = supabase
      .channel(`tenant-properties-manager-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_properties',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tenant-properties', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['tenants'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  // Filter out already assigned properties
  const assignedPropertyIds = tenantProperties?.map(tp => tp.property_id) || [];
  const availableProperties = allProperties?.filter(p => !assignedPropertyIds.includes(p.id)) || [];

  const handleAddProperty = async () => {
    if (!selectedPropertyId) {
      toast.error('Please select a property');
      return;
    }

    try {
      // Ensure any open date pickers are closed before we mutate UI state
      setStartDateOpen(false);
      setEndDateOpen(false);

      await addProperty.mutateAsync({
        tenant_id: tenantId,
        property_id: selectedPropertyId,
        rent_amount: rentAmount ? parseFloat(rentAmount) : null,
        lease_start_date: leaseStartDate ? format(leaseStartDate, 'yyyy-MM-dd') : null,
        lease_end_date: leaseEndDate ? format(leaseEndDate, 'yyyy-MM-dd') : null,
        is_primary: false,
      });

      // Reset form
      setSelectedPropertyId('');
      setRentAmount('');
      setLeaseStartDate(undefined);
      setLeaseEndDate(undefined);
      setIsAddingProperty(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleRemoveProperty = async (tenantPropertyId: string) => {
    try {
      await removeProperty.mutateAsync(tenantPropertyId);
    } catch (error) {
      // Error handled by hook
    }
  };

  const startEditing = (tp: any) => {
    setEditingPropertyId(tp.id);
    setEditRentAmount(tp.rent_amount?.toString() || '');
    setEditLeaseStartDate(tp.lease_start_date ? new Date(tp.lease_start_date) : undefined);
    setEditLeaseEndDate(tp.lease_end_date ? new Date(tp.lease_end_date) : undefined);
  };

  const cancelEditing = () => {
    setEditStartDateOpen(false);
    setEditEndDateOpen(false);
    setEditingPropertyId(null);
    setEditRentAmount('');
    setEditLeaseStartDate(undefined);
    setEditLeaseEndDate(undefined);
  };

  const handleSaveEdit = async () => {
    if (!editingPropertyId) return;

    try {
      setEditStartDateOpen(false);
      setEditEndDateOpen(false);

      await updateProperty.mutateAsync({
        id: editingPropertyId,
        tenant_id: tenantId,
        rent_amount: editRentAmount ? parseFloat(editRentAmount) : null,
        lease_start_date: editLeaseStartDate ? format(editLeaseStartDate, 'yyyy-MM-dd') : null,
        lease_end_date: editLeaseEndDate ? format(editLeaseEndDate, 'yyyy-MM-dd') : null,
      });

      setEditingPropertyId(null);
    } catch (error) {
      // Error handled by hook
    }
  };


  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading properties...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif">Assigned Properties</h2>
          <p className="text-sm text-muted-foreground">
            {tenantProperties?.length || 0} {(tenantProperties?.length || 0) === 1 ? 'property' : 'properties'} assigned
          </p>
        </div>
        <Button onClick={() => setIsAddingProperty(true)} disabled={availableProperties.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Assign Property
        </Button>
      </div>

      {/* Add Property Form */}
      {isAddingProperty && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg">Assign New Property</CardTitle>
            <CardDescription>Select a property and configure lease details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Property</Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.address}, {property.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableProperties.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  No available properties to assign
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Rent Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label>Lease Start</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !leaseStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {leaseStartDate ? format(leaseStartDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={leaseStartDate}
                      onSelect={(date) => {
                        setLeaseStartDate(date);
                        setStartDateOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Lease End</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !leaseEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {leaseEndDate ? format(leaseEndDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={leaseEndDate}
                      onSelect={(date) => {
                        setLeaseEndDate(date);
                        setEndDateOpen(false);
                      }}
                      initialFocus
                      disabled={(date) => leaseStartDate ? date < leaseStartDate : false}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStartDateOpen(false);
                  setEndDateOpen(false);
                  setIsAddingProperty(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddProperty} disabled={addProperty.isPending || !selectedPropertyId}>
                {addProperty.isPending ? 'Assigning...' : 'Assign Property'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property List */}
      {tenantProperties && tenantProperties.length > 0 ? (
        <div className="space-y-4">
          {tenantProperties.map((tp: any) => {
            const isEditing = editingPropertyId === tp.id;
            
            return (
              <Card key={tp.id} className={cn(
                "transition-all duration-300",
                isEditing ? "border-primary ring-1 ring-primary/20" : "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30"
              )}>
                <CardContent className="py-4">
                  {isEditing ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 bg-gradient-to-br from-muted/80 to-muted/30 ring-border">
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{tp.property?.address}</h3>
                          <p className="text-sm text-muted-foreground">
                            {tp.property?.city}, {tp.property?.state}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Rent Amount</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={editRentAmount}
                              onChange={(e) => setEditRentAmount(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Lease Start</Label>
                          <Popover open={editStartDateOpen} onOpenChange={setEditStartDateOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-10",
                                  !editLeaseStartDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editLeaseStartDate ? format(editLeaseStartDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={editLeaseStartDate}
                                onSelect={(date) => {
                                  setEditLeaseStartDate(date);
                                  setEditStartDateOpen(false);
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Lease End</Label>
                          <Popover open={editEndDateOpen} onOpenChange={setEditEndDateOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-10",
                                  !editLeaseEndDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editLeaseEndDate ? format(editLeaseEndDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={editLeaseEndDate}
                                onSelect={(date) => {
                                  setEditLeaseEndDate(date);
                                  setEditEndDateOpen(false);
                                }}
                                initialFocus
                                disabled={(date) => editLeaseStartDate ? date < editLeaseStartDate : false}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={cancelEditing}>
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={updateProperty.isPending}>
                          <Check className="mr-1 h-4 w-4" />
                          {updateProperty.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 bg-gradient-to-br from-muted/80 to-muted/30 ring-border">
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground">{tp.property?.address}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {tp.property?.city}, {tp.property?.state}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 text-sm mt-2">
                            {tp.rent_amount && (
                              <span className="flex items-center gap-1.5 text-emerald-400">
                                <DollarSign className="h-3.5 w-3.5" />
                                <span className="text-foreground font-medium">{Number(tp.rent_amount).toLocaleString()}/mo</span>
                              </span>
                            )}
                            {tp.lease_start_date && tp.lease_end_date && (
                              <span className="flex items-center gap-1.5 text-amber-400">
                                <CalendarIcon className="h-3.5 w-3.5" />
                                <span className="text-muted-foreground">{new Date(tp.lease_start_date).toLocaleDateString()} — {new Date(tp.lease_end_date).toLocaleDateString()}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-16 md:ml-0">
                        <Button variant="outline" size="sm" onClick={() => startEditing(tp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Unassign Property?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {tp.property?.address} from this tenant's assigned properties.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveProperty(tp.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Unassign
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/20">
              <Building2 className="h-8 w-8 text-primary/50" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-foreground">No Properties Assigned</h3>
            <p className="text-muted-foreground mb-4">
              Assign properties to this tenant to track their rent and lease details
            </p>
            <Button onClick={() => setIsAddingProperty(true)} disabled={availableProperties.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Assign First Property
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
