import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConversation, useSendMessage, useMarkAsRead } from '@/hooks/useMessages';
import { useAllPropertyManagers } from '@/hooks/usePropertyManagers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Send, MessageSquare, Building2 } from 'lucide-react';
import { format } from 'date-fns';

export function TenantMessagingCenter() {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: managers, isLoading: managersLoading } = useAllPropertyManagers();
  
  // Auto-select the first (or only) property manager
  const selectedManager = managers?.[0];
  
  const { data: conversationMessages } = useConversation(user?.id, selectedManager?.id);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

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
    if (!newMessage.trim() || !selectedManager || !user) return;

    await sendMessage.mutateAsync({
      sender_id: user.id,
      recipient_id: selectedManager.id,
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  if (managersLoading) {
    return (
      <div className="h-[600px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!managers || managers.length === 0 || !selectedManager) {
    return (
      <Card className="p-12 text-center border-dashed">
        <Building2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-serif mb-2">No Landlord Available</h3>
        <p className="text-muted-foreground">
          A property manager account hasn't been set up yet. Please contact support.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-[600px] rounded-lg border border-border overflow-hidden bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/20 text-primary">
            {(selectedManager.full_name || selectedManager.email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-foreground">
            {selectedManager.full_name || 'Property Manager'}
          </p>
          <p className="text-sm text-muted-foreground">{selectedManager.email}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {(!conversationMessages || conversationMessages.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Send a message to start the conversation</p>
            </div>
          )}
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

      {/* Send Message */}
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
    </div>
  );
}
