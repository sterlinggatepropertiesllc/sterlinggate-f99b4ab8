import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Printer, X, FileText, CalendarIcon } from 'lucide-react';

interface LeasePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseHTML: string;
  propertyAddress?: string;
  leaseType?: string;
  startDate?: string;
  endDate?: string;
}

export function LeasePreviewDialog({
  open,
  onOpenChange,
  leaseHTML,
  propertyAddress,
  leaseType,
  startDate,
  endDate,
}: LeasePreviewDialogProps) {
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
            ${leaseHTML}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl font-serif">Lease Agreement Preview</DialogTitle>
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

        <ScrollArea className="flex-1 min-h-0">
          {/* Paper-styled container */}
          <div className="p-4">
            <div 
              className="bg-white shadow-lg rounded border border-slate-200 p-8 md:p-12 mx-auto max-w-[8.5in] prose prose-sm prose-slate max-w-none"
              style={{
                fontFamily: "'Times New Roman', Times, serif",
                lineHeight: 1.6,
                color: '#1a1a1a',
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: leaseHTML }} />
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
