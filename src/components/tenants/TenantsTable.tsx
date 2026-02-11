import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useHardDeleteTenant } from '@/hooks/useTenants';
import { useIsMobile } from '@/hooks/use-mobile';
import { Users, MapPin, DollarSign, Trash2, ChevronRight } from 'lucide-react';

interface TenantsTableProps {
  tenants: any[];
  onNavigate: (tenantId: string) => void;
}

function DeleteTenantButton({ tenant, deletingTenantId, onDelete }: { tenant: any; deletingTenantId: string | null; onDelete: (id: string) => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={deletingTenantId === tenant.id}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently Delete Tenant?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete <strong className="text-foreground">{tenant.user?.full_name || 'this tenant'}</strong>?
              </p>
              <p className="font-medium text-foreground">This will permanently remove:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All property assignments</li>
                <li>All rent charge history</li>
                <li>All payment records</li>
                <li>All balance adjustments</li>
              </ul>
              <p className="text-sm pt-2 border-t">
                <strong className="text-foreground">This action cannot be undone.</strong> The user can still log in and be added as a tenant again in the future.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => onDelete(tenant.id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, Delete Everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TenantsTable({ tenants, onNavigate }: TenantsTableProps) {
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const hardDeleteTenant = useHardDeleteTenant();
  const isMobile = useIsMobile();

  const handleDelete = async (tenantId: string) => {
    setDeletingTenantId(tenantId);
    try {
      await hardDeleteTenant.mutateAsync(tenantId);
    } finally {
      setDeletingTenantId(null);
    }
  };

  if (isMobile) {
    return (
      <div className="space-y-3">
        {tenants.map((tenant: any) => (
          <Card
            key={tenant.id}
            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors active:bg-muted/70"
            onClick={() => onNavigate(tenant.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{tenant.user?.full_name || 'Unnamed'}</p>
                  <p className="text-sm text-muted-foreground truncate">{tenant.user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <DeleteTenantButton tenant={tenant} deletingTenantId={deletingTenantId} onDelete={handleDelete} />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {tenant.primary_property ? (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[180px]">{tenant.primary_property.address}</span>
                  {tenant.additional_properties_count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      +{tenant.additional_properties_count}
                    </Badge>
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="border-warning text-warning text-xs">
                  Unassigned
                </Badge>
              )}

              {tenant.primary_rent_amount && tenant.primary_rent_amount > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>{Number(tenant.primary_rent_amount).toLocaleString()}/mo</span>
                </div>
              )}

              <Badge variant="secondary" className="bg-success/10 text-success text-xs ml-auto">
                Active
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Rent</TableHead>
            <TableHead>Lease Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant: any) => (
            <TableRow 
              key={tenant.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onNavigate(tenant.id)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">{tenant.user?.full_name || 'Unnamed'}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <p>{tenant.user?.email}</p>
                  {tenant.user?.phone && (
                    <p className="text-muted-foreground">{tenant.user.phone}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {tenant.primary_property ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{tenant.primary_property.address}</span>
                    {tenant.additional_properties_count > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        +{tenant.additional_properties_count}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="border-warning text-warning">
                    Unassigned
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {tenant.primary_rent_amount && tenant.primary_rent_amount > 0 ? (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{Number(tenant.primary_rent_amount).toLocaleString()}/mo</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {tenant.primary_lease_start && tenant.primary_lease_end ? (
                  <div className="text-sm">
                    <span>{new Date(tenant.primary_lease_start).toLocaleDateString()}</span>
                    <span className="text-muted-foreground"> — </span>
                    <span>{new Date(tenant.primary_lease_end).toLocaleDateString()}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="bg-success/10 text-success">
                  Active
                </Badge>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DeleteTenantButton tenant={tenant} deletingTenantId={deletingTenantId} onDelete={handleDelete} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
