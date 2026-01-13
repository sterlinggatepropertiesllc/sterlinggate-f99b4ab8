import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
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

export function OverdueRentAlert({ managerId }: OverdueRentAlertProps) {
  const { overdueTenants, count, isLoading } = useOverdueTenants(managerId);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Don't render anything if no overdue tenants
  if (isLoading || count === 0) {
    return null;
  }

  const handleTenantClick = (tenantId: string) => {
    setIsOpen(false);
    navigate(`/dashboard/tenant/${tenantId}?tab=balance`);
  };

  const OverdueList = () => (
    <div className="space-y-1">
      {overdueTenants.map((tenant) => (
        <button
          key={tenant.id}
          onClick={() => handleTenantClick(tenant.id)}
          className="w-full p-3 rounded-lg text-left transition-all duration-200 hover:bg-amber-500/10 group border border-transparent hover:border-amber-500/20"
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
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  ${tenant.amountOwed.toLocaleString()} overdue
                </span>
                <span className="text-xs text-muted-foreground">
                  • {tenant.daysOverdue} {tenant.daysOverdue === 1 ? 'day' : 'days'} past due
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-500 transition-colors flex-shrink-0" />
          </div>
        </button>
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
      {/* Outer pulsing halo */}
      <span className="absolute inset-0 rounded-full animate-overdue-amber-halo" />
      
      {/* Inner ring effect */}
      <span className="absolute inset-1 rounded-full animate-overdue-amber-ring" />
      
      {/* Icon container */}
      <span className="relative flex items-center justify-center h-full w-full rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors duration-200">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
      </span>
      
      {/* Badge */}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full overdue-badge-amber text-[11px] font-bold text-white px-1.5 animate-overdue-badge-glow">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Button>
  );

  // Use Sheet for mobile, Popover for desktop
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          {AlertButton}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
          <SheetHeader className="pb-4 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <SheetTitle className="text-lg">Overdue Rent Alerts</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {count} {count === 1 ? 'tenant' : 'tenants'} with overdue balances
                </p>
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="h-full py-4">
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
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
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
