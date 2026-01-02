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
      className={cn(
        'relative h-10 w-10 rounded-lg transition-all duration-200',
        'hover:bg-primary/10 hover:text-primary',
        hasNewNotification && 'animate-gold-glow'
      )}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span 
          className={cn(
            'absolute top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full',
            'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600',
            'text-amber-950 text-[10px] font-bold',
            'flex items-center justify-center px-1',
            'shadow-[0_0_8px_rgba(251,191,36,0.6)]',
            hasNewNotification && 'animate-gold-pulse'
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
