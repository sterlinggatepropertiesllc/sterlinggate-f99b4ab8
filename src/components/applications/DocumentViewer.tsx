import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Shield, X, ZoomIn, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentViewerProps {
  documents: {
    label: string;
    url: string | null;
  }[];
  className?: string;
}

export function DocumentViewer({ documents, className }: DocumentViewerProps) {
  const [selectedDoc, setSelectedDoc] = useState<{ label: string; url: string } | null>(null);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});

  const handleImageError = (url: string) => {
    setImageError(prev => ({ ...prev, [url]: true }));
  };

  return (
    <>
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-success" />
          <span>Encrypted & Secured</span>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {documents.map((doc) => (
            <div key={doc.label} className="space-y-1.5">
              <span className="text-xs text-muted-foreground">{doc.label}</span>
              {doc.url && !imageError[doc.url] ? (
                <button
                  onClick={() => setSelectedDoc({ label: doc.label, url: doc.url! })}
                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted/50 hover:border-primary transition-colors"
                >
                  <img
                    src={doc.url}
                    alt={doc.label}
                    className="h-full w-full object-cover"
                    onError={() => handleImageError(doc.url!)}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ) : (
                <div className="aspect-[4/3] w-full rounded-lg border border-dashed bg-muted/30 flex items-center justify-center">
                  <FileWarning className="h-6 w-6 text-muted-foreground/50" />
                </div>
              )}
            </div>
          ))}
        </div>
        
        <p className="text-xs text-muted-foreground">Click to view full size</p>
      </div>

      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          <button
            onClick={() => setSelectedDoc(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          
          {selectedDoc && (
            <div className="p-4">
              <p className="text-white/70 text-sm mb-3 text-center">{selectedDoc.label}</p>
              <img
                src={selectedDoc.url}
                alt={selectedDoc.label}
                className="max-h-[80vh] w-full object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
