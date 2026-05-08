import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  ClipboardList,
  FileText,
  Home,
  Search,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Payment } from '@/hooks/usePayments';
import type { AdminNavigate, ApplicationRecord, LeaseRecord, PropertyRecord, TenantRecord } from './adminTypes';

interface AdminGlobalSearchProps {
  properties: PropertyRecord[];
  tenants: TenantRecord[];
  applications: ApplicationRecord[];
  leases: LeaseRecord[];
  payments: Payment[];
  onNavigateTab: AdminNavigate;
  onOpenTenant: (tenantId: string) => void;
}

interface SearchResult {
  id: string;
  type: 'Tenant' | 'Property' | 'Payment' | 'Application' | 'Lease';
  title: string;
  detail: string;
  meta?: string;
  icon: LucideIcon;
  action: () => void;
}

function normalize(value: unknown) {
  return String(value || '').toLowerCase();
}

function compact(value: unknown) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function matchesQuery(values: unknown[], query: string) {
  const needle = normalize(query).trim();
  const compactNeedle = compact(query);

  return values.some((value) => {
    const normalized = normalize(value);
    return normalized.includes(needle) || (compactNeedle.length > 0 && compact(value).includes(compactNeedle));
  });
}

function shortId(value: string | null | undefined) {
  if (!value) return '';
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export function AdminGlobalSearch({
  properties,
  tenants,
  applications,
  leases,
  payments,
  onNavigateTab,
  onOpenTenant,
}: AdminGlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const allResults: SearchResult[] = [
      ...tenants.map((tenant) => ({
        id: `tenant-${tenant.id}`,
        type: 'Tenant' as const,
        title: tenant.user?.full_name || tenant.user?.email || 'Unnamed tenant',
        detail: tenant.primary_property?.address || tenant.user?.email || 'No property assigned',
        meta: Number(tenant.current_balance || 0) > 0 ? `$${Number(tenant.current_balance).toLocaleString()} due` : 'Current',
        icon: Users,
        action: () => onOpenTenant(tenant.id),
      })),
      ...properties.map((property) => ({
        id: `property-${property.id}`,
        type: 'Property' as const,
        title: property.address,
        detail: `${property.city || ''}${property.state ? `, ${property.state}` : ''}`.trim() || 'Property',
        meta: property.status || 'property',
        icon: Home,
        action: () => onNavigateTab('properties'),
      })),
      ...payments.slice(0, 250).map((payment) => {
        const tenant = tenants.find((item) => item.id === payment.tenant_id);
        const property = properties.find((item) => item.id === payment.property_id);
        return {
          id: `payment-${payment.id}`,
          type: 'Payment' as const,
          title: `$${Number(payment.amount).toLocaleString()} ${payment.status}`,
          detail: tenant?.user?.full_name || property?.address || payment.stripe_payment_intent_id || payment.id,
          meta: shortId(payment.stripe_payment_intent_id || payment.stripe_session_id || payment.id),
          icon: Banknote,
          action: () => onNavigateTab('audit', {
            paymentFilter: payment.status === 'processing' && payment.payment_method_type === 'ach'
              ? 'processing-ach'
              : payment.status === 'completed'
                ? 'completed'
                : ['failed', 'canceled', 'requires_payment_method'].includes(payment.status)
                  ? 'failed'
                  : 'all',
          }),
        };
      }),
      ...applications.map((application) => ({
        id: `application-${application.id}`,
        type: 'Application' as const,
        title: application.profiles?.full_name || application.profiles?.email || 'Application',
        detail: application.properties?.address || 'Rental application',
        meta: application.status,
        icon: ClipboardList,
        action: () => onNavigateTab('applications'),
      })),
      ...leases.map((lease) => ({
        id: `lease-${lease.id}`,
        type: 'Lease' as const,
        title: lease.properties?.address || 'Lease',
        detail: lease.tenant?.full_name || lease.tenant?.email || 'Tenant lease',
        meta: lease.status,
        icon: FileText,
        action: () => onNavigateTab('leases'),
      })),
    ];

    const needle = normalize(query).trim();
    if (!needle) return allResults.slice(0, 10);

    return allResults
      .filter((result) => matchesQuery([result.type, result.title, result.detail, result.meta, result.id], needle))
      .slice(0, 12);
  }, [applications, leases, onNavigateTab, onOpenTenant, payments, properties, query, tenants]);

  const handleSelect = (result: SearchResult) => {
    result.action();
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="hidden h-10 min-w-[360px] justify-start gap-2 rounded-lg border-border/70 bg-card/70 text-xs text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_14px_40px_-30px_rgba(0,0,0,0.9)] hover:border-primary/35 hover:bg-card/90 lg:min-w-[430px] md:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        Search properties, tenants, leases, payments...
        <span className="ml-auto rounded border border-border/70 bg-background/45 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">⌘K</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Search admin records"
      >
        <Search className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl border-border/70 bg-card/95 p-0 backdrop-blur-xl">
          <DialogHeader className="border-b border-border/60 p-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-primary" />
              Search admin records
            </DialogTitle>
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tenant, property, payment ID, application, lease..."
              className="mt-3 h-11"
            />
          </DialogHeader>

          <div className="max-h-[440px] overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No matching records found.
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="rounded-lg border border-border/60 bg-background/50 p-2">
                      <result.icon className="h-4 w-4 text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{result.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{result.detail}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {result.meta && (
                        <Badge variant="outline" className="max-w-[120px] truncate">
                          {result.meta}
                        </Badge>
                      )}
                      <Badge variant="secondary">{result.type}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
