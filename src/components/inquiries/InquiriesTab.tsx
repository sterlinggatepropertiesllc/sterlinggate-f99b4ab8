import { useState } from 'react';
import { useInquiries, useUpdateInquiry, useDeleteInquiry, Inquiry } from '@/hooks/useInquiries';
import { InquiryDetailsDialog } from './InquiryDetailsDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  MoreVertical, 
  Eye, 
  Mail, 
  Trash2, 
  Archive,
  CheckCircle2,
  Clock,
  Filter
} from 'lucide-react';

interface InquiriesTabProps {
  managerId: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Clock }> = {
  new: { label: 'New', variant: 'default', icon: Clock },
  read: { label: 'Read', variant: 'secondary', icon: Eye },
  responded: { label: 'Responded', variant: 'outline', icon: CheckCircle2 },
  archived: { label: 'Archived', variant: 'destructive', icon: Archive },
};

export function InquiriesTab({ managerId }: InquiriesTabProps) {
  const { data: inquiries, isLoading } = useInquiries(managerId);
  const updateInquiry = useUpdateInquiry();
  const deleteInquiry = useDeleteInquiry();
  
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredInquiries = inquiries?.filter(inquiry => 
    statusFilter === 'all' || inquiry.status === statusFilter
  ) || [];

  const handleViewDetails = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setIsDetailsOpen(true);
    
    // Mark as read if new
    if (inquiry.status === 'new') {
      updateInquiry.mutate({ id: inquiry.id, status: 'read' });
    }
  };

  const handleReply = (inquiry: Inquiry) => {
    window.open(`mailto:${inquiry.email}?subject=Re: Inquiry about ${inquiry.property?.address || 'Property'}`, '_blank');
    updateInquiry.mutate({ id: inquiry.id, status: 'responded', responded_at: new Date().toISOString() });
  };

  const handleArchive = async (inquiry: Inquiry) => {
    try {
      await updateInquiry.mutateAsync({ id: inquiry.id, status: 'archived' });
      toast.success('Inquiry archived');
    } catch (error) {
      toast.error('Failed to archive inquiry');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await deleteInquiry.mutateAsync(deleteId);
      toast.success('Inquiry deleted');
      setDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete inquiry');
    }
  };

  if (isLoading) {
    return (
      <Card className="silver-border">
        <CardContent className="p-8">
          <div className="animate-pulse text-center text-muted-foreground">
            Loading inquiries...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif">Property Inquiries</h2>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage inquiries from potential tenants
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredInquiries.length === 0 ? (
        <Card className="silver-border">
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-serif mb-2">No Inquiries</h3>
            <p className="text-muted-foreground text-sm">
              {statusFilter === 'all' 
                ? 'Inquiries from potential tenants will appear here.'
                : `No ${statusFilter} inquiries found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="silver-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sender</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="hidden md:table-cell">Message</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInquiries.map((inquiry) => {
                const StatusIcon = statusConfig[inquiry.status]?.icon || Clock;
                return (
                  <TableRow 
                    key={inquiry.id}
                    className={inquiry.status === 'new' ? 'bg-primary/5' : ''}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{inquiry.name}</p>
                        <p className="text-xs text-muted-foreground">{inquiry.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate max-w-[200px]">
                        {inquiry.property?.address || 'Unknown'}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {inquiry.message}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(inquiry.created_at), 'MMM d')}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[inquiry.status]?.variant || 'default'}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[inquiry.status]?.label || inquiry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(inquiry)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReply(inquiry)}>
                            <Mail className="h-4 w-4 mr-2" />
                            Reply via Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleArchive(inquiry)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteId(inquiry.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <InquiryDetailsDialog
        inquiry={selectedInquiry}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inquiry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inquiry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
