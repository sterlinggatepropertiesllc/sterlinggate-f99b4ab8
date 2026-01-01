import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export function useMessages(userId: string | undefined) {
  return useQuery({
    queryKey: ['messages', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // No FK exists between messages and profiles, so we fetch messages only
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Messages fetch error:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useConversation(userId: string | undefined, otherUserId: string | undefined) {
  return useQuery({
    queryKey: ['messages', 'conversation', userId, otherUserId],
    queryFn: async () => {
      if (!userId || !otherUserId) return [];
      
      // Fetch messages between these two users (no FK join since no FK exists)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Conversation fetch error:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!userId && !!otherUserId,
    refetchInterval: 5000, // Refetch every 5 seconds for near-realtime updates
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: MessageInsert) => {
      const { data, error } = await supabase
        .from('messages')
        .insert(message)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['messages', 'unread', userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });
}
