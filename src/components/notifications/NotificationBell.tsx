import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from './NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

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

  // Reset new notification flag when opening the notification center
  useEffect(() => {
    if (open) {
      resetNewNotificationFlag();
    }
  }, [open, resetNewNotificationFlag]);

  const bellButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-10 w-10 rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary overflow-visible"
    >
      {/* Halo pulse layer - only when new notification arrives */}
      {hasNewNotification && (
        <span 
          className="absolute inset-0 rounded-lg bg-warning/20 animate-notification-halo pointer-events-none"
          aria-hidden="true"
        />
      )}
      
      {/* Bell icon */}
      <Bell className="h-5 w-5 relative z-10" />
      
      {/* Unread indicator dot - only when unreadCount > 0 */}
      {unreadCount > 0 && (
        <span
          className={cn(
            'absolute top-1.5 right-1.5 z-20',
            'flex items-center justify-center',
            'rounded-full bg-warning border-2 border-background',
            'shadow-sm',
            unreadCount < 10 
              ? 'h-2.5 w-2.5' 
              : 'h-4 min-w-4 px-1 text-[9px] font-bold text-warning-foreground'
          )}
        >
          {unreadCount >= 10 && (unreadCount > 99 ? '99+' : unreadCount)}
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
