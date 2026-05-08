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
import type { Payment } from '@/hooks/usePayments';
import type { TenantHealthFilter, TenantRecord } from '@/components/admin/adminTypes';
import { computeTenantFinancialHealth } from '@/lib/paymentReliability';
import { Users, MapPin, DollarSign, Trash2, ChevronRight, Banknote, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TenantsTableProps {
  tenants: TenantRecord[];
  payments?: Payment[];
  healthFilter?: TenantHealthFilter;
  onHealthFilterChange?: (filter: TenantHealthFilter) => void;
  onNavigate: (tenantId: string) => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function balanceLabel(value: number) {
  if (value > 0) return `${formatCurrency(value)} due`;
  if (value < 0) return `${formatCurrency(Math.abs(value))} credit`;
  return 'Paid up';
}

function healthMatchesFilter(health: ReturnType<typeof computeTenantFinancialHealth>, filter: TenantHealthFilter) {
  switch (filter) {
    case 'balance-due':
      return health.hasBalanceDue;
    case 'pending-ach':
      return health.pendingACH > 0;
    case 'unassigned':
      return health.isUnassigned;
    case 'paid-up':
      return health.isPaidUp;
    default:
      return true;
  }
}

function DeleteTenantButton({
  tenant,
  deletingTenantId,
  onDelete,
}: {
  tenant: TenantRecord;
  deletingTenantId: string | null;
  onDelete: (id: string) => void;
}) {
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

export function TenantsTable({
  tenants,
  payments = [],
  healthFilter = 'all',
  onHealthFilterChange,
  onNavigate,
}: TenantsTableProps) {
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const hardDeleteTenant = useHardDeleteTenant();
  const isMobile = useIsMobile();

  const tenantsWithHealth = tenants.map((tenant) => ({
    tenant,
    health: computeTenantFinancialHealth(tenant, payments),
  }));

  const healthCounts = {
    all: tenantsWithHealth.length,
    'balance-due': tenantsWithHealth.filter(({ health }) => health.hasBalanceDue).length,
    'pending-ach': tenantsWithHealth.filter(({ health }) => health.pendingACH > 0).length,
    unassigned: tenantsWithHealth.filter(({ health }) => health.isUnassigned).length,
    'paid-up': tenantsWithHealth.filter(({ health }) => health.isPaidUp).length,
  };

  const visibleTenants = tenantsWithHealth.filter(({ health }) => healthMatchesFilter(health, healthFilter));

  const handleDelete = async (tenantId: string) => {
    setDeletingTenantId(tenantId);
    try {
      await hardDeleteTenant.mutateAsync(tenantId);
    } finally {
      setDeletingTenantId(null);
    }
  };

  const filterBar = (
    <div className="mb-4 flex flex-wrap gap-2">
      {[
        { id: 'all' as TenantHealthFilter, label: 'All', count: healthCounts.all },
        { id: 'balance-due' as TenantHealthFilter, label: 'Balance Due', count: healthCounts['balance-due'] },
        { id: 'pending-ach' as TenantHealthFilter, label: 'Pending ACH', count: healthCounts['pending-ach'] },
        { id: 'unassigned' as TenantHealthFilter, label: 'Unassigned', count: healthCounts.unassigned },
        { id: 'paid-up' as TenantHealthFilter, label: 'Paid Up', count: healthCounts['paid-up'] },
      ].map((item) => (
        <Button
          key={item.id}
          type="button"
          size="sm"
          variant={healthFilter === item.id ? 'default' : 'outline'}
          onClick={() => onHealthFilterChange?.(item.id)}
          className="h-9"
        >
          {item.label}
          <span className="ml-2 rounded-full bg-background/25 px-2 py-0.5 text-xs">{item.count}</span>
        </Button>
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <div>
        {filterBar}
        <div className="space-y-3">
        {visibleTenants.map(({ tenant, health }) => (
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

              {health.pendingACH > 0 && (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning text-xs">
                  ACH {formatCurrency(health.pendingACH)}
                </Badge>
              )}

                  <Badge
                    variant="secondary"
                    className={`text-xs ml-auto ${
                  health.hasBalanceDue ? 'bg-destructive/10 text-destructive' : health.hasCredit ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                }`}
              >
                {health.hasBalanceDue ? `${formatCurrency(health.effectiveBalance)} due` : health.hasCredit ? `${formatCurrency(Math.abs(health.effectiveBalance))} credit` : 'Current'}
              </Badge>
            </div>
          </Card>
        ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {filterBar}
      <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Financial Health</TableHead>
            <TableHead>Rent / Lease</TableHead>
            <TableHead>Last Payment</TableHead>
            <TableHead className="w-[70px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleTenants.map(({ tenant, health }) => (
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
                    <p className="text-sm text-muted-foreground">{tenant.user?.email}</p>
                    {tenant.user?.phone && (
                      <p className="text-xs text-muted-foreground">{tenant.user.phone}</p>
                    )}
                  </div>
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
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        health.hasBalanceDue
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : health.hasCredit
                            ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-success/40 bg-success/10 text-success'
                      }
                    >
                      {balanceLabel(health.effectiveBalance)}
                    </Badge>
                    {health.pendingACH > 0 && (
                      <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                        <Banknote className="mr-1 h-3 w-3" />
                        {formatCurrency(health.pendingACH)} ACH
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Official {balanceLabel(health.currentBalance)} · Effective {balanceLabel(health.effectiveBalance)}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {tenant.primary_rent_amount && tenant.primary_rent_amount > 0 ? (
                    <div className="flex items-center gap-1 text-sm">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{Number(tenant.primary_rent_amount).toLocaleString()}/mo</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No rent set</span>
                  )}
                  {tenant.primary_lease_start && tenant.primary_lease_end ? (
                    <p className="text-xs text-muted-foreground">
                      {new Date(tenant.primary_lease_start).toLocaleDateString()} - {new Date(tenant.primary_lease_end).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs text-warning">No lease period</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {health.lastCompletedPayment ? (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{formatCurrency(Number(health.lastCompletedPayment.amount))}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(health.lastCompletedPayment.payment_date).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    No payment
                  </Badge>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DeleteTenantButton tenant={tenant} deletingTenantId={deletingTenantId} onDelete={handleDelete} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </Card>
      {visibleTenants.length === 0 && (
        <Card className="mt-4 border-dashed p-8 text-center text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success" />
          No tenants match this filter.
        </Card>
      )}
    </div>
  );
}
