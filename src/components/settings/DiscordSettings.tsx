import { useState } from 'react';
import { ExternalLink, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NotificationSettings } from '@/hooks/useNotificationSettings';

interface DiscordSettingsProps {
  settings: NotificationSettings;
  saving: boolean;
  onUpdate: (updates: Partial<NotificationSettings>) => void;
  onTestWebhook: () => void;
}

const notificationTypes = [
  { key: 'notify_application_received', label: 'New applications', description: 'When someone applies for a property' },
  { key: 'notify_application_approved', label: 'Application approved', description: 'When your application is approved' },
  { key: 'notify_application_rejected', label: 'Application declined', description: 'When your application is declined' },
  { key: 'notify_rent_received', label: 'Rent received', description: 'When a rent payment is received' },
  { key: 'notify_maintenance_request', label: 'Maintenance requests', description: 'When a maintenance request is submitted' },
  { key: 'notify_lease_signed', label: 'Lease signed', description: 'When a lease is signed' },
  { key: 'notify_message_received', label: 'New messages', description: 'When you receive a new message' },
] as const;

export function DiscordSettings({ settings, saving, onUpdate, onTestWebhook }: DiscordSettingsProps) {
  const [webhookUrl, setWebhookUrl] = useState(settings.discord_webhook_url || '');
  const [isTesting, setIsTesting] = useState(false);

  const handleWebhookSave = () => {
    onUpdate({ discord_webhook_url: webhookUrl || null });
  };

  const handleTest = async () => {
    setIsTesting(true);
    await onTestWebhook();
    setIsTesting(false);
  };

  return (
    <div className="space-y-6">
      {/* Discord Enable Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">Discord Notifications</Label>
          <p className="text-sm text-muted-foreground">
            Send notifications to a Discord channel via webhook
          </p>
        </div>
        <Switch
          checked={settings.discord_enabled}
          onCheckedChange={(checked) => onUpdate({ discord_enabled: checked })}
          disabled={saving}
        />
      </div>

      {settings.discord_enabled && (
        <>
          {/* Webhook URL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <a
                href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                How to create a webhook
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleWebhookSave}
                disabled={saving || webhookUrl === (settings.discord_webhook_url || '')}
              >
                Save
              </Button>
            </div>
            {settings.discord_webhook_url && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTest}
                disabled={isTesting}
                className="gap-2"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send test notification
              </Button>
            )}
          </div>

          {/* Notification Type Toggles */}
          <div className="space-y-3">
            <Label className="text-base">Notification Types</Label>
            <p className="text-sm text-muted-foreground">
              Choose which notifications to send to Discord
            </p>
            <div className="space-y-2">
              {notificationTypes.map((type) => (
                <div
                  key={type.key}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                  <Switch
                    checked={settings[type.key]}
                    onCheckedChange={(checked) => onUpdate({ [type.key]: checked })}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
