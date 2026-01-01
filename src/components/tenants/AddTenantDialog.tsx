import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAllProfiles } from '@/hooks/useAllProfiles';
import { useAddTenant } from '@/hooks/useTenants';
import { Search, User, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];

interface AddTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  existingTenantUserIds: string[];
}

export function AddTenantDialog({ 
  open, 
  onOpenChange, 
  properties,
  existingTenantUserIds 
}: AddTenantDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [rentAmount, setRentAmount] = useState<string>('');
  const [leaseStartDate, setLeaseStartDate] = useState<string>('');
  const [leaseEndDate, setLeaseEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: allProfiles, isLoading: profilesLoading } = useAllProfiles();
  const addTenant = useAddTenant();

  // Filter out users who are already tenants
  const availableProfiles = useMemo(() => {
    if (!allProfiles) return [];
    return allProfiles.filter(profile => !existingTenantUserIds.includes(profile.id));
  }, [allProfiles, existingTenantUserIds]);

  // Filter by search query
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return availableProfiles;
    const query = searchQuery.toLowerCase();
    return availableProfiles.filter(
      profile =>
        profile.email.toLowerCase().includes(query) ||
        (profile.full_name && profile.full_name.toLowerCase().includes(query))
    );
  }, [availableProfiles, searchQuery]);

  // Get available properties (not occupied)
  const availableProperties = useMemo(() => {
    return properties.filter(p => p.status === 'available');
  }, [properties]);

  const selectedUser = allProfiles?.find(p => p.id === selectedUserId);
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUserId || !selectedPropertyId || !rentAmount) return;

    await addTenant.mutateAsync({
      user_id: selectedUserId,
      property_id: selectedPropertyId,
      rent_amount: parseFloat(rentAmount),
      lease_start_date: leaseStartDate || null,
      lease_end_date: leaseEndDate || null,
    });

    // Reset form
    setSelectedUserId('');
    setSelectedPropertyId('');
    setRentAmount('');
    setLeaseStartDate('');
    setLeaseEndDate('');
    setSearchQuery('');
    onOpenChange(false);
  };

  const resetForm = () => {
    setSelectedUserId('');
    setSelectedPropertyId('');
    setRentAmount('');
    setLeaseStartDate('');
    setLeaseEndDate('');
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add Tenant</DialogTitle>
          <DialogDescription>
            Link an existing user to one of your properties as a tenant
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* User Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Select User</Label>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* User List */}
            <ScrollArea className="h-48 border rounded-lg">
              {profilesLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading users...</div>
              ) : filteredProfiles.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchQuery ? 'No users found matching your search' : 'No available users to add'}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setSelectedUserId(profile.id)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedUserId === profile.id
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {profile.full_name || 'No name'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {profile.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Signed up {format(new Date(profile.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {selectedUser && (
              <div className="flex items-center gap-2 p-2 bg-success/10 rounded-lg">
                <Badge variant="outline" className="border-success text-success">Selected</Badge>
                <span className="text-sm">{selectedUser.full_name || selectedUser.email}</span>
              </div>
            )}
          </div>

          {/* Property Selection */}
          <div className="space-y-2">
            <Label htmlFor="property">Property</Label>
            <Select value={selectedPropertyId} onValueChange={(value) => {
              setSelectedPropertyId(value);
              // Auto-fill rent amount from property
              const property = properties.find(p => p.id === value);
              if (property) {
                setRentAmount(property.rent_amount.toString());
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {availableProperties.length === 0 ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    No available properties
                  </div>
                ) : (
                  availableProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.address}, {property.city}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Rent Amount */}
          <div className="space-y-2">
            <Label htmlFor="rentAmount">Monthly Rent</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="rentAmount"
                type="number"
                placeholder="0.00"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          {/* Lease Dates (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leaseStart">Lease Start (Optional)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="leaseStart"
                  type="date"
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leaseEnd">Lease End (Optional)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="leaseEnd"
                  type="date"
                  value={leaseEndDate}
                  onChange={(e) => setLeaseEndDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!selectedUserId || !selectedPropertyId || !rentAmount || addTenant.isPending}
            >
              {addTenant.isPending ? 'Adding...' : 'Add Tenant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
