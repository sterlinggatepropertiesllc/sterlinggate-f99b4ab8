import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type AdminTone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'teal';

const toneClasses: Record<AdminTone, { text: string; border: string; bg: string; bar: string }> = {
  neutral: {
    text: 'text-muted-foreground',
    border: 'border-border/70',
    bg: 'bg-muted/20',
    bar: 'bg-muted-foreground/50',
  },
  gold: {
    text: 'text-primary',
    border: 'border-primary/35',
    bg: 'bg-primary/10',
    bar: 'bg-primary',
  },
  success: {
    text: 'text-success',
    border: 'border-success/30',
    bg: 'bg-success/10',
    bar: 'bg-success',
  },
  warning: {
    text: 'text-warning',
    border: 'border-warning/30',
    bg: 'bg-warning/10',
    bar: 'bg-warning',
  },
  danger: {
    text: 'text-destructive',
    border: 'border-destructive/30',
    bg: 'bg-destructive/10',
    bar: 'bg-destructive',
  },
  teal: {
    text: 'text-success',
    border: 'border-success/30',
    bg: 'bg-success/10',
    bar: 'bg-success',
  },
};

export function getAdminToneClasses(tone: AdminTone = 'neutral') {
  return toneClasses[tone];
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
    </section>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn('ops-panel', className)}>
      {(title || subtitle || action) && (
        <div className="flex flex-col gap-3 border-b border-border/55 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn('p-4', contentClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = 'neutral',
  progress,
  actionLabel,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: AdminTone;
  progress?: number;
  actionLabel?: string;
  onClick?: () => void;
  className?: string;
}) {
  const toneClass = getAdminToneClasses(tone);
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className={cn('mt-0.5 h-1.5 w-8 rounded-full', toneClass.bar)} />
      </div>
      <div className="mt-3 text-2xl font-semibold leading-none tracking-tight text-foreground">{value}</div>
      {detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>}
      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/65">
          <div className={cn('h-full rounded-full', toneClass.bar)} style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
        </div>
      )}
      {actionLabel && (
        <span className={cn('mt-3 inline-flex items-center gap-1 text-[11px] font-medium', toneClass.text)}>
          {actionLabel}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn('ops-panel tap-feedback group min-h-[104px] w-full p-4 text-left transition-colors hover:border-primary/35', className)}
      >
        {content}
      </button>
    );
  }

  return <div className={cn('ops-panel group min-h-[104px] w-full p-4 text-left', className)}>{content}</div>;
}

export function AdminStatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: AdminTone;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass = getAdminToneClasses(tone);
  return (
    <Badge
      variant="outline"
      className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium capitalize', toneClass.border, toneClass.bg, toneClass.text, className)}
    >
      {children}
    </Badge>
  );
}

export function FilterTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="mobile-scroll-x flex flex-nowrap items-center gap-2 sm:flex-wrap sm:overflow-visible">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(item.id)}
          className={cn(
            'h-8 shrink-0 rounded-md border px-3 text-[11px]',
            value === item.id
              ? 'border-primary/45 bg-primary/15 text-primary hover:bg-primary/20'
              : 'border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/25 hover:text-primary'
          )}
        >
          {item.label}
          {typeof item.count === 'number' && <span className="ml-2 rounded-full bg-background/55 px-1.5 py-0.5 text-[10px]">{item.count}</span>}
        </Button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('ops-panel border-dashed p-10 text-center', className)}>
      <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-primary/70" />
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function AdminButton({
  children,
  className,
  variant = 'primary',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'variant'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const variantClass = {
    primary: 'border border-primary/40 bg-primary/15 text-primary hover:bg-primary/22 hover:text-primary',
    secondary: 'border border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/25 hover:text-foreground',
    ghost: 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
    danger: 'border border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive',
  }[variant];

  return (
    <Button {...props} variant="ghost" className={cn('tap-feedback h-9 rounded-md px-3 text-xs font-medium', variantClass, className)}>
      {children}
    </Button>
  );
}
