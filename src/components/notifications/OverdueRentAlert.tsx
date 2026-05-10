import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, X, CheckCheck } from "lucide-react";
import { useOverdueTenants } from "@/hooks/useOverdueTenants";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

interface OverdueRentAlertProps {
  managerId: string | undefined;
}

interface OverdueAlertRowProps {
  tenant: {
    id: string;
    name: string;
    propertyAddress: string | null;
    amountOwed: number;
    daysOverdue: number;
  };
  isMobile: boolean;
  onTenantClick: (tenantId: string) => void;
  onDismiss: (tenantId: string, amount: number) => void;
}

function OverdueAlertRow({ tenant, isMobile, onTenantClick, onDismiss }: OverdueAlertRowProps) {
  const dragStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const dragDeltaRef = useRef(0);
  const hasHorizontalDrag = useRef(false);
  const suppressClick = useRef(false);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);

  const dismiss = () => {
    setIsDismissing(true);
    setTimeout(() => onDismiss(tenant.id, tenant.amountOwed), 180);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    dragStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    dragDeltaRef.current = 0;
    hasHorizontalDrag.current = false;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isMobile || !dragStart.current) return;

    const deltaX = event.clientX - dragStart.current.x;
    const deltaY = event.clientY - dragStart.current.y;

    if (!hasHorizontalDrag.current && Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      hasHorizontalDrag.current = true;
    }

    if (hasHorizontalDrag.current) {
      event.preventDefault();
      suppressClick.current = true;
      const clampedDelta = Math.max(Math.min(deltaX, 220), -220);
      dragDeltaRef.current = clampedDelta;
      setDragDelta(clampedDelta);
    }
  };

  const finishDrag = (event?: PointerEvent<HTMLDivElement>) => {
    if (!isMobile || !dragStart.current) return;

    event?.currentTarget.releasePointerCapture?.(dragStart.current.pointerId);
    const shouldDismiss = Math.abs(dragDeltaRef.current) > 84;
    dragStart.current = null;
    hasHorizontalDrag.current = false;

    if (shouldDismiss) {
      dismiss();
    } else {
      dragDeltaRef.current = 0;
      setDragDelta(0);
    }
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }

    onTenantClick(tenant.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onTenantClick(tenant.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        "relative overflow-hidden rounded-lg transition-all duration-200",
        isDismissing ? "translate-x-full opacity-0" : "",
      ].join(" ")}
    >
      {isMobile && dragDelta !== 0 && (
        <div
          className={[
            "absolute inset-y-0 flex items-center bg-amber-500/15 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400",
            dragDelta > 0 ? "left-0 justify-start" : "right-0 justify-end",
          ].join(" ")}
          style={{ width: Math.max(Math.abs(dragDelta), 64) }}
        >
          <X className="h-5 w-5" />
          {Math.abs(dragDelta) > 72 && <span className="ml-2">Dismiss</span>}
        </div>
      )}

      <div
        className={[
          "w-full p-3 rounded-lg text-left transition-all duration-200 hover:bg-amber-500/10 group border border-transparent hover:border-amber-500/20 cursor-pointer",
          isMobile ? "select-none touch-pan-y active:bg-amber-500/10" : "",
        ].join(" ")}
        style={{
          transform: isMobile ? `translateX(${dragDelta}px)` : undefined,
          transition: dragStart.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {tenant.name}
            </p>
            {tenant.propertyAddress && (
              <p className="text-sm text-muted-foreground truncate">
                {tenant.propertyAddress}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                ${tenant.amountOwed.toLocaleString()} overdue
              </span>
              <span className="text-xs text-muted-foreground">
                {tenant.daysOverdue} {tenant.daysOverdue === 1 ? "day" : "days"} past due
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                dismiss();
              }}
              className="h-8 w-8 rounded-full flex items-center justify-center opacity-100 transition-opacity hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100"
              title="Dismiss alert"
              aria-label={`Dismiss overdue alert for ${tenant.name}`}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OverdueRentAlert({ managerId }: OverdueRentAlertProps) {
  const { overdueTenants, count, isLoading, dismissAlert, clearAllAlerts } = useOverdueTenants(managerId);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (isLoading || count === 0) {
    return null;
  }

  const handleTenantClick = (tenantId: string) => {
    setIsOpen(false);
    navigate(`/dashboard/tenant/${tenantId}?tab=balance`);
  };

  const handlePanelTouchStart = (event: React.TouchEvent) => {
    touchStartY.current = event.touches[0].clientY;
  };

  const handlePanelTouchEnd = (event: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = event.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (deltaY > 90) setIsOpen(false);
  };

  const OverdueList = () => (
    <div className="space-y-1">
      {overdueTenants.map((tenant) => (
        <OverdueAlertRow
          key={tenant.id}
          tenant={tenant}
          isMobile={isMobile}
          onTenantClick={handleTenantClick}
          onDismiss={dismissAlert}
        />
      ))}
    </div>
  );

  const AlertButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-10 w-10 rounded-full overflow-visible group"
      aria-label={`${count} overdue rent alerts`}
    >
      <span className="absolute inset-0 rounded-full animate-overdue-amber-halo" />
      <span className="absolute inset-1 rounded-full animate-overdue-amber-ring" />
      <span className="relative flex items-center justify-center h-full w-full rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors duration-200">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
      </span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full overdue-badge-amber text-[11px] font-bold text-white px-1.5 animate-overdue-badge-glow">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          {AlertButton}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[76dvh] rounded-t-2xl border-amber-500/20 bg-card px-4 pb-4">
          <div
            className="touch-pan-y"
            onTouchStart={handlePanelTouchStart}
            onTouchEnd={handlePanelTouchEnd}
          >
            <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-muted-foreground/25" />
          </div>
          <SheetHeader className="border-b border-amber-500/20 px-0 pb-4 pt-3 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <SheetTitle className="text-base">Overdue Rent Alerts</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {count} {count === 1 ? 'tenant' : 'tenants'} with overdue balances
                  </p>
                  <p className="text-xs text-muted-foreground/75">
                    Swipe an alert sideways to dismiss it.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllAlerts}
                className="h-8 text-xs gap-1.5 text-muted-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Clear All
              </Button>
            </div>
          </SheetHeader>
          <ScrollArea className="h-[calc(76dvh-112px)] py-4">
            <OverdueList />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {AlertButton}
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-80 p-0 border-amber-500/20 shadow-lg shadow-amber-500/5"
        sideOffset={8}
      >
        <div className="p-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Overdue Rent Alerts</h4>
                <p className="text-xs text-muted-foreground">
                  {count} {count === 1 ? 'tenant' : 'tenants'} with overdue balances
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllAlerts}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Clear All
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          <div className="p-2">
            <OverdueList />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
