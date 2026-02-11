import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useConversation, useSendMessage, useMarkAsRead } from '@/hooks/useMessages';
import { useMessageAttachments } from '@/hooks/useMessageAttachments';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageSquare, User, Paperclip, ArrowLeft } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { AttachmentPreview } from './AttachmentPreview';

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
  const isMobile = useIsMobile();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allMessages } = useMessages(user?.id);
  const { data: conversationMessages } = useConversation(user?.id, selectedConversation || undefined);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const { uploadAttachment, uploading, allowedTypes } = useMessageAttachments();

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
        conv.lastMessage = msg.attachment_type?.startsWith('image/') 
          ? '📷 Photo' 
          : msg.attachment_type === 'application/pdf'
          ? '📄 Document'
          : msg.content;
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedConversation || !user) return;

    let attachmentData = null;

    if (selectedFile) {
      attachmentData = await uploadAttachment(selectedFile, user.id);
      if (!attachmentData && selectedFile) {
        return; // Upload failed
      }
    }

    await sendMessage.mutateAsync({
      sender_id: user.id,
      recipient_id: selectedConversation,
      content: newMessage.trim(),
      attachment_url: attachmentData?.url || null,
      attachment_type: attachmentData?.type || null,
      attachment_name: attachmentData?.name || null,
    });

    setNewMessage('');
    setSelectedFile(null);
  };

  const selectedConv = conversations.find((c) => c.id === selectedConversation);

  // Mobile: show conversation list OR message thread
  if (isMobile) {
    if (selectedConversation && selectedConv) {
      return (
        <div className="flex flex-col h-[calc(100dvh-180px)] rounded-lg border border-border overflow-hidden bg-card">
          {/* Header with back button */}
          <div className="p-3 border-b border-border flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)} className="min-h-[44px] min-w-[44px]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/20 text-primary">
                {selectedConv.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{selectedConv.name}</p>
              <p className="text-xs text-muted-foreground truncate">{selectedConv.email}</p>
            </div>
          </div>

          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {conversationMessages?.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  content={msg.content}
                  timestamp={msg.created_at}
                  isOwn={msg.sender_id === user?.id}
                  attachmentUrl={msg.attachment_url}
                  attachmentType={msg.attachment_type}
                  attachmentName={msg.attachment_name}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border space-y-2">
            {selectedFile && (
              <AttachmentPreview file={selectedFile} onRemove={() => setSelectedFile(null)} uploading={uploading} />
            )}
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept={allowedTypes} onChange={handleFileSelect} className="hidden" />
              <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex-shrink-0 min-h-[44px] min-w-[44px]">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()} disabled={uploading} className="min-h-[44px]" />
              <Button onClick={handleSendMessage} disabled={(!newMessage.trim() && !selectedFile) || uploading} className="min-h-[44px] min-w-[44px]">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Conversation list
    return (
      <div className="flex flex-col h-[calc(100dvh-180px)] rounded-lg border border-border overflow-hidden bg-card">
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
                className="w-full p-4 text-left border-b border-border transition-colors hover:bg-secondary/50 min-h-[72px] active:bg-primary/10"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary">{conv.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground truncate">{conv.name}</p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">{conv.unreadCount}</span>
                      )}
                    </div>
                    {conv.lastMessage && <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>}
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>
    );
  }

  // Desktop: side-by-side layout
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
                  selectedConversation === conv.id ? 'bg-primary/10' : 'hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary">{conv.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground truncate">{conv.name}</p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">{conv.unreadCount}</span>
                      )}
                    </div>
                    {conv.lastMessage && <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>}
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
                <AvatarFallback className="bg-primary/20 text-primary">{selectedConv.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{selectedConv.name}</p>
                <p className="text-sm text-muted-foreground">{selectedConv.email}</p>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {conversationMessages?.map((msg) => (
                  <MessageBubble key={msg.id} content={msg.content} timestamp={msg.created_at} isOwn={msg.sender_id === user?.id} attachmentUrl={msg.attachment_url} attachmentType={msg.attachment_type} attachmentName={msg.attachment_name} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border space-y-3">
              {selectedFile && <AttachmentPreview file={selectedFile} onRemove={() => setSelectedFile(null)} uploading={uploading} />}
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept={allowedTypes} onChange={handleFileSelect} className="hidden" />
                <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex-shrink-0">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()} disabled={uploading} />
                <Button onClick={handleSendMessage} disabled={(!newMessage.trim() && !selectedFile) || uploading}>
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
