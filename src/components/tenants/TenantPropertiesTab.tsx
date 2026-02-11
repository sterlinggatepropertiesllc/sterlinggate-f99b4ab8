import { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
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
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, DollarSign, Calendar as CalendarIcon, Building2, Pencil, Check, X, Percent, Clock } from 'lucide-react';
import { useTenantProperties, useAddTenantProperty, useRemoveTenantProperty, useUpdateTenantProperty, TenantProperty } from '@/hooks/useTenantProperties';
import { useManagerProperties } from '@/hooks/useProperties';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { QuickRentActions } from './QuickRentActions';
import { RentChargeHistory } from './RentChargeHistory';
import { AutomationSettings } from './AutomationSettings';

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

interface TenantPropertiesTabProps {
  tenant: TenantWithRelations;
  managerId: string | undefined;
  onUpdate: () => void;
}

// Late fee configuration form fields component
interface LateFeeFormFieldsProps {
  lateFeeType: string;
  setLateFeeType: (value: string) => void;
  lateFeePercentage: string;
  setLateFeePercentage: (value: string) => void;
  lateFeeFlatAmount: string;
  setLateFeeFlatAmount: (value: string) => void;
  lateFeeDailyAmount: string;
  setLateFeeDailyAmount: (value: string) => void;
  lateFeeMaxAmount: string;
  setLateFeeMaxAmount: (value: string) => void;
  gracePeriodDays: string;
  setGracePeriodDays: (value: string) => void;
  rentDueDay: string;
  setRentDueDay: (value: string) => void;
}

function LateFeeFormFields({
  lateFeeType,
  setLateFeeType,
  lateFeePercentage,
  setLateFeePercentage,
  lateFeeFlatAmount,
  setLateFeeFlatAmount,
  lateFeeDailyAmount,
  setLateFeeDailyAmount,
  lateFeeMaxAmount,
  setLateFeeMaxAmount,
  gracePeriodDays,
  setGracePeriodDays,
  rentDueDay,
  setRentDueDay,
}: LateFeeFormFieldsProps) {
  return (
    <>
      <Separator className="my-4" />
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Late Fee Configuration
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Rent Due Day</Label>
          <Input
            type="number"
            min="1"
            max="28"
            placeholder="1"
            value={rentDueDay}
            onChange={(e) => setRentDueDay(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">Day of month (1-28)</p>
        </div>
        <div>
          <Label>Grace Period (Days)</Label>
          <Input
            type="number"
            min="0"
            placeholder="5"
            value={gracePeriodDays}
            onChange={(e) => setGracePeriodDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">Days before late fee applies</p>
        </div>
        <div>
          <Label>Late Fee Type</Label>
          <Select value={lateFeeType} onValueChange={setLateFeeType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="flat">Flat Amount</SelectItem>
              <SelectItem value="daily">Daily Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {lateFeeType === 'percentage' && (
          <div>
            <Label>Late Fee Percentage</Label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="5"
                value={lateFeePercentage}
                onChange={(e) => setLateFeePercentage(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}
        {lateFeeType === 'flat' && (
          <div>
            <Label>Flat Late Fee</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="50"
                value={lateFeeFlatAmount}
                onChange={(e) => setLateFeeFlatAmount(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}
        {lateFeeType === 'daily' && (
          <>
            <div>
              <Label>Daily Late Fee</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="10"
                  value={lateFeeDailyAmount}
                  onChange={(e) => setLateFeeDailyAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label>Max Late Fee</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="100"
                  value={lateFeeMaxAmount}
                  onChange={(e) => setLateFeeMaxAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Optional cap on daily fees</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function TenantPropertiesTab({ tenant, managerId, onUpdate }: TenantPropertiesTabProps) {
  const tenantId = tenant.id;
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [rentAmount, setRentAmount] = useState<string>('');
  const [leaseStartDate, setLeaseStartDate] = useState<Date | undefined>();
  const [leaseEndDate, setLeaseEndDate] = useState<Date | undefined>();
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Late fee fields for add form
  const [lateFeeType, setLateFeeType] = useState<string>('percentage');
  const [lateFeePercentage, setLateFeePercentage] = useState<string>('5');
  const [lateFeeFlatAmount, setLateFeeFlatAmount] = useState<string>('0');
  const [lateFeeDailyAmount, setLateFeeDailyAmount] = useState<string>('0');
  const [lateFeeMaxAmount, setLateFeeMaxAmount] = useState<string>('');
  const [gracePeriodDays, setGracePeriodDays] = useState<string>('5');
  const [rentDueDay, setRentDueDay] = useState<string>('1');

  // Edit state
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editRentAmount, setEditRentAmount] = useState<string>('');
  const [editLeaseStartDate, setEditLeaseStartDate] = useState<Date | undefined>();
  const [editLeaseEndDate, setEditLeaseEndDate] = useState<Date | undefined>();
  const [editStartDateOpen, setEditStartDateOpen] = useState(false);
  const [editEndDateOpen, setEditEndDateOpen] = useState(false);

  // Edit late fee fields
  const [editLateFeeType, setEditLateFeeType] = useState<string>('percentage');
  const [editLateFeePercentage, setEditLateFeePercentage] = useState<string>('5');
  const [editLateFeeFlatAmount, setEditLateFeeFlatAmount] = useState<string>('0');
  const [editLateFeeDailyAmount, setEditLateFeeDailyAmount] = useState<string>('0');
  const [editLateFeeMaxAmount, setEditLateFeeMaxAmount] = useState<string>('');
  const [editGracePeriodDays, setEditGracePeriodDays] = useState<string>('5');
  const [editRentDueDay, setEditRentDueDay] = useState<string>('1');

  // Automation settings state
  const [automationSettings, setAutomationSettings] = useState({
    autoChargeRent: tenant.auto_charge_rent ?? true,
    autoApplyLateFees: tenant.auto_apply_late_fees ?? true,
  });

  const queryClient = useQueryClient();
  const { data: tenantProperties, isLoading } = useTenantProperties(tenantId);
  const { data: allProperties } = useManagerProperties(managerId);
  const addProperty = useAddTenantProperty();
  const removeProperty = useRemoveTenantProperty(tenantId);
  const updateProperty = useUpdateTenantProperty();

  // Build lease info from primary tenant property for AutomationSettings
  const primaryProperty = tenantProperties?.find(tp => tp.is_primary) || tenantProperties?.[0];
  const leaseInfo = primaryProperty ? {
    rentDueDay: primaryProperty.rent_due_day || 1,
    gracePeriodDays: primaryProperty.grace_period_days || 5,
    lateFeeType: primaryProperty.late_fee_type || 'percentage',
    lateFeePercentage: primaryProperty.late_fee_percentage || 5,
    lateFeeFlatAmount: primaryProperty.late_fee_flat_amount || 0,
    lateFeeDailyAmount: primaryProperty.late_fee_daily_amount || 0,
    lateFeeMaxAmount: primaryProperty.late_fee_max_amount || undefined,
    rentAmount: primaryProperty.rent_amount || 0,
  } : null;

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

  const resetAddForm = () => {
    setSelectedPropertyId('');
    setRentAmount('');
    setLeaseStartDate(undefined);
    setLeaseEndDate(undefined);
    setLateFeeType('percentage');
    setLateFeePercentage('5');
    setLateFeeFlatAmount('0');
    setLateFeeDailyAmount('0');
    setLateFeeMaxAmount('');
    setGracePeriodDays('5');
    setRentDueDay('1');
    setIsAddingProperty(false);
  };

  const handleAddProperty = async () => {
    if (!selectedPropertyId) {
      toast.error('Please select a property');
      return;
    }

    try {
      setStartDateOpen(false);
      setEndDateOpen(false);

      await addProperty.mutateAsync({
        tenant_id: tenantId,
        property_id: selectedPropertyId,
        rent_amount: rentAmount ? parseFloat(rentAmount) : null,
        lease_start_date: leaseStartDate ? format(leaseStartDate, 'yyyy-MM-dd') : null,
        lease_end_date: leaseEndDate ? format(leaseEndDate, 'yyyy-MM-dd') : null,
        is_primary: tenantProperties?.length === 0, // First property is primary
        late_fee_type: lateFeeType,
        late_fee_percentage: lateFeePercentage ? parseFloat(lateFeePercentage) : 5,
        late_fee_flat_amount: lateFeeFlatAmount ? parseFloat(lateFeeFlatAmount) : 0,
        late_fee_daily_amount: lateFeeDailyAmount ? parseFloat(lateFeeDailyAmount) : 0,
        late_fee_max_amount: lateFeeMaxAmount ? parseFloat(lateFeeMaxAmount) : null,
        grace_period_days: gracePeriodDays ? parseInt(gracePeriodDays) : 5,
        rent_due_day: rentDueDay ? parseInt(rentDueDay) : 1,
      });

      resetAddForm();
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

  const startEditing = (tp: TenantProperty) => {
    setEditingPropertyId(tp.id);
    setEditRentAmount(tp.rent_amount?.toString() || '');
    setEditLeaseStartDate(tp.lease_start_date ? new Date(tp.lease_start_date) : undefined);
    setEditLeaseEndDate(tp.lease_end_date ? new Date(tp.lease_end_date) : undefined);
    setEditLateFeeType(tp.late_fee_type || 'percentage');
    setEditLateFeePercentage(tp.late_fee_percentage?.toString() || '5');
    setEditLateFeeFlatAmount(tp.late_fee_flat_amount?.toString() || '0');
    setEditLateFeeDailyAmount(tp.late_fee_daily_amount?.toString() || '0');
    setEditLateFeeMaxAmount(tp.late_fee_max_amount?.toString() || '');
    setEditGracePeriodDays(tp.grace_period_days?.toString() || '5');
    setEditRentDueDay(tp.rent_due_day?.toString() || '1');
  };

  const cancelEditing = () => {
    setEditStartDateOpen(false);
    setEditEndDateOpen(false);
    setEditingPropertyId(null);
    setEditRentAmount('');
    setEditLeaseStartDate(undefined);
    setEditLeaseEndDate(undefined);
    setEditLateFeeType('percentage');
    setEditLateFeePercentage('5');
    setEditLateFeeFlatAmount('0');
    setEditLateFeeDailyAmount('0');
    setEditLateFeeMaxAmount('');
    setEditGracePeriodDays('5');
    setEditRentDueDay('1');
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
        late_fee_type: editLateFeeType,
        late_fee_percentage: editLateFeePercentage ? parseFloat(editLateFeePercentage) : 5,
        late_fee_flat_amount: editLateFeeFlatAmount ? parseFloat(editLateFeeFlatAmount) : 0,
        late_fee_daily_amount: editLateFeeDailyAmount ? parseFloat(editLateFeeDailyAmount) : 0,
        late_fee_max_amount: editLateFeeMaxAmount ? parseFloat(editLateFeeMaxAmount) : null,
        grace_period_days: editGracePeriodDays ? parseInt(editGracePeriodDays) : 5,
        rent_due_day: editRentDueDay ? parseInt(editRentDueDay) : 1,
      });

      cancelEditing();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-serif">Assigned Properties</h2>
          <p className="text-sm text-muted-foreground">
            {tenantProperties?.length || 0} {(tenantProperties?.length || 0) === 1 ? 'property' : 'properties'} assigned
          </p>
        </div>
        <Button onClick={() => setIsAddingProperty(true)} disabled={availableProperties.length === 0} className="w-full sm:w-auto">
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

            {/* Late Fee Configuration */}
            <LateFeeFormFields
              lateFeeType={lateFeeType}
              setLateFeeType={setLateFeeType}
              lateFeePercentage={lateFeePercentage}
              setLateFeePercentage={setLateFeePercentage}
              lateFeeFlatAmount={lateFeeFlatAmount}
              setLateFeeFlatAmount={setLateFeeFlatAmount}
              lateFeeDailyAmount={lateFeeDailyAmount}
              setLateFeeDailyAmount={setLateFeeDailyAmount}
              lateFeeMaxAmount={lateFeeMaxAmount}
              setLateFeeMaxAmount={setLateFeeMaxAmount}
              gracePeriodDays={gracePeriodDays}
              setGracePeriodDays={setGracePeriodDays}
              rentDueDay={rentDueDay}
              setRentDueDay={setRentDueDay}
            />

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStartDateOpen(false);
                  setEndDateOpen(false);
                  resetAddForm();
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
          {tenantProperties.map((tp: TenantProperty) => {
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
                        {tp.is_primary && (
                          <Badge variant="secondary" className="ml-2">Primary</Badge>
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

                      {/* Late Fee Configuration in Edit Mode */}
                      <LateFeeFormFields
                        lateFeeType={editLateFeeType}
                        setLateFeeType={setEditLateFeeType}
                        lateFeePercentage={editLateFeePercentage}
                        setLateFeePercentage={setEditLateFeePercentage}
                        lateFeeFlatAmount={editLateFeeFlatAmount}
                        setLateFeeFlatAmount={setEditLateFeeFlatAmount}
                        lateFeeDailyAmount={editLateFeeDailyAmount}
                        setLateFeeDailyAmount={setEditLateFeeDailyAmount}
                        lateFeeMaxAmount={editLateFeeMaxAmount}
                        setLateFeeMaxAmount={setEditLateFeeMaxAmount}
                        gracePeriodDays={editGracePeriodDays}
                        setGracePeriodDays={setEditGracePeriodDays}
                        rentDueDay={editRentDueDay}
                        setRentDueDay={setEditRentDueDay}
                      />

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
                            {tp.is_primary && (
                              <Badge variant="secondary">Primary</Badge>
                            )}
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
                            {tp.grace_period_days && (
                              <span className="flex items-center gap-1.5 text-blue-400">
                                <Clock className="h-3.5 w-3.5" />
                                <span className="text-muted-foreground">{tp.grace_period_days} day grace</span>
                              </span>
                            )}
                            {tp.late_fee_type && (
                              <span className="flex items-center gap-1.5 text-orange-400">
                                <Percent className="h-3.5 w-3.5" />
                                <span className="text-muted-foreground">
                                  {tp.late_fee_type === 'percentage' && `${tp.late_fee_percentage}% late fee`}
                                  {tp.late_fee_type === 'flat' && `$${tp.late_fee_flat_amount} flat late fee`}
                                  {tp.late_fee_type === 'daily' && `$${tp.late_fee_daily_amount}/day late fee`}
                                </span>
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

      {/* Rent Management Section */}
      {managerId && tenant.manager_id && (
        <>
          <Separator className="my-6" />

          {/* Quick Rent Actions */}
          <QuickRentActions
            tenantId={tenant.id}
            managerId={managerId}
            rentAmount={tenant.rent_amount}
          />

          {/* Rent Charge History */}
          <div className="mt-6">
            <RentChargeHistory
              tenantId={tenant.id}
              managerId={managerId}
            />
          </div>

          {/* Automation Settings */}
          <div className="mt-6">
            <AutomationSettings
              tenantId={tenant.id}
              autoChargeRent={automationSettings.autoChargeRent}
              autoApplyLateFees={automationSettings.autoApplyLateFees}
              leaseInfo={leaseInfo}
              onSettingsChange={setAutomationSettings}
            />
          </div>
        </>
      )}
    </div>
  );
}
