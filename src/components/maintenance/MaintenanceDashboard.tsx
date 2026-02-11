import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { useMaintenance, useDeleteMaintenance } from '@/hooks/useMaintenance';
import { useManagerProperties } from '@/hooks/useProperties';
import { useAuth } from '@/contexts/AuthContext';
import { AddMaintenanceDialog } from './AddMaintenanceDialog';
import { Plus, Download, Trash2 } from 'lucide-react';
import type { MaintenanceRecord } from '@/hooks/useMaintenance';

export function MaintenanceDashboard() {
  const { user } = useAuth();
  const { data: records, isLoading } = useMaintenance();
  const { data: properties } = useManagerProperties(user?.id);
  const deleteMaintenance = useDeleteMaintenance();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const propertyMap = useMemo(() => {
    const map: Record<string, string> = {};
    properties?.forEach((p) => { map[p.id] = `${p.address}, ${p.city}`; });
    return map;
  }, [properties]);

  const filtered = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      if (propertyFilter !== 'all' && r.property_id !== propertyFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (startDate && r.performed_date < startDate) return false;
      if (endDate && r.performed_date > endDate) return false;
      return true;
    });
  }, [records, propertyFilter, statusFilter, startDate, endDate]);

  const exportCSV = () => {
    const headers = ['Property', 'Title', 'Category', 'Total Cost', 'Partner Share', 'Performed By', 'Performed Date', 'Status'];
    const rows = filtered.map((r) => [
      propertyMap[r.property_id] || r.property_id,
      r.title,
      r.category,
      r.total_cost.toFixed(2),
      r.partner_share_amount.toFixed(2),
      r.performed_by_name ? `${r.performed_by} (${r.performed_by_name})` : r.performed_by,
      r.performed_date,
      r.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categoryLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif">Maintenance</h1>
          <p className="text-muted-foreground">Track property maintenance and cost splits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => setIsAddOpen(true)}>
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
            {properties?.map((p) => (
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

        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[160px]" placeholder="Start date" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[160px]" placeholder="End date" />
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No maintenance records found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Partner Share</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[200px] truncate">{propertyMap[r.property_id] || '—'}</TableCell>
                  <TableCell>{r.title}</TableCell>
                  <TableCell>{categoryLabel(r.category)}</TableCell>
                  <TableCell className="text-right">${r.total_cost.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${r.partner_share_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {r.performed_by_name ? `${categoryLabel(r.performed_by)} — ${r.performed_by_name}` : categoryLabel(r.performed_by)}
                  </TableCell>
                  <TableCell>{format(new Date(r.performed_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'completed' ? 'default' : 'secondary'}>
                      {categoryLabel(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMaintenance.mutate(r.id)}
                      disabled={deleteMaintenance.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AddMaintenanceDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        properties={properties || []}
      />
    </div>
  );
}
