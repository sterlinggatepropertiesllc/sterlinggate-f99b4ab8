import { BellRing, CheckCircle2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePwaNotifications } from '@/hooks/usePwaNotifications';

export function PwaInstallPrompt() {
  const {
    canInstall,
    enable,
    isBusy,
    isStandalone,
    isSubscribed,
    permission,
    support,
  } = usePwaNotifications();

  const isReady = permission === 'granted' && isSubscribed;
  const shouldShow = canInstall || !isReady || (support.ios && !isStandalone);

  if (!shouldShow) return null;

  const label = isReady
    ? 'App Alerts On'
    : support.ios && !isStandalone
      ? 'Install App'
      : 'App Alerts';

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={enable}
      disabled={isBusy || !support.secure}
      className={cn(
        'inline-flex h-9 w-9 rounded-lg border border-border/60 bg-card/70 px-0 text-xs text-muted-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-primary md:h-10 md:w-auto md:px-3',
        isReady && 'border-success/30 bg-success/10 text-success hover:text-success'
      )}
      aria-label={label}
      title={support.secure ? label : 'App alerts require HTTPS'}
    >
      {isReady ? <CheckCircle2 className="h-4 w-4 md:mr-2" /> : support.ios && !isStandalone ? <Smartphone className="h-4 w-4 md:mr-2" /> : <BellRing className="h-4 w-4 md:mr-2" />}
      <span className="hidden md:inline">{isBusy ? 'Enabling...' : label}</span>
    </Button>
  );
}
