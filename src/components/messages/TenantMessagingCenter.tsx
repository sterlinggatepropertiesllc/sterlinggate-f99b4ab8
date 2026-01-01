import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useConversation, useSendMessage, useMarkAsRead } from '@/hooks/useMessages';
import { useAllPropertyManagers } from '@/hooks/usePropertyManagers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Send, MessageSquare, Building2, UserCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ManagerConversation {
  id: string;
  name: string;
  email: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export function TenantMessagingCenter() {
  const { user } = useAuth();
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [managerConversations, setManagerConversations] = useState<ManagerConversation[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: managers, isLoading: managersLoading } = useAllPropertyManagers();
  const { data: allMessages } = useMessages(user?.id);
  const { data: conversationMessages } = useConversation(user?.id, selectedManager || undefined);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  // Build conversation list from managers + messages
  useEffect(() => {
    if (!managers || !user) return;

    const conversationMap = new Map<string, ManagerConversation>();

    // Pre-populate with all managers (even without messages)
    managers.forEach((manager) => {
      conversationMap.set(manager.id, {
        id: manager.id,
        name: manager.full_name || manager.email,
        email: manager.email,
        unreadCount: 0,
      });
    });

    // Enrich with message data
    if (allMessages) {
      allMessages.forEach((msg) => {
        const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        const conv = conversationMap.get(otherUserId);

        if (conv) {
          if (!conv.lastMessageTime || new Date(msg.created_at) > new Date(conv.lastMessageTime)) {
            conv.lastMessage = msg.content;
            conv.lastMessageTime = msg.created_at;
          }

          if (!msg.is_read && msg.recipient_id === user.id) {
            conv.unreadCount++;
          }
        }
      });
    }

    const sortedConversations = Array.from(conversationMap.values()).sort((a, b) => {
      // Sort by last message time, managers with messages first
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    setManagerConversations(sortedConversations);

    // Auto-select if only one manager
    if (sortedConversations.length === 1 && !selectedManager) {
      setSelectedManager(sortedConversations[0].id);
    }
  }, [managers, allMessages, user, selectedManager]);

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
      recipient_id: selectedManager,
      content: newMessage.trim(),
    });

    setNewMessage('');
  };

  const selectedConv = managerConversations.find((c) => c.id === selectedManager);

  if (managersLoading) {
    return (
      <div className="h-[600px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!managers || managers.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <Building2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-serif mb-2">No Property Managers Available</h3>
        <p className="text-muted-foreground">
          There are no property managers to contact at this time.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex h-[600px] rounded-lg border border-border overflow-hidden bg-card">
      {/* Manager List */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Your Property Manager{managers.length > 1 ? 's' : ''}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {managers.length === 1 ? 'Direct message your landlord' : 'Select a manager to message'}
          </p>
        </div>
        <ScrollArea className="flex-1">
          {managerConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedManager(conv.id)}
              className={`w-full p-4 text-left border-b border-border transition-colors ${
                selectedManager === conv.id
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
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {conv.lastMessage}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
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

            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message to your property manager..."
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
              <UserCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Select a property manager to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
