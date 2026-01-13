import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateInquiry, Inquiry } from '@/hooks/useInquiries';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Mail, Phone, MapPin, Calendar, MessageSquare, ExternalLink } from 'lucide-react';

interface InquiryDetailsDialogProps {
  inquiry: Inquiry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  new: { label: 'New', variant: 'default' },
  read: { label: 'Read', variant: 'secondary' },
  responded: { label: 'Responded', variant: 'outline' },
  archived: { label: 'Archived', variant: 'destructive' },
};

export function InquiryDetailsDialog({
  inquiry,
  open,
  onOpenChange,
}: InquiryDetailsDialogProps) {
  const [notes, setNotes] = useState(inquiry?.manager_notes || '');
  const [status, setStatus] = useState(inquiry?.status || 'new');
  
  const updateInquiry = useUpdateInquiry();

  // Reset state when inquiry changes
  if (inquiry && (notes !== inquiry.manager_notes || status !== inquiry.status)) {
    if (notes === '' && inquiry.manager_notes) {
      setNotes(inquiry.manager_notes);
    }
    if (status === 'new' && inquiry.status !== 'new') {
      setStatus(inquiry.status);
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!inquiry) return;
    
    setStatus(newStatus);
    
    try {
      await updateInquiry.mutateAsync({
        id: inquiry.id,
        status: newStatus,
        responded_at: newStatus === 'responded' ? new Date().toISOString() : undefined,
      });
      toast.success('Status updated');
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSaveNotes = async () => {
    if (!inquiry) return;
    
    try {
      await updateInquiry.mutateAsync({
        id: inquiry.id,
        manager_notes: notes,
      });
      toast.success('Notes saved');
    } catch (error) {
      console.error('Failed to save notes:', error);
      toast.error('Failed to save notes');
    }
  };

  const handleReply = () => {
    if (!inquiry) return;
    window.open(`mailto:${inquiry.email}?subject=Re: Inquiry about ${inquiry.property?.address || 'Property'}`, '_blank');
  };

  if (!inquiry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-serif text-xl">Inquiry Details</DialogTitle>
            <Badge variant={statusConfig[inquiry.status]?.variant || 'default'}>
              {statusConfig[inquiry.status]?.label || inquiry.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
            <div className="space-y-2">
              <p className="font-medium text-lg">{inquiry.name}</p>
              <a 
                href={`mailto:${inquiry.email}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Mail className="h-4 w-4" />
                {inquiry.email}
              </a>
              {inquiry.phone && (
                <a 
                  href={`tel:${inquiry.phone}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-4 w-4" />
                  {inquiry.phone}
                </a>
              )}
            </div>
          </div>

          {/* Property */}
          {inquiry.property && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Property</h4>
              <p className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {inquiry.property.address}, {inquiry.property.city}, {inquiry.property.state}
              </p>
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message
            </h4>
            <div className="p-4 bg-secondary/30 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{inquiry.message}</p>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Received {format(new Date(inquiry.created_at), 'MMM d, yyyy \'at\' h:mm a')}
            </p>
          </div>

          {/* Status Update */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Manager Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Manager Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this inquiry..."
              rows={3}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSaveNotes}
              disabled={updateInquiry.isPending}
            >
              {updateInquiry.isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              className="flex-1 btn-platinum"
              onClick={handleReply}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Reply via Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
