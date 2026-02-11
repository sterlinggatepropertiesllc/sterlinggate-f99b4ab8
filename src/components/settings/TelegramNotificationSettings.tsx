import { Bell, Bot, CheckCircle2, ExternalLink, Loader2, Send } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTelegramNotificationPrefs } from '@/hooks/useTelegramNotificationPrefs';
import { useTelegram } from '@/contexts/TelegramContext';

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'SterlingGateBot';

const TOPIC_ICONS: Record<string, string> = {
  RENT_RECEIVED: '✅',
  RENT_PAST_DUE: '⚠️',
  RENT_PARTIAL_PAYMENT: '💰',
  ACH_INITIATED: '🏦',
  ACH_CLEARED: '✅',
  NEW_APPLICATION_RECEIVED: '📋',
  LEASE_SIGNED: '📝',
  WORK_ORDER_CREATED: '🔧',
  WORK_ORDER_OVERDUE: '⏰',
  SYSTEM_ALERT: '🚨',
  RENT_DUE_REMINDER: '📅',
  RENT_PAST_DUE_NOTICE: '⚠️',
  PAYMENT_RECEIVED_CONFIRMATION: '✅',
  PAYMENT_FAILED: '❌',
  LEASE_RENEWAL_REMINDER: '📝',
  WORK_ORDER_STATUS_UPDATE: '🔧',
  MESSAGE_FROM_MANAGER: '💬',
};

function handleConnect() {
  const deepLink = `https://t.me/${BOT_USERNAME}?start=connect`;
  const tg = (window as any).Telegram?.WebApp;

  if (tg?.openTelegramLink) {
    tg.openTelegramLink(deepLink);
  } else {
    window.open(deepLink, '_blank');
  }
}

export function TelegramNotificationSettings() {
  const { topics, chatLinked, loading, togglePref, isEnabled } =
    useTelegramNotificationPrefs();
  const { isTelegram } = useTelegram();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {chatLinked ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <Bot className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Telegram Connected</p>
            <p className="text-xs text-muted-foreground">
              Your Telegram is linked and receiving notifications
            </p>
          </div>
          <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </Badge>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Enable Telegram Notifications</CardTitle>
            </div>
            <CardDescription>
              Connect your Telegram chat to receive rent alerts, payment updates, and important notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleConnect} className="w-full gap-2">
              {isTelegram ? (
                <Send className="h-4 w-4" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Connect Telegram
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              You will only need to do this once.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Topic Toggles */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Notification Topics
        </h4>
        {topics.map((topic) => (
          <div
            key={topic.key}
            className="flex items-center justify-between py-2 px-1"
          >
            <Label
              htmlFor={`tg-${topic.key}`}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <span>{TOPIC_ICONS[topic.key] || '🔔'}</span>
              <span>{topic.description}</span>
            </Label>
            <Switch
              id={`tg-${topic.key}`}
              checked={isEnabled(topic.key)}
              onCheckedChange={(checked) => togglePref(topic.key, checked)}
              disabled={!chatLinked}
            />
          </div>
        ))}
      </div>

      {!chatLinked && (
        <p className="text-xs text-muted-foreground text-center">
          Connect your Telegram bot first to manage notification preferences
        </p>
      )}
    </div>
  );
}
