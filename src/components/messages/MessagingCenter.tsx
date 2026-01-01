import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useConversation, useSendMessage, useMarkAsRead } from '@/hooks/useMessages';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  name: string;
  email: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export function MessagingCenter() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: allMessages } = useMessages(user?.id);
  const { data: conversationMessages } = useConversation(user?.id, selectedConversation || undefined);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  // Build conversation list from messages
  useEffect(() => {
    if (!allMessages || !user) return;

    const conversationMap = new Map<string, Conversation>();

    allMessages.forEach((msg) => {
      const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
      
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          id: otherUserId,
          name: 'User',
          email: '',
          unreadCount: 0,
        });
      }

      const conv = conversationMap.get(otherUserId)!;
      
      if (!conv.lastMessageTime || new Date(msg.created_at) > new Date(conv.lastMessageTime)) {
        conv.lastMessage = msg.content;
        conv.lastMessageTime = msg.created_at;
      }

      if (!msg.is_read && msg.recipient_id === user.id) {
        conv.unreadCount++;
      }
    });

    // Fetch profile names
    const fetchProfiles = async () => {
      const ids = Array.from(conversationMap.keys());
      if (ids.length === 0) return;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);

      if (profiles) {
        profiles.forEach((p) => {
          const conv = conversationMap.get(p.id);
          if (conv) {
            conv.name = p.full_name || p.email;
            conv.email = p.email;
          }
        });
      }

      setConversations(Array.from(conversationMap.values()).sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      }));
    };

    fetchProfiles();
  }, [allMessages, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Mark messages as read when viewing conversation
  useEffect(() => {
    if (!conversationMessages || !user) return;

    conversationMessages
      .filter((m) => m.recipient_id === user.id && !m.is_read)
      .forEach((m) => markAsRead.mutate(m.id));
  }, [conversationMessages, user, markAsRead]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    await sendMessage.mutateAsync({
      sender_id: user.id,
      recipient_id: selectedConversation,
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  return (
    <div className="flex h-[600px] rounded-lg border border-border overflow-hidden bg-card">
      {/* Conversation List */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Messages</h3>
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full p-4 text-left border-b border-border transition-colors ${
                  selectedConversation === conv.id
                    ? 'bg-primary/10'
                    : 'hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {conv.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground truncate">{conv.name}</p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/20 text-primary">
                  {selectedConv.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{selectedConv.name}</p>
                <p className="text-sm text-muted-foreground">{selectedConv.email}</p>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {conversationMessages?.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-foreground'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {format(new Date(msg.created_at), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
