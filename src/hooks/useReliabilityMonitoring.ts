import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { subHours } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { createRealtimeChannelName } from '@/lib/realtimeChannel';

export type StripeWebhookEvent = Tables<'stripe_webhook_events'>;
export type AdminAuditLog = Tables<'admin_audit_logs'>;

export function useStripeWebhookEvents(limit = 20) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(createRealtimeChannelName('stripe-webhook-events-realtime', limit))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stripe_webhook_events' },
        () => queryClient.invalidateQueries({ queryKey: ['stripe-webhook-events'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, queryClient]);

  return useQuery({
    queryKey: ['stripe-webhook-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_webhook_events')
        .select('*')
        .order('last_received_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as StripeWebhookEvent[];
    },
  });
}

export function useAdminAuditLogs(limit = 25) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(createRealtimeChannelName('admin-audit-logs-realtime', limit))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_audit_logs' },
        () => queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, queryClient]);

  return useQuery({
    queryKey: ['admin-audit-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as AdminAuditLog[];
    },
  });
}

export function useReliabilitySummary(events: StripeWebhookEvent[]) {
  return useMemo(() => {
    const dayStart = subHours(new Date(), 24);
    const recentEvents = events.filter((event) => new Date(event.last_received_at) >= dayStart);
    const failedEvents = recentEvents.filter((event) => event.status === 'failed');
    const retriedEvents = recentEvents.filter((event) => event.retry_count > 0);
    const lastReceived = events[0]?.last_received_at ?? null;
    const lastFailure = events.find((event) => event.status === 'failed') ?? null;

    return {
      lastReceived,
      recentCount: recentEvents.length,
      failedCount: failedEvents.length,
      retriedCount: retriedEvents.length,
      lastFailure,
      healthy: failedEvents.length === 0,
    };
  }, [events]);
}
