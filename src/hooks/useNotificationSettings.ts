import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface NotificationSettings {
  id: string;
  user_id: string;
  discord_webhook_url: string | null;
  discord_enabled: boolean;
  notify_application_received: boolean;
  notify_application_approved: boolean;
  notify_application_rejected: boolean;
  notify_rent_received: boolean;
  notify_maintenance_request: boolean;
  notify_lease_signed: boolean;
  notify_message_received: boolean;
  created_at: string;
  updated_at: string;
}

const defaultSettings: Omit<NotificationSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  discord_webhook_url: null,
  discord_enabled: false,
  notify_application_received: true,
  notify_application_approved: true,
  notify_application_rejected: true,
  notify_rent_received: true,
  notify_maintenance_request: true,
  notify_lease_signed: true,
  notify_message_received: true,
};

export function useNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as NotificationSettings);
      } else {
        // Create default settings if they don't exist
        const { data: newData, error: insertError } = await supabase
          .from('notification_settings')
          .insert({ user_id: user.id, ...defaultSettings })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newData as NotificationSettings);
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateSettings = useCallback(async (updates: Partial<NotificationSettings>) => {
    if (!user || !settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => prev ? { ...prev, ...updates } : null);
      toast({
        title: 'Settings saved',
        description: 'Your notification settings have been updated.',
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [user, settings]);

  const testDiscordWebhook = useCallback(async () => {
    if (!settings?.discord_webhook_url) {
      toast({
        title: 'No webhook URL',
        description: 'Please enter a Discord webhook URL first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await supabase.functions.invoke('send-discord-notification', {
        body: {
          webhook_url: settings.discord_webhook_url,
          title: '🔔 Test Notification',
          message: 'Your Discord webhook is connected successfully!',
          type: 'test',
          color: 0x10b981, // Green
        }
      });

      if (response.error) throw response.error;

      toast({
        title: 'Test sent!',
        description: 'Check your Discord channel for the test message.',
      });
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast({
        title: 'Test failed',
        description: 'Could not send test message. Please check your webhook URL.',
        variant: 'destructive',
      });
    }
  }, [settings]);

  const testNotificationType = useCallback(async (type: string) => {
    if (!settings?.discord_webhook_url) {
      toast({
        title: 'No webhook URL',
        description: 'Please save a Discord webhook URL first.',
        variant: 'destructive',
      });
      return;
    }

    const testData: Record<string, { title: string; message: string; metadata?: Record<string, unknown> }> = {
      application_received: {
        title: 'New Application Received',
        message: 'John Smith applied for 123 Oak Street, Unit 4B',
        metadata: { applicant: 'John Smith', property: '123 Oak Street, Unit 4B' }
      },
      application_approved: {
        title: 'Application Approved!',
        message: 'Your application for 456 Maple Avenue has been approved',
        metadata: { property: '456 Maple Avenue', status: 'Approved' }
      },
      application_rejected: {
        title: 'Application Update',
        message: 'Your application for 789 Pine Road was not approved',
        metadata: { property: '789 Pine Road', status: 'Declined' }
      },
      rent_received: {
        title: 'Payment Received',
        message: '$1,500.00 received from Jane Doe for 123 Oak Street',
        metadata: { amount: '$1,500.00', tenant: 'Jane Doe', property: '123 Oak Street' }
      },
      maintenance_request: {
        title: 'Maintenance Request',
        message: 'New maintenance request for 456 Maple Avenue: Leaky faucet in kitchen',
        metadata: { property: '456 Maple Avenue', issue: 'Leaky faucet in kitchen' }
      },
      lease_signed: {
        title: 'Lease Signed',
        message: 'John Smith signed the lease for 123 Oak Street',
        metadata: { tenant: 'John Smith', property: '123 Oak Street' }
      },
      message_received: {
        title: 'New Message',
        message: 'Jane Doe: Hi, I have a question about my lease renewal...',
        metadata: { from: 'Jane Doe' }
      },
    };

    const data = testData[type];
    if (!data) return;

    try {
      const response = await supabase.functions.invoke('send-discord-notification', {
        body: {
          webhook_url: settings.discord_webhook_url,
          title: data.title,
          message: data.message,
          type: type,
          metadata: data.metadata
        }
      });

      if (response.error) throw response.error;

      toast({
        title: 'Test sent!',
        description: `Check your Discord channel for the "${data.title}" notification.`,
      });
    } catch (error) {
      console.error('Error testing notification type:', error);
      toast({
        title: 'Test failed',
        description: 'Could not send test message. Please check your webhook URL.',
        variant: 'destructive',
      });
    }
  }, [settings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    saving,
    updateSettings,
    testDiscordWebhook,
    testNotificationType,
    refetch: fetchSettings
  };
}
