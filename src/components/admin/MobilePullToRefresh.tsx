import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRIGGER_DISTANCE = 72;
const MAX_PULL_DISTANCE = 108;

interface MobilePullToRefreshProps {
  children: React.ReactNode;
  enabled: boolean;
  isRefreshing: boolean;
  label?: string;
  onRefresh: () => Promise<void> | void;
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

export function MobilePullToRefresh({
  children,
  enabled,
  isRefreshing,
  label = 'Pull to refresh',
  onRefresh,
  scrollContainerRef,
}: MobilePullToRefreshProps) {
  const startYRef = React.useRef(0);
  const isPullingRef = React.useRef(false);
  const [pullDistance, setPullDistance] = React.useState(0);

  const getScrollTop = React.useCallback(() => {
    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer) {
      return scrollContainer.scrollTop;
    }

    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }, [scrollContainerRef]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!enabled || isRefreshing || getScrollTop() > 2) return;

    startYRef.current = event.touches[0]?.clientY || 0;
    isPullingRef.current = true;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isPullingRef.current || !enabled || isRefreshing) return;

    const currentY = event.touches[0]?.clientY || 0;
    const deltaY = currentY - startYRef.current;

    if (deltaY <= 0 || getScrollTop() > 2) {
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(MAX_PULL_DISTANCE, deltaY * 0.52));
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;

    const shouldRefresh = pullDistance >= TRIGGER_DISTANCE;
    isPullingRef.current = false;

    if (shouldRefresh && enabled && !isRefreshing) {
      try {
        await onRefresh();
      } finally {
        setPullDistance(0);
      }
      return;
    }

    setPullDistance(0);
  };

  if (!enabled) {
    return <>{children}</>;
  }

  const isArmed = pullDistance >= TRIGGER_DISTANCE;
  const showIndicator = pullDistance > 4 || isRefreshing;
  const indicatorOffset = isRefreshing ? 16 : Math.max(-16, pullDistance - 48);
  const progress = Math.min(1, pullDistance / TRIGGER_DISTANCE);

  return (
    <div
      className="relative min-h-full touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        aria-live="polite"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center transition-opacity duration-200',
          showIndicator ? 'opacity-100' : 'opacity-0'
        )}
        style={{ transform: `translate3d(0, ${indicatorOffset}px, 0)` }}
      >
        <div className="flex min-h-[40px] items-center gap-2 rounded-full border border-primary/30 bg-background px-3 text-[11px] font-medium text-muted-foreground shadow-[0_18px_50px_-28px_rgba(0,0,0,0.9)]">
          <span
            className="grid h-6 w-6 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary"
            style={{ transform: isRefreshing ? undefined : `rotate(${progress * 180}deg)` }}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          </span>
          {isRefreshing ? 'Refreshing...' : isArmed ? 'Release to refresh' : label}
        </div>
      </div>
      {children}
    </div>
  );
}
