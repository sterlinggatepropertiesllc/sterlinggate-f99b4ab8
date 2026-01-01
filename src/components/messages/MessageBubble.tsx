import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Download, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isOwn: boolean;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
}

export function MessageBubble({
  content,
  timestamp,
  isOwn,
  attachmentUrl,
  attachmentType,
  attachmentName,
}: MessageBubbleProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  const isImage = attachmentType?.startsWith('image/');
  const isPdf = attachmentType === 'application/pdf';
  const hasAttachment = attachmentUrl && attachmentType;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] space-y-2',
          isOwn ? 'items-end' : 'items-start'
        )}
      >
        {/* Message bubble */}
        <div
          className={cn(
            'px-4 py-2.5 shadow-sm',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-[20px] rounded-br-md'
              : 'bg-secondary text-foreground rounded-[20px] rounded-bl-md'
          )}
        >
          {/* Image attachment */}
          {hasAttachment && isImage && (
            <>
              <div
                className="mb-2 cursor-pointer overflow-hidden rounded-xl"
                onClick={() => setLightboxOpen(true)}
              >
                <img
                  src={attachmentUrl}
                  alt={attachmentName || 'Image'}
                  className="max-w-full max-h-64 object-cover rounded-xl hover:opacity-90 transition-opacity"
                />
              </div>
              
              {/* Lightbox */}
              <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none">
                  <button
                    onClick={() => setLightboxOpen(false)}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-center justify-center p-4">
                    <img
                      src={attachmentUrl}
                      alt={attachmentName || 'Image'}
                      className="max-w-full max-h-[85vh] object-contain rounded-lg"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* PDF/Document attachment */}
          {hasAttachment && isPdf && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl mb-2 transition-colors',
                isOwn
                  ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20'
                  : 'bg-background hover:bg-background/80'
              )}
            >
              <div className={cn(
                'p-2 rounded-lg',
                isOwn ? 'bg-primary-foreground/20' : 'bg-primary/10'
              )}>
                <FileText className={cn(
                  'h-5 w-5',
                  isOwn ? 'text-primary-foreground' : 'text-primary'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium truncate',
                  isOwn ? 'text-primary-foreground' : 'text-foreground'
                )}>
                  {attachmentName || 'Document'}
                </p>
                <p className={cn(
                  'text-xs',
                  isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  PDF Document
                </p>
              </div>
              <Download className={cn(
                'h-4 w-4 flex-shrink-0',
                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )} />
            </a>
          )}

          {/* Text content */}
          {content && (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <p className={cn(
          'text-[11px] px-2',
          isOwn ? 'text-muted-foreground text-right' : 'text-muted-foreground text-left'
        )}>
          {format(new Date(timestamp), 'h:mm a')}
        </p>
      </div>
    </div>
  );
}
