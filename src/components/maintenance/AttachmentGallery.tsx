import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, FileText, Trash2 } from 'lucide-react';
import type { MaintenanceAttachment } from '@/hooks/useMaintenanceAttachments';

interface Props {
  attachments: MaintenanceAttachment[];
  onDelete?: (attachment: MaintenanceAttachment) => void;
  isDeleting?: boolean;
}

export function AttachmentGallery({ attachments, onDelete, isDeleting }: Props) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.file_type.startsWith('image/'));
  const pdfs = attachments.filter((a) => a.file_type === 'application/pdf');

  const currentImage = viewerIndex !== null ? images[viewerIndex] : null;

  return (
    <>
      <div className="space-y-3">
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((att, i) => (
              <button
                key={att.id}
                type="button"
                className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors group"
                onClick={() => setViewerIndex(i)}
              >
                <img
                  src={att.file_url}
                  alt={att.file_name || 'Proof'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {onDelete && (
                  <button
                    type="button"
                    className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(att);
                    }}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </button>
            ))}
          </div>
        )}

        {pdfs.map((att) => (
          <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-border group">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <a
              href={att.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm truncate hover:underline flex-1"
            >
              {att.file_name || 'Document.pdf'}
            </a>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDelete(att)}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Fullscreen Image Viewer */}
      <Dialog open={viewerIndex !== null} onOpenChange={() => setViewerIndex(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/95 overflow-hidden">
          {currentImage && (
            <div className="relative flex items-center justify-center min-h-[60vh]">
              <img
                src={currentImage.file_url}
                alt={currentImage.file_name || 'Proof'}
                className="max-w-full max-h-[90vh] object-contain"
              />

              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-white hover:bg-white/20"
                onClick={() => setViewerIndex(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                    onClick={() => setViewerIndex((viewerIndex! - 1 + images.length) % images.length)}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                    onClick={() => setViewerIndex((viewerIndex! + 1) % images.length)}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/70 text-sm">
                {viewerIndex! + 1} / {images.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
