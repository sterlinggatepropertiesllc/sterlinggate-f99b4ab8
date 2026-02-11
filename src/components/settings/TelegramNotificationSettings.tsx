import { Bot, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useTelegramNotificationPrefs } from '@/hooks/useTelegramNotificationPrefs';

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

export function TelegramNotificationSettings() {
  const { topics, chatLinked, loading, togglePref, isEnabled } =
    useTelegramNotificationPrefs();

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
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
        <Bot className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Bot Connection</p>
          <p className="text-xs text-muted-foreground">
            {chatLinked
              ? 'Your Telegram is linked and receiving notifications'
              : 'Send /start to the Sterling Gate bot to enable notifications'}
          </p>
        </div>
        {chatLinked ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Linked
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            Not linked
          </Badge>
        )}
      </div>

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
