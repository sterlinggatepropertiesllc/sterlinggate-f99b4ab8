import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronRight,
  FilePlus2,
  Home,
  Plus,
  RefreshCw,
  Receipt,
  UserPlus,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { AdminDashboardTab, AdminNavigate } from './adminTypes';

export interface MobileAdminNavItem {
  id: AdminDashboardTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface MobileAdminNavigationProps {
  activeTab: AdminDashboardTab;
  isRefreshing?: boolean;
  navItems: MobileAdminNavItem[];
  onAddProperty: () => void;
  onAddTenant: () => void;
  onCreateLease: () => void;
  onNavigateTab: AdminNavigate;
  onRecordPayment: () => void;
  onRefresh: () => Promise<void> | void;
}

interface MobileAction {
  label: string;
  detail: string;
  icon: LucideIcon;
  onClick: () => void;
}

function formatBadge(value?: number) {
  if (!value || value <= 0) return null;
  return value > 99 ? '99+' : String(value);
}

function ActionTile({ action, onClose }: { action: MobileAction; onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onClose();
        action.onClick();
      }}
      className="tap-feedback group flex min-h-[68px] items-center gap-3 rounded-2xl border border-border/70 bg-card/70 p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/10"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <action.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{action.label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{action.detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function MobileTabButton({
  item,
  isActive,
  onClick,
}: {
  item: MobileAdminNavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const badge = formatBadge(item.badge);

  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'tap-feedback relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-medium transition-colors',
        isActive
          ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.24)]'
          : 'text-muted-foreground hover:bg-muted/25 hover:text-foreground'
      )}
    >
      <span className="relative">
        <item.icon className="h-4 w-4" />
        {badge && (
          <span className="absolute -right-2.5 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
            {badge}
          </span>
        )}
      </span>
      <span className="max-w-[58px] truncate">{item.label}</span>
    </button>
  );
}

export function MobileAdminNavigation({
  activeTab,
  isRefreshing = false,
  navItems,
  onAddProperty,
  onAddTenant,
  onCreateLease,
  onNavigateTab,
  onRecordPayment,
  onRefresh,
}: MobileAdminNavigationProps) {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const findNavItem = React.useCallback(
    (tab: AdminDashboardTab) => navItems.find((item) => item.id === tab),
    [navItems]
  );

  const dashboardItem = findNavItem('overview');
  const propertiesItem = findNavItem('properties');
  const tenantsItem = findNavItem('tenants');
  const paymentsItem = findNavItem('audit');
  const bottomItems = [dashboardItem, propertiesItem, tenantsItem, paymentsItem].filter(Boolean) as MobileAdminNavItem[];

  const actions = React.useMemo<MobileAction[]>(
    () => [
      {
        label: 'Add Property',
        detail: 'Create a new portfolio record',
        icon: Home,
        onClick: onAddProperty,
      },
      {
        label: 'Add Tenant',
        detail: 'Invite or attach a renter',
        icon: UserPlus,
        onClick: onAddTenant,
      },
      {
        label: 'Create Lease',
        detail: 'Start a signing workflow',
        icon: FilePlus2,
        onClick: onCreateLease,
      },
      {
        label: 'Record Payment',
        detail: 'Open a tenant ledger',
        icon: WalletCards,
        onClick: onRecordPayment,
      },
    ],
    [onAddProperty, onAddTenant, onCreateLease, onRecordPayment]
  );

  const primaryAction = React.useMemo<MobileAction | null>(() => {
    if (activeTab === 'overview') {
      return {
        label: 'Open command drawer',
        detail: 'Add, record, or jump to a workspace',
        icon: Plus,
        onClick: () => setIsDrawerOpen(true),
      };
    }

    if (activeTab === 'properties') return actions[0];
    if (activeTab === 'tenants') return actions[1];
    if (activeTab === 'leases') return actions[2];
    if (activeTab === 'audit') return actions[3];

    return null;
  }, [actions, activeTab]);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden">
        <div className="pointer-events-auto px-3 pb-2">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="tap-feedback mb-2 flex min-h-[52px] w-full items-center gap-3 rounded-[1.15rem] border border-primary/35 bg-background px-3 text-left text-primary shadow-[0_18px_60px_-32px_hsl(var(--primary)/0.72)]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15">
                <primaryAction.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{primaryAction.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{primaryAction.detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          )}

          <nav
            aria-label="Mobile admin navigation"
            className="safe-area-bottom rounded-[1.35rem] border border-border/75 bg-background p-1.5 shadow-[0_24px_70px_-34px_rgba(0,0,0,0.96)]"
          >
            <div className="grid grid-cols-5 items-center gap-1">
              {bottomItems.slice(0, 2).map((item) => (
                <MobileTabButton
                  key={item.id}
                  item={item}
                  isActive={activeTab === item.id}
                  onClick={() => onNavigateTab(item.id)}
                />
              ))}

              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="tap-feedback mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/35 bg-primary text-primary-foreground shadow-[0_12px_34px_-18px_hsl(var(--primary)/0.9)]"
                aria-label="Open mobile actions"
              >
                <Plus className="h-5 w-5" />
              </button>

              {bottomItems.slice(2).map((item) => (
                <MobileTabButton
                  key={item.id}
                  item={item}
                  isActive={activeTab === item.id}
                  onClick={() => onNavigateTab(item.id)}
                />
              ))}
            </div>
          </nav>
        </div>
      </div>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent
          side="bottom"
          className="safe-area-bottom rounded-t-[1.75rem] border-border/80 bg-background p-4 pb-5 shadow-[0_-24px_70px_-36px_rgba(0,0,0,0.95)]"
        >
          <SheetHeader className="pr-10 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Mobile Command</p>
            <SheetTitle className="text-xl">Choose an admin action.</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Open core admin workflows or jump to another workspace.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-foreground">Primary actions</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="h-9 rounded-full border-border/70 bg-card/70 px-3 text-[11px]"
                >
                  <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                  {isRefreshing ? 'Refreshing' : 'Refresh'}
                </Button>
              </div>
              <div className="grid gap-2">
                {actions.map((action) => (
                  <ActionTile key={action.label} action={action} onClose={() => setIsDrawerOpen(false)} />
                ))}
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold text-foreground">Go to</p>
              <div className="grid grid-cols-2 gap-2">
                {navItems.map((item) => {
                  const badge = formatBadge(item.badge);
                  const isActive = item.id === activeTab;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onNavigateTab(item.id);
                      }}
                      className={cn(
                        'tap-feedback flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm transition-colors',
                        isActive
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-border/65 bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {badge ? (
                        <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
                          {badge}
                        </span>
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-55" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <button
              type="button"
              onClick={() => {
                setIsDrawerOpen(false);
                onNavigateTab('audit', { paymentFilter: 'all' });
              }}
              className="tap-feedback flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-3 text-left text-primary"
            >
              <span className="flex items-center gap-3">
                <Receipt className="h-4 w-4" />
                <span>
                  <span className="block text-sm font-semibold">Payment Control Center</span>
                  <span className="block text-[11px] text-muted-foreground">Review ACH, failed, and completed payments.</span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
