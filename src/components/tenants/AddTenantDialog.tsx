import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAllProfiles } from '@/hooks/useAllProfiles';
import { useAddTenant } from '@/hooks/useTenants';
import { Search, User } from 'lucide-react';
import { format } from 'date-fns';

interface AddTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTenantUserIds: string[];
  managerId: string;
}

export function AddTenantDialog({ 
  open, 
  onOpenChange, 
  existingTenantUserIds,
  managerId
}: AddTenantDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
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

  const selectedUser = allProfiles?.find(p => p.id === selectedUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUserId) return;

    await addTenant.mutateAsync({
      user_id: selectedUserId,
      manager_id: managerId,
    });

    // Reset form
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setSelectedUserId('');
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
            Select a user to add as a tenant. You can assign properties and configure rent on the tenant details page.
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

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!selectedUserId || addTenant.isPending}
            >
              {addTenant.isPending ? 'Adding...' : 'Add Tenant'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
