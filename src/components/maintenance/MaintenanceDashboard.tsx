import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMaintenance, useDeleteMaintenance } from '@/hooks/useMaintenance';
import { useAllMaintenanceAttachments, useMaintenanceAttachments } from '@/hooks/useMaintenanceAttachments';
import { useManagerProperties } from '@/hooks/useProperties';
import { useAuth } from '@/contexts/AuthContext';
import { AddMaintenanceDialog } from './AddMaintenanceDialog';
import { AttachmentGallery } from './AttachmentGallery';
import { Plus, Download, Trash2, Pencil, CalendarIcon, X, FileText, DollarSign, Users, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaintenanceRecord } from '@/hooks/useMaintenance';
import type { DateRange } from 'react-day-picker';

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const capitalise = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

export function MaintenanceDashboard() {
  const { user } = useAuth();
  const { data: records, isLoading } = useMaintenance();
  const { data: properties } = useManagerProperties(user?.id);
  const deleteMaintenance = useDeleteMaintenance();
  const { data: allAttachments = [] } = useAllMaintenanceAttachments();

  const attachmentCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allAttachments.forEach((a) => {
      map[a.maintenance_id] = (map[a.maintenance_id] || 0) + 1;
    });
    return map;
  }, [allAttachments]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<MaintenanceRecord | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewAttachmentsFor, setViewAttachmentsFor] = useState<string | null>(null);

  const propertyMap = useMemo(() => {
    const map: Record<string, string> = {};
    properties?.forEach((p) => { map[p.id] = `${p.address}, ${p.city}`; });
    return map;
  }, [properties]);

  const propertiesWithRecords = useMemo(() => {
    if (!properties || !records) return [];
    const idsWithRecords = new Set(records.map((r) => r.property_id));
    return properties.filter((p) => idsWithRecords.has(p.id));
  }, [properties, records]);

  const filtered = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      if (propertyFilter !== 'all' && r.property_id !== propertyFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (dateRange?.from) {
        const d = new Date(r.performed_date);
        if (d < dateRange.from) return false;
        if (dateRange.to && d > dateRange.to) return false;
      }
      return true;
    });
  }, [records, propertyFilter, statusFilter, dateRange]);

  // Summary stats
  const stats = useMemo(() => ({
    count: filtered.length,
    totalCost: filtered.reduce((s, r) => s + (r.total_cost || 0), 0),
    totalPartner: filtered.reduce((s, r) => s + (r.partner_share_amount || 0), 0),
  }), [filtered]);

  // Bulk selection stats
  const selectionStats = useMemo(() => {
    const selected = filtered.filter((r) => selectedIds.has(r.id));
    return {
      count: selected.length,
      totalCost: selected.reduce((s, r) => s + (r.total_cost || 0), 0),
      totalPartner: selected.reduce((s, r) => s + (r.partner_share_amount || 0), 0),
    };
  }, [filtered, selectedIds]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  const toggleAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  }, [allVisibleSelected, filtered]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exportCSV = (rows: MaintenanceRecord[]) => {
    const headers = ['Property', 'Title', 'Total Cost', 'Partner Share', 'Performed By', 'Performed Date', 'Status'];
    const csvRows = rows.map((r) => [
      propertyMap[r.property_id] || r.property_id,
      r.title,
      (r.total_cost || 0).toFixed(2),
      (r.partner_share_amount || 0).toFixed(2),
      r.performed_by_name || (r.performed_by === 'partner' ? 'Partner' : '—'),
      r.performed_date,
      r.status,
    ]);
    const csv = [headers, ...csvRows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setEditRecord(record);
    setIsAddOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsAddOpen(open);
    if (!open) setEditRecord(null);
  };

  const dateRangeLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'MMM d, yyyy')} – ${format(dateRange.to, 'MMM d, yyyy')}`
      : format(dateRange.from, 'MMM d, yyyy')
    : null;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif">Maintenance</h1>
          <p className="text-muted-foreground mt-1">Track property maintenance and cost splits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => { setEditRecord(null); setIsAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Maintenance
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Properties" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {propertiesWithRecords.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !dateRange?.from && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
              {dateRangeLabel || 'Select date range'}
              {dateRange?.from && (
                <X
                  className="h-3.5 w-3.5 ml-auto shrink-0 opacity-50 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setDateRange(undefined); }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Records</p>
            <p className="text-2xl font-semibold">{stats.count}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-semibold">{formatCurrency(stats.totalCost)}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="rounded-lg bg-accent/10 p-2.5">
            <Users className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Partner Share</p>
            <p className="text-2xl font-semibold text-accent">{formatCurrency(stats.totalPartner)}</p>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No maintenance records found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Partner Share</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]">Proof</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="py-4">
                    <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                  </TableCell>
                  <TableCell className="py-4 max-w-[180px] truncate" title={propertyMap[r.property_id]}>
                    {propertyMap[r.property_id] || '—'}
                  </TableCell>
                  <TableCell className="py-4 font-medium max-w-[240px] truncate" title={r.title}>{r.title}</TableCell>
                  <TableCell className="py-4 text-right font-medium">{formatCurrency(r.total_cost || 0)}</TableCell>
                  <TableCell className="py-4 text-right text-accent font-medium">{formatCurrency(r.partner_share_amount || 0)}</TableCell>
                  <TableCell className="py-4">
                    {r.performed_by_name || (r.performed_by === 'partner' ? 'Partner' : '—')}
                  </TableCell>
                  <TableCell className="py-4">{format(new Date(r.performed_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="py-4">
                    <Badge variant={r.status === 'completed' ? 'default' : 'secondary'}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium border-0',
                        r.status === 'completed'
                          ? 'bg-success/15 text-success'
                          : 'bg-warning/15 text-warning'
                      )}>
                      {capitalise(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4">
                    {attachmentCountMap[r.id] ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewAttachmentsFor(r.id)}>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} className="h-8 w-8">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMaintenance.mutate(r.id)}
                        disabled={deleteMaintenance.isPending}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Bulk Selection Summary Bar */}
      {selectionStats.count > 0 && (
        <div className="sticky bottom-4 mt-4 z-10">
          <Card className="p-4 flex flex-wrap items-center justify-between gap-4 border-primary/30 shadow-lg">
            <div className="flex flex-wrap items-center gap-6">
              <span className="text-sm font-medium">
                Selected: <span className="text-primary">{selectionStats.count}</span> records
              </span>
              <span className="text-sm">
                Total Cost: <span className="font-semibold">{formatCurrency(selectionStats.totalCost)}</span>
              </span>
              <span className="text-sm">
                Partner Share: <span className="font-semibold text-accent">{formatCurrency(selectionStats.totalPartner)}</span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(filtered.filter((r) => selectedIds.has(r.id)))}
            >
              <Download className="h-4 w-4 mr-2" /> Export Selected
            </Button>
          </Card>
        </div>
      )}

      <AddMaintenanceDialog
        open={isAddOpen}
        onOpenChange={handleDialogClose}
        properties={properties || []}
        editRecord={editRecord}
      />

      {/* Proof Viewer Dialog */}
      <ProofViewerDialog
        maintenanceId={viewAttachmentsFor}
        onClose={() => setViewAttachmentsFor(null)}
      />
    </div>
  );
}

function ProofViewerDialog({ maintenanceId, onClose }: { maintenanceId: string | null; onClose: () => void }) {
  const { data: attachments = [] } = useMaintenanceAttachments(maintenanceId || undefined);

  return (
    <Dialog open={!!maintenanceId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[var(--tg-viewport-stable-height,90vh)] overflow-y-auto">
        <AttachmentGallery attachments={attachments} />
      </DialogContent>
    </Dialog>
  );
}
