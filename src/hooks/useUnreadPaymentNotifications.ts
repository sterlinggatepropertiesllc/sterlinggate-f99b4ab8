import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadPaymentNotifications() {
  const { user } = useAuth();
  const [unreadPaymentCount, setUnreadPaymentCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'rent_received')
        .eq('is_read', false);

      if (error) throw error;
      setUnreadPaymentCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread payment notifications:', error);
    }
  }, [user]);

  const markAllPaymentNotificationsRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'rent_received')
        .eq('is_read', false);

      if (error) throw error;
      setUnreadPaymentCount(0);
    } catch (error) {
      console.error('Error marking payment notifications as read:', error);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Real-time subscription for payment notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('payment-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Check if it's a rent_received notification
          if (payload.new && (payload.new as any).type === 'rent_received') {
            setUnreadPaymentCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // If a rent_received notification was marked as read, refetch count
          if (payload.new && (payload.new as any).type === 'rent_received') {
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  return {
    unreadPaymentCount,
    markAllPaymentNotificationsRead,
    refetch: fetchUnreadCount
  };
}
