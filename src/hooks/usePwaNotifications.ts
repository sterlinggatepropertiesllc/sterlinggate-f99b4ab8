import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { registerSterlingServiceWorker } from '@/registerServiceWorker';
import { getPwaDisplayMode, isIosLikeDevice } from '@/lib/nativeNotifications';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type PushInsertClient = {
  from: (table: 'web_push_subscriptions') => {
    upsert: (
      value: Record<string, unknown>,
      options: { onConflict: string }
    ) => {
      select: (columns: string) => {
        single: () => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function serializeSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  };
}

export function usePwaNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'default' : Notification.permission
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

  const support = useMemo(() => ({
    serviceWorker: 'serviceWorker' in navigator,
    notification: 'Notification' in window,
    push: 'PushManager' in window,
    secure: window.isSecureContext,
    vapidConfigured: Boolean(vapidPublicKey),
    ios: isIosLikeDevice(),
  }), [vapidPublicKey]);

  const canUseNativePush = support.serviceWorker && support.notification && support.push && support.secure && support.vapidConfigured;

  const refreshState = useCallback(async () => {
    setIsStandalone(getPwaDisplayMode() === 'standalone');
    if ('Notification' in window) setPermission(Notification.permission);
    if (!canUseNativePush) return;

    const registration = await navigator.serviceWorker.ready.catch(() => null);
    const subscription = await registration?.pushManager.getSubscription();
    setIsSubscribed(Boolean(subscription));
  }, [canUseNativePush]);

  useEffect(() => {
    registerSterlingServiceWorker().then(() => refreshState());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', refreshState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', refreshState);
    };
  }, [refreshState]);

  const enable = useCallback(async () => {
    setIsBusy(true);
    try {
      const registration = await registerSterlingServiceWorker();

      if (!registration) {
        toast.error('App install support is unavailable in this browser context.');
        return;
      }

      if (installPrompt) {
        await installPrompt.prompt();
        setInstallPrompt(null);
      } else if (support.ios && getPwaDisplayMode() !== 'standalone') {
        toast.info('On iPhone, use Share -> Add to Home Screen, then open Sterling Gate from the new icon and tap App Alerts again.');
        return;
      }

      if (!support.notification) {
        toast.error('This browser does not support native notifications.');
        return;
      }

      let nextPermission = Notification.permission;
      if (nextPermission === 'default') {
        nextPermission = await Notification.requestPermission();
      }
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        toast.error('Native notifications are not enabled for this device.');
        return;
      }

      if (!support.push || !vapidPublicKey) {
        toast.success('Local app notifications are enabled. Background push is not available in this browser.');
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const serialized = serializeSubscription(subscription);

      if (!serialized.endpoint || !serialized.p256dh || !serialized.auth) {
        throw new Error('Browser returned an incomplete push subscription.');
      }

      if (user?.id) {
        const client = supabase as unknown as PushInsertClient;
        const { error } = await client
          .from('web_push_subscriptions')
          .upsert({
            user_id: user.id,
            endpoint: serialized.endpoint,
            p256dh: serialized.p256dh,
            auth: serialized.auth,
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'endpoint' })
          .select('id')
          .single();

        if (error) throw new Error(error.message);
      }

      setIsSubscribed(true);
      toast.success('Sterling Gate app alerts are enabled for this device.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to enable app alerts.';
      toast.error(message);
    } finally {
      setIsBusy(false);
      refreshState();
    }
  }, [installPrompt, refreshState, support.ios, support.notification, support.push, user?.id, vapidPublicKey]);

  return {
    canInstall: Boolean(installPrompt),
    canUseNativePush,
    enable,
    isBusy,
    isStandalone,
    isSubscribed,
    permission,
    refreshState,
    support,
  };
}
