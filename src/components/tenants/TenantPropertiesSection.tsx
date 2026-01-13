import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useTenantProperties, useAddTenantProperty, useRemoveTenantProperty, TenantProperty } from '@/hooks/useTenantProperties';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { MapPin, DollarSign, CalendarIcon, Plus, Trash2, Loader2, Check, X as XIcon } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];

interface TenantPropertiesSectionProps {
  tenantId: string;
  properties: Property[];
}

export function TenantPropertiesSection({ tenantId, properties }: TenantPropertiesSectionProps) {
  const { data: tenantProperties, isLoading } = useTenantProperties(tenantId);
  const addProperty = useAddTenantProperty();
  const removeProperty = useRemoveTenantProperty();

  const [isAdding, setIsAdding] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    property_id: '',
    rent_amount: '',
    lease_start_date: null as string | null,
    lease_end_date: null as string | null,
  });

  // Properties not already assigned to this tenant
  const assignedPropertyIds = tenantProperties?.map(tp => tp.property_id) || [];
  const availableProperties = properties.filter(p => !assignedPropertyIds.includes(p.id));

  const handleAddProperty = async () => {
    if (!newAssignment.property_id) return;

    await addProperty.mutateAsync({
      tenant_id: tenantId,
      property_id: newAssignment.property_id,
      rent_amount: newAssignment.rent_amount ? parseFloat(newAssignment.rent_amount) : null,
      lease_start_date: newAssignment.lease_start_date,
      lease_end_date: newAssignment.lease_end_date,
      is_primary: false,
    });

    setNewAssignment({
      property_id: '',
      rent_amount: '',
      lease_start_date: null,
      lease_end_date: null,
    });
    setIsAdding(false);
  };

  const handleRemove = async (tp: TenantProperty) => {
    await removeProperty.mutateAsync(tp.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-base font-medium">
          <MapPin className="h-4 w-4" /> Assigned Properties
        </Label>
        {availableProperties.length > 0 && !isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Property
          </Button>
        )}
      </div>

      {/* Add new property form */}
      {isAdding && (
        <Card className="p-4 border-dashed">
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground">Select Property</Label>
              <Select
                value={newAssignment.property_id}
                onValueChange={(value) => {
                  const property = properties.find(p => p.id === value);
                  setNewAssignment(prev => ({
                    ...prev,
                    property_id: value,
                    rent_amount: property?.rent_amount?.toString() || prev.rent_amount,
                  }));
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a property..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.address}, {property.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground">Rent Amount</Label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={newAssignment.rent_amount}
                    onChange={(e) => setNewAssignment(prev => ({ ...prev, rent_amount: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Lease Start</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !newAssignment.lease_start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newAssignment.lease_start_date
                        ? format(parseISO(newAssignment.lease_start_date), "MMM d, yyyy")
                        : "Select"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newAssignment.lease_start_date ? parseISO(newAssignment.lease_start_date) : undefined}
                      onSelect={(date) => setNewAssignment(prev => ({
                        ...prev,
                        lease_start_date: date ? format(date, 'yyyy-MM-dd') : null
                      }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Lease End</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !newAssignment.lease_end_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newAssignment.lease_end_date
                        ? format(parseISO(newAssignment.lease_end_date), "MMM d, yyyy")
                        : "Select"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newAssignment.lease_end_date ? parseISO(newAssignment.lease_end_date) : undefined}
                      onSelect={(date) => setNewAssignment(prev => ({
                        ...prev,
                        lease_end_date: date ? format(date, 'yyyy-MM-dd') : null
                      }))}
                      disabled={(date) => newAssignment.lease_start_date ? date < parseISO(newAssignment.lease_start_date) : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewAssignment({
                    property_id: '',
                    rent_amount: '',
                    lease_start_date: null,
                    lease_end_date: null,
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddProperty}
                disabled={!newAssignment.property_id || addProperty.isPending}
              >
                {addProperty.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Add
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Assigned properties list */}
      {tenantProperties && tenantProperties.length > 0 ? (
        <div className="space-y-2">
          {tenantProperties.map((tp) => (
            <Card key={tp.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {tp.property?.address}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tp.property?.city}, {tp.property?.state}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                    {tp.rent_amount !== null && tp.rent_amount > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${tp.rent_amount?.toLocaleString()}/mo
                      </span>
                    )}
                    {tp.lease_start_date && (
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(parseISO(tp.lease_start_date), "MMM yyyy")}
                        {tp.lease_end_date && (
                          <> - {format(parseISO(tp.lease_end_date), "MMM yyyy")}</>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(tp)}
                    disabled={removeProperty.isPending}
                    className="text-destructive hover:text-destructive"
                    title="Remove property"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : !isAdding ? (
        <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No properties assigned</p>
          {availableProperties.length > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="mt-2"
            >
              Assign a property
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
