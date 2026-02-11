import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface NotificationTopic {
  key: string;
  role_scope: string;
  description: string;
}

interface NotificationPref {
  id: string;
  user_id: string;
  topic_key: string;
  enabled: boolean;
}

export function useTelegramNotificationPrefs() {
  const { user, role } = useAuth();
  const [topics, setTopics] = useState<NotificationTopic[]>([]);
  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [chatLinked, setChatLinked] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || !role) return;

    setLoading(true);
    try {
      // Fetch topics relevant to user's role
      const roleScope = role === 'property_manager' ? 'property_manager' : 'tenant';
      const { data: topicsData } = await supabase
        .from('telegram_notification_topics')
        .select('*')
        .or(`role_scope.eq.${roleScope},role_scope.eq.both`);

      setTopics((topicsData as NotificationTopic[]) || []);

      // Fetch user's prefs
      const { data: prefsData } = await supabase
        .from('telegram_notification_prefs')
        .select('*')
        .eq('user_id', user.id);

      setPrefs((prefsData as NotificationPref[]) || []);

      // Check if chat_id is linked
      const { data: profile } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', user.id)
        .single();

      setChatLinked(!!profile?.telegram_chat_id);
    } catch (err) {
      console.error('Error fetching telegram notification prefs:', err);
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const togglePref = async (topicKey: string, enabled: boolean) => {
    if (!user) return;

    const existing = prefs.find((p) => p.topic_key === topicKey);

    try {
      if (existing) {
        const { error } = await supabase
          .from('telegram_notification_prefs')
          .update({ enabled })
          .eq('id', existing.id);

        if (error) throw error;

        setPrefs((prev) =>
          prev.map((p) => (p.id === existing.id ? { ...p, enabled } : p))
        );
      } else {
        const { data, error } = await supabase
          .from('telegram_notification_prefs')
          .insert({ user_id: user.id, topic_key: topicKey, enabled })
          .select()
          .single();

        if (error) throw error;
        setPrefs((prev) => [...prev, data as NotificationPref]);
      }
    } catch (err) {
      console.error('Error toggling pref:', err);
      toast.error('Failed to update notification preference');
    }
  };

  const isEnabled = (topicKey: string): boolean => {
    const pref = prefs.find((p) => p.topic_key === topicKey);
    return pref ? pref.enabled : true; // default enabled
  };

  return { topics, prefs, chatLinked, loading, togglePref, isEnabled, refetch: fetchData };
}
