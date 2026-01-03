import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Printer, X, FileText, CalendarIcon, Pencil, Eye, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LeasePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseHTML: string;
  propertyAddress?: string;
  leaseType?: string;
  startDate?: string;
  endDate?: string;
  editable?: boolean;
  onSave?: (html: string) => void;
}

export function LeasePreviewDialog({
  open,
  onOpenChange,
  leaseHTML,
  propertyAddress,
  leaseType,
  startDate,
  endDate,
  editable = false,
  onSave,
}: LeasePreviewDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [currentHTML, setCurrentHTML] = useState(leaseHTML);

  // Sync currentHTML when leaseHTML prop changes
  useEffect(() => {
    setCurrentHTML(leaseHTML);
  }, [leaseHTML]);

  // Reset editing state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  const saveEdits = () => {
    if (editorRef.current) {
      const newHTML = editorRef.current.innerHTML;
      setCurrentHTML(newHTML);
      onSave?.(newHTML);
      toast.success('Changes saved');
    }
    setIsEditing(false);
  };

  const toggleEditMode = () => {
    if (isEditing) {
      saveEdits();
    } else {
      setIsEditing(true);
    }
  };

  const handleClose = () => {
    if (isEditing && editorRef.current) {
      // Save any pending changes before closing
      const newHTML = editorRef.current.innerHTML;
      setCurrentHTML(newHTML);
      onSave?.(newHTML);
    }
    setIsEditing(false);
    onOpenChange(false);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Commercial Lease Agreement - ${propertyAddress || 'Lease Document'}</title>
            <style>
              @page {
                margin: 1in;
                size: letter;
              }
              body {
                font-family: 'Times New Roman', Times, serif;
                font-size: 12pt;
                line-height: 1.6;
                color: #000;
                max-width: 8.5in;
                margin: 0 auto;
                padding: 0.5in;
              }
              h1 {
                font-size: 18pt;
                text-align: center;
                text-transform: uppercase;
                margin-bottom: 24pt;
                font-weight: bold;
              }
              h2 {
                font-size: 14pt;
                margin-top: 18pt;
                margin-bottom: 12pt;
                font-weight: bold;
                text-transform: uppercase;
              }
              h3 {
                font-size: 12pt;
                margin-top: 12pt;
                margin-bottom: 8pt;
                font-weight: bold;
              }
              p {
                margin-bottom: 12pt;
                text-align: justify;
              }
              ul, ol {
                margin-bottom: 12pt;
                padding-left: 24pt;
              }
              li {
                margin-bottom: 6pt;
              }
              hr {
                border: none;
                border-top: 1px solid #000;
                margin: 24pt 0;
              }
              .signature-block {
                margin-top: 48pt;
                page-break-inside: avoid;
              }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
              ${currentHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl font-serif">
                {isEditing ? 'Edit Lease Agreement' : 'Lease Agreement Preview'}
              </DialogTitle>
              {propertyAddress && (
                <p className="text-sm text-muted-foreground mt-1">{propertyAddress}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {leaseType && <Badge variant="outline">{leaseType}</Badge>}
            {startDate && endDate && (
              <Badge variant="secondary" className="gap-1">
                <CalendarIcon className="h-3 w-3" />
                {startDate} — {endDate}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {editable && isEditing && (
          <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Editing mode — Click in the document to make changes
            </span>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          {/* Paper-styled container */}
          <div className="p-4">
            <div 
              ref={editorRef}
              contentEditable={isEditing}
              suppressContentEditableWarning
              className={cn(
                "bg-white shadow-lg rounded border p-8 md:p-12 mx-auto max-w-[8.5in] prose prose-sm prose-slate",
                isEditing 
                  ? "border-primary/50 ring-2 ring-primary/20 focus:outline-none cursor-text" 
                  : "border-slate-200"
              )}
              style={{
                fontFamily: "'Times New Roman', Times, serif",
                lineHeight: 1.6,
                color: '#1a1a1a',
              }}
              dangerouslySetInnerHTML={{ __html: currentHTML }}
            />
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t border-border">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <div className="flex items-center gap-2">
            {editable && (
              <Button
                variant={isEditing ? "default" : "outline"}
                onClick={toggleEditMode}
                className="gap-2"
              >
                {isEditing ? (
                  <>
                    <Check className="h-4 w-4" />
                    Done Editing
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Edit Document
                  </>
                )}
              </Button>
            )}
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
