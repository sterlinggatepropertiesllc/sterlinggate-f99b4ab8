import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { X, FileText, DollarSign, Wrench, FileSignature, MessageSquare, CheckCircle, XCircle, ChevronRight, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
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
  payment_received: { icon: DollarSign, color: 'text-success', bg: 'bg-success/10' },
  payment_processing: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
  payment_failed: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  payment_incomplete: { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10' },
  payment_late: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  payment_missing: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  maintenance_request: { icon: Wrench, color: 'text-warning', bg: 'bg-warning/10' },
  lease_signed: { icon: FileSignature, color: 'text-primary', bg: 'bg-primary/10' },
  message_received: { icon: MessageSquare, color: 'text-accent-foreground', bg: 'bg-accent/10' },
  inquiry_received: { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
};

function getNotificationConfig(notification: Notification) {
  if (notification.type !== 'rent_received') {
    return typeConfig[notification.type] || typeConfig.application_received;
  }

  const stripeStatus = String(notification.metadata?.stripe_status || notification.metadata?.tenant_payment_status || '').toLowerCase();
  const title = notification.title.toLowerCase();

  if (stripeStatus === 'processing' || title.includes('processing') || title.includes('initiated')) {
    return { icon: Clock, color: 'text-warning', bg: 'bg-warning/10' };
  }

  if (stripeStatus === 'requires_payment_method' || title.includes('incomplete')) {
    return { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10' };
  }

  if (stripeStatus === 'payment_failed' || title.includes('failed') || title.includes('did not clear')) {
    return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' };
  }

  return typeConfig.rent_received;
}

export function NotificationItem({ notification, onDismiss, onMarkAsRead, onNavigate, isMobile }: NotificationItemProps) {
  const dragStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const hasHorizontalDrag = useRef(false);
  const suppressClick = useRef(false);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const config = getNotificationConfig(notification);
  const Icon = config.icon;
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    dragStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
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
      setDragDelta(Math.max(Math.min(deltaX, 220), -220));
    }
  };

  const finishDrag = (event?: PointerEvent<HTMLDivElement>) => {
    if (!isMobile || !dragStart.current) return;

    event?.currentTarget.releasePointerCapture?.(dragStart.current.pointerId);
    const shouldDismiss = Math.abs(dragDelta) > 84;
    dragStart.current = null;
    hasHorizontalDrag.current = false;

    if (shouldDismiss) {
      setIsDismissing(true);
      setTimeout(() => onDismiss(notification.id), 200);
    } else {
      setDragDelta(0);
    }
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClick={handleClick}
    >
      {/* Swipe background indicator */}
      {isMobile && dragDelta !== 0 && (
        <div
          className={cn(
            'absolute inset-y-0 flex items-center bg-destructive/20 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-destructive',
            dragDelta > 0 ? 'left-0 justify-start' : 'right-0 justify-end'
          )}
          style={{ width: Math.max(Math.abs(dragDelta), 64) }}
        >
          <X className="h-5 w-5 text-destructive" />
          {Math.abs(dragDelta) > 72 && <span className="ml-2">Dismiss</span>}
        </div>
      )}

      <div
        className={cn(
          'flex items-start gap-3 p-4 border-b border-border/50 transition-colors cursor-pointer',
          !notification.is_read && 'bg-primary/5',
          'hover:bg-muted/50',
          isMobile && 'select-none touch-pan-y'
        )}
        style={{ 
          transform: isMobile ? `translateX(${dragDelta}px)` : undefined,
          transition: dragStart.current ? 'none' : 'transform 0.2s ease-out'
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
