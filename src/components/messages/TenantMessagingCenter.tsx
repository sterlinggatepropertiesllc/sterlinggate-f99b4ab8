import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConversation, useSendMessage, useMarkAsRead } from '@/hooks/useMessages';
import { useMessageAttachments } from '@/hooks/useMessageAttachments';
import { useAllPropertyManagers } from '@/hooks/usePropertyManagers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Send, MessageSquare, Building2, Paperclip } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { AttachmentPreview } from './AttachmentPreview';

export function TenantMessagingCenter() {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: managers, isLoading: managersLoading } = useAllPropertyManagers();
  
  // Auto-select the first (or only) property manager
  const selectedManager = managers?.[0];
  
  const { data: conversationMessages } = useConversation(user?.id, selectedManager?.id);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const { uploadAttachment, uploading, allowedTypes } = useMessageAttachments();

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
    if ((!newMessage.trim() && !selectedFile) || !selectedManager || !user) return;

    let attachmentData = null;

    if (selectedFile) {
      attachmentData = await uploadAttachment(selectedFile, user.id);
      if (!attachmentData && selectedFile) {
        return; // Upload failed
      }
    }

    await sendMessage.mutateAsync({
      sender_id: user.id,
      recipient_id: selectedManager.id,
      content: newMessage.trim(),
      attachment_url: attachmentData?.url || null,
      attachment_type: attachmentData?.type || null,
      attachment_name: attachmentData?.name || null,
    });

    setNewMessage('');
    setSelectedFile(null);
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
        <div className="space-y-3">
          {(!conversationMessages || conversationMessages.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Send a message to start the conversation</p>
            </div>
          )}
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

      {/* Send Message */}
      <div className="p-4 border-t border-border space-y-3">
        {selectedFile && (
          <AttachmentPreview
            file={selectedFile}
            onRemove={() => setSelectedFile(null)}
            uploading={uploading}
          />
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedTypes}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={uploading}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={(!newMessage.trim() && !selectedFile) || uploading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
