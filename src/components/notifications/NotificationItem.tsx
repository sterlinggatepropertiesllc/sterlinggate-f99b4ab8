import { useState, useRef } from 'react';
import { X, FileText, DollarSign, Wrench, FileSignature, MessageSquare, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification, NotificationType } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onNavigate?: (notification: Notification) => void;
  isMobile?: boolean;
}

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  application_received: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  application_approved: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
  application_rejected: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  rent_received: { icon: DollarSign, color: 'text-success', bg: 'bg-success/10' },
  maintenance_request: { icon: Wrench, color: 'text-warning', bg: 'bg-warning/10' },
  lease_signed: { icon: FileSignature, color: 'text-primary', bg: 'bg-primary/10' },
  message_received: { icon: MessageSquare, color: 'text-accent-foreground', bg: 'bg-accent/10' },
};

export function NotificationItem({ notification, onDismiss, onMarkAsRead, onNavigate, isMobile }: NotificationItemProps) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const config = typeConfig[notification.type] || typeConfig.application_received;
  const Icon = config.icon;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || touchStart === null) return;
    const currentX = e.touches[0].clientX;
    const delta = currentX - touchStart;
    // Only allow swiping right (positive delta)
    if (delta > 0) {
      setTouchDelta(Math.min(delta, 200));
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    
    if (touchDelta > 100) {
      setIsDismissing(true);
      setTimeout(() => onDismiss(notification.id), 200);
    } else {
      setTouchDelta(0);
    }
    setTouchStart(null);
  };

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    // Navigate to the relevant section
    onNavigate?.(notification);
  };

  return (
    <div
      ref={itemRef}
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        isDismissing && 'opacity-0 translate-x-full'
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {/* Swipe background indicator */}
      {isMobile && touchDelta > 0 && (
        <div 
          className="absolute inset-y-0 left-0 bg-destructive/20 flex items-center justify-start pl-4"
          style={{ width: touchDelta }}
        >
          <X className="h-5 w-5 text-destructive" />
        </div>
      )}

      <div
        className={cn(
          'flex items-start gap-3 p-4 border-b border-border/50 transition-colors cursor-pointer',
          !notification.is_read && 'bg-primary/5',
          'hover:bg-muted/50'
        )}
        style={{ 
          transform: isMobile ? `translateX(${touchDelta}px)` : undefined,
          transition: touchStart !== null ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {/* Icon */}
        <div className={cn('p-2 rounded-lg shrink-0', config.bg)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm font-medium truncate',
              !notification.is_read && 'text-foreground',
              notification.is_read && 'text-muted-foreground'
            )}>
              {notification.title}
            </p>
            {!isMobile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(notification.id);
                }}
                className="p-1 rounded-md hover:bg-muted transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {timeAgo}
          </p>
        </div>

        {/* Navigation indicator + Unread indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!notification.is_read && (
            <div className="w-2 h-2 rounded-full bg-primary" />
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </div>
    </div>
  );
}
