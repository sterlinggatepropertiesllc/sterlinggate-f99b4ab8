import { X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttachmentPreviewProps {
  file: File;
  onRemove: () => void;
  uploading?: boolean;
}

export function AttachmentPreview({ file, onRemove, uploading }: AttachmentPreviewProps) {
  const isImage = file.type.startsWith('image/');
  const previewUrl = isImage ? URL.createObjectURL(file) : null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="relative inline-flex items-center gap-2 p-2 bg-secondary/50 rounded-xl border border-border/50">
      {isImage && previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt={file.name}
            className="h-16 w-16 object-cover rounded-lg"
            onLoad={() => URL.revokeObjectURL(previewUrl)}
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div className={cn(
          'h-16 w-16 rounded-lg flex items-center justify-center',
          'bg-primary/10'
        )}>
          <FileText className="h-8 w-8 text-primary" />
        </div>
      )}
      
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-sm font-medium truncate max-w-[150px]">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>

      <button
        onClick={onRemove}
        disabled={uploading}
        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
