import { useRef, useState } from 'react';
import type { ElementType, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileSwipeActionTone = 'primary' | 'success' | 'warning' | 'danger' | 'muted';

export interface MobileSwipeAction {
  key: string;
  label: string;
  icon?: ElementType<{ className?: string }>;
  tone?: MobileSwipeActionTone;
  onClick: () => void;
}

interface MobileSwipeActionsProps {
  actions: MobileSwipeAction[];
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  contentClassName?: string;
  hasInteractiveChildren?: boolean;
  onTap?: () => void;
  resetLabel?: string;
}

const ACTION_WIDTH = 82;
const MAX_RAIL_WIDTH = 264;

const actionToneClass: Record<MobileSwipeActionTone, string> = {
  primary: 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15',
  success: 'border-success/25 bg-success/10 text-success hover:bg-success/15',
  warning: 'border-warning/25 bg-warning/10 text-warning hover:bg-warning/15',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15',
  muted: 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
};

export function MobileSwipeActions({
  actions,
  children,
  ariaLabel,
  className,
  contentClassName,
  hasInteractiveChildren = false,
  onTap,
  resetLabel = 'Reset',
}: MobileSwipeActionsProps) {
  const [offset, setOffset] = useState(0);
  const dragStart = useRef<{ x: number; y: number; pointerId: number; startOffset: number } | null>(null);
  const offsetRef = useRef(0);
  const hasHorizontalDrag = useRef(false);
  const suppressClick = useRef(false);

  const visibleActions = [
    ...actions,
    {
      key: 'reset',
      label: resetLabel,
      icon: RotateCcw,
      tone: 'muted' as const,
      onClick: () => setSwipeOffset(0),
    },
  ];
  const railWidth = Math.min(visibleActions.length * ACTION_WIDTH, MAX_RAIL_WIDTH);

  function setSwipeOffset(value: number) {
    const clamped = Math.min(0, Math.max(value, -railWidth));
    offsetRef.current = clamped;
    setOffset(clamped);
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      startOffset: offsetRef.current,
    };
    hasHorizontalDrag.current = false;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;

    const deltaX = event.clientX - dragStart.current.x;
    const deltaY = event.clientY - dragStart.current.y;

    if (!hasHorizontalDrag.current && Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      hasHorizontalDrag.current = true;
    }

    if (hasHorizontalDrag.current) {
      event.preventDefault();
      suppressClick.current = true;
      setSwipeOffset(dragStart.current.startOffset + deltaX);
    }
  };

  const finishDrag = (event?: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;

    event?.currentTarget.releasePointerCapture?.(dragStart.current.pointerId);
    const shouldOpen = Math.abs(offsetRef.current) > railWidth * 0.28;
    dragStart.current = null;
    hasHorizontalDrag.current = false;
    setSwipeOffset(shouldOpen ? -railWidth : 0);
  };

  const handleContentClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }

    if (offsetRef.current !== 0) {
      setSwipeOffset(0);
      return;
    }

    onTap?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && offsetRef.current !== 0) {
      event.preventDefault();
      setSwipeOffset(0);
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && onTap) {
      event.preventDefault();
      if (offsetRef.current !== 0) {
        setSwipeOffset(0);
      } else {
        onTap();
      }
    }
  };

  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)}>
      <div
        aria-hidden={offset === 0}
        className="absolute inset-y-0 right-0 flex items-stretch justify-end overflow-hidden rounded-xl border border-border/60 bg-muted/20"
        style={{ width: railWidth }}
      >
        {visibleActions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.key}
              type="button"
              className={cn(
                'flex min-h-[76px] flex-1 flex-col items-center justify-center gap-1 border-l px-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors',
                actionToneClass[action.tone || 'primary']
              )}
              onClick={(event) => {
                event.stopPropagation();
                action.onClick();
                setSwipeOffset(0);
              }}
              aria-label={action.label}
              tabIndex={offsetRef.current === 0 ? -1 : 0}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role={onTap && !hasInteractiveChildren ? 'button' : undefined}
        tabIndex={onTap && !hasInteractiveChildren ? 0 : undefined}
        aria-label={ariaLabel}
        className={cn('relative z-10 select-none touch-pan-y transition-transform duration-200', contentClassName)}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragStart.current ? 'none' : 'transform 180ms ease-out',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={handleContentClick}
        onKeyDown={hasInteractiveChildren ? undefined : handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
