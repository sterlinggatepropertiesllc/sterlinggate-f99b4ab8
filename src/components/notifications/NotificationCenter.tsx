import { Bell, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationItem } from './NotificationItem';
import { Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  notifications: Notification[];
  loading: boolean;
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigate?: (notification: Notification) => void;
  isMobile?: boolean;
}

export function NotificationCenter({
  notifications,
  loading,
  onDismiss,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigate,
  isMobile
}: NotificationCenterProps) {
  const hasUnread = notifications.some(n => !n.is_read);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Bell className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">All caught up!</p>
        <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header actions */}
      <div className={cn(
        'flex border-b border-border/50 px-4 py-2',
        isMobile ? 'flex-col gap-2' : 'items-center justify-between'
      )}>
        <div>
          <p className="text-sm font-medium text-foreground">
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </p>
          {isMobile && (
            <p className="text-xs text-muted-foreground">
              Tap to open. Swipe left or right to dismiss.
            </p>
          )}
        </div>
        <div className={cn('flex items-center gap-1', isMobile && 'rounded-xl bg-muted/30 p-1')}>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              className={cn('h-8 text-xs gap-1.5', isMobile && 'flex-1')}
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className={cn(
              'h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10',
              isMobile && 'flex-1'
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </Button>
        </div>
      </div>

      {/* Notification list */}
      <ScrollArea className="flex-1">
        <div className={cn(isMobile ? 'space-y-2 p-3' : 'divide-y divide-border/30')}>
          {notifications.map((notification) => (
            <div key={notification.id} className="group">
              <NotificationItem
                notification={notification}
                onDismiss={onDismiss}
                onMarkAsRead={onMarkAsRead}
                onNavigate={onNavigate}
                isMobile={isMobile}
              />
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Mobile swipe hint */}
      {isMobile && notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Swipe left or right to dismiss
          </p>
        </div>
      )}
    </div>
  );
}
