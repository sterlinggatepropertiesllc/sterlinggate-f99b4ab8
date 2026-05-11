import { BellRing, CheckCircle2, Send, ShieldAlert, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePwaNotifications } from '@/hooks/usePwaNotifications';
import { showNativeAppNotification } from '@/lib/nativeNotifications';
import { cn } from '@/lib/utils';

interface PwaNotificationBannerProps {
  className?: string;
}

export function PwaNotificationBanner({ className }: PwaNotificationBannerProps) {
  const {
    enable,
    isBusy,
    isStandalone,
    isSubscribed,
    permission,
    support,
  } = usePwaNotifications();

  const isReady = permission === 'granted' && isSubscribed;
  const isIosInstallRequired = support.ios && !isStandalone;
  const isBlocked = permission === 'denied';

  if (isReady) return null;

  const title = isIosInstallRequired
    ? 'Install Sterling Gate to enable iPhone alerts'
    : isBlocked
      ? 'Notifications are blocked on this device'
      : 'Enable admin payment alerts';

  const detail = isIosInstallRequired
    ? 'On iPhone, open this site from Safari, tap Share, choose Add to Home Screen, then launch Sterling Gate from the new icon and tap Enable alerts.'
    : isBlocked
      ? 'Open iOS Settings, find Sterling Gate under Notifications, and allow alerts. Then return here to confirm the setup.'
      : support.ios
        ? 'iOS shows the native permission prompt after you tap a button inside the installed Home Screen app. This turns on payment, ACH, and failure alerts for this device.'
        : 'Tap Enable alerts to allow browser notifications for payment, ACH, and failure updates on this device.';

  const status = isIosInstallRequired
    ? 'Install required'
    : isBlocked
      ? 'Blocked'
      : permission === 'granted'
        ? 'Permission granted'
        : 'Action needed';

  const Icon = isIosInstallRequired ? Smartphone : isBlocked ? ShieldAlert : BellRing;

  const handleTestAlert = async () => {
    const shown = await showNativeAppNotification({
      id: 'sterling-admin-test-alert',
      type: 'rent_received',
      title: 'Sterling Gate test alert',
      message: 'Admin notifications are working on this device.',
    });

    if (shown) {
      toast.success('Test alert sent to this device.');
    } else {
      toast.error('Notifications are not enabled on this device yet.');
    }
  };

  return (
    <section
      className={cn(
        'ops-panel-soft border-primary/25 bg-primary/[0.045] p-3 shadow-[0_18px_60px_-45px_hsl(var(--primary)/0.55)] sm:p-4',
        className
      )}
      aria-label="Admin notification setup"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
              <Badge variant="secondary" className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                {status}
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {permission === 'granted' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestAlert}
              className="tap-feedback h-9 justify-center gap-2 border-border/70 bg-card/60 text-xs"
            >
              <Send className="h-3.5 w-3.5" />
              Send test
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={enable}
            disabled={isBusy || !support.secure}
            className="tap-feedback h-9 justify-center gap-2 bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {permission === 'granted' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
            {isBusy ? 'Checking...' : isIosInstallRequired ? 'Show steps' : permission === 'granted' ? 'Finish setup' : 'Enable alerts'}
          </Button>
        </div>
      </div>
    </section>
  );
}
