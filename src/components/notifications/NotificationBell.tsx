import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function NotificationBell() {
  const {
    notifications,
    loading,
    unreadCount,
    hasNewNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    resetNewNotificationFlag
  } = useNotifications();

  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Reset new notification flag when opening the notification center
  useEffect(() => {
    if (open) {
      resetNewNotificationFlag();
    }
  }, [open, resetNewNotificationFlag]);

  // Handle notification click - navigate to relevant section
  const handleNotificationClick = useCallback((notification: Notification) => {
    // Close the notification panel
    setOpen(false);
    
    // Determine which dashboard we're on
    const isAdminDashboard = location.pathname === '/dashboard';
    const isTenantPortal = location.pathname.startsWith('/tenant');
    
    // Map notification type to tab
    let targetTab = '';
    switch (notification.type) {
      case 'application_received':
        targetTab = 'applications';
        break;
      case 'application_approved':
      case 'application_rejected':
        targetTab = 'applications';
        break;
      case 'rent_received':
        targetTab = isTenantPortal ? 'payments' : 'audit';
        break;
      case 'lease_signed':
        targetTab = 'leases';
        break;
      case 'message_received':
        targetTab = 'messages';
        break;
      case 'maintenance_request':
        targetTab = 'properties';
        break;
      default:
        return;
    }
    
    // Navigate with query param to set the tab
    if (isAdminDashboard) {
      navigate(`/dashboard?tab=${targetTab}`);
    } else if (isTenantPortal) {
      navigate(`/tenant?tab=${targetTab}`);
    }
  }, [location.pathname, navigate]);

  const bellButton = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "relative h-10 w-10 rounded-lg transition-all duration-300 hover:bg-primary/10 hover:text-primary overflow-visible",
        unreadCount > 0 && "animate-notification-gold-ring"
      )}
    >
      {/* Expanding gold halo - only when new notification arrives */}
      {hasNewNotification && (
        <span 
          className="absolute inset-0 rounded-lg animate-notification-gold-halo pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,193,7,0.3) 0%, rgba(255,193,7,0) 70%)' }}
          aria-hidden="true"
        />
      )}
      
      {/* Bell icon with gold shimmer when has notifications */}
      <Bell 
        className={cn(
          "h-5 w-5 relative z-10 transition-colors duration-300",
          unreadCount > 0 && "text-amber-400"
        )} 
      />
      
      {/* Premium gold badge with count - always shows count when unreadCount > 0 */}
      {unreadCount > 0 && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 z-20',
            'flex items-center justify-center',
            'rounded-full notification-badge-gold',
            'border-2 border-background',
            'animate-notification-badge-glow',
            'min-w-5 h-5 px-1.5',
            'text-[10px] font-bold'
          )}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  );

  const notificationContent = (
    <NotificationCenter
      notifications={notifications}
      loading={loading}
      onDismiss={deleteNotification}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onClearAll={clearAll}
      onNavigate={handleNotificationClick}
      isMobile={isMobile}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {bellButton}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0">
          <SheetHeader className="px-4 py-4 border-b border-border/50">
            <SheetTitle className="text-lg font-serif">Notifications</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-60px)]">
            {notificationContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {bellButton}
      </PopoverTrigger>
      <PopoverContent 
        className="w-[380px] p-0 shadow-xl border-border/50" 
        align="end"
        sideOffset={8}
      >
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <h3 className="font-serif font-medium text-foreground">Notifications</h3>
        </div>
        <div className="max-h-[400px] overflow-hidden">
          {notificationContent}
        </div>
      </PopoverContent>
    </Popover>
  );
}
