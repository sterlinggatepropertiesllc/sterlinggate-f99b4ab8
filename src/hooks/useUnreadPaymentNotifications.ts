import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const paymentNotificationTypes = [
  'rent_received',
  'payment_received',
  'payment_processing',
  'payment_failed',
  'payment_incomplete',
  'payment_late',
  'payment_missing',
] as const;

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
        .in('type', [...paymentNotificationTypes])
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
        .in('type', [...paymentNotificationTypes])
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
          const type = String((payload.new as { type?: string } | null)?.type || '');
          if (paymentNotificationTypes.includes(type as (typeof paymentNotificationTypes)[number])) {
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
          const type = String((payload.new as { type?: string } | null)?.type || '');
          if (paymentNotificationTypes.includes(type as (typeof paymentNotificationTypes)[number])) {
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
