import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerProperties } from '@/hooks/useProperties';
import { useTenants } from '@/hooks/useTenants';
import { useAllPayments } from '@/hooks/usePayments';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarIcon, 
  Building2, 
  Users, 
  DollarSign, 
  Download,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

type ViewMode = 'property' | 'tenant';
type DatePreset = 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'last_30_days' | 'custom';

export function AuditDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: properties = [] } = useManagerProperties(user?.id);
  const { data: tenants = [] } = useTenants(user?.id);
  const { data: payments = [] } = useAllPayments();

  const [viewMode, setViewMode] = useState<ViewMode>('property');
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');

  // Realtime subscription for payments (admin view)
  useEffect(() => {
    const channel = supabase
      .channel('admin-payments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payments', 'all'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Update date range when preset changes
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    
    switch (preset) {
      case 'this_week':
        setDateRange({ from: startOfWeek(now), to: endOfWeek(now) });
        break;
      case 'this_month':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case 'this_quarter':
        setDateRange({ from: startOfQuarter(now), to: endOfQuarter(now) });
        break;
      case 'this_year':
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        break;
      case 'last_30_days':
        setDateRange({ from: subDays(now, 30), to: now });
        break;
      case 'custom':
        // Keep current range for custom
        break;
    }
  };

  // Filter payments by date range and selection
  const filteredPayments = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    return payments.filter(payment => {
      const paymentDate = parseISO(payment.payment_date);
      const inDateRange = isWithinInterval(paymentDate, { 
        start: dateRange.from!, 
        end: dateRange.to! 
      });

      if (!inDateRange) return false;

      if (viewMode === 'property' && selectedProperty !== 'all') {
        return payment.property_id === selectedProperty;
      }
      
      if (viewMode === 'tenant' && selectedTenant !== 'all') {
        return payment.tenant_id === selectedTenant;
      }

      return true;
    });
  }, [payments, dateRange, viewMode, selectedProperty, selectedTenant]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const completedPayments = filteredPayments.filter((p) => p.status === 'completed');
    const pendingPayments = filteredPayments.filter((p) => p.status === 'processing');
    const totalCollected = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingACH = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const transactionCount = completedPayments.length;
    const avgTransaction = transactionCount > 0 ? totalCollected / transactionCount : 0;

    // Group by property or tenant
    const groupedData = viewMode === 'property'
      ? properties.map(property => {
          const propertyPayments = completedPayments.filter(p => p.property_id === property.id);
          const amount = propertyPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          return {
            id: property.id,
            name: `${property.address}, ${property.city}`,
            amount,
            count: propertyPayments.length,
          };
        }).filter(item => item.count > 0).sort((a, b) => b.amount - a.amount)
      : tenants.map(tenant => {
          // Compare payment.tenant_id to tenant.id (the tenant record ID)
          const tenantPayments = completedPayments.filter(p => p.tenant_id === tenant.id);
          const amount = tenantPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          const property = properties.find(p => p.id === tenant.property_id);
          return {
            id: tenant.id,
            name: property ? `Tenant at ${property.address}` : 'Unknown Tenant',
            amount,
            count: tenantPayments.length,
          };
        }).filter(item => item.count > 0).sort((a, b) => b.amount - a.amount);

    return {
      totalCollected,
      pendingACH,
      transactionCount,
      avgTransaction,
      groupedData,
    };
  }, [filteredPayments, properties, tenants, viewMode]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Property', 'Amount', 'Payment Method', 'Status'];
    const rows = filteredPayments.map(payment => {
      const property = properties.find(p => p.id === payment.property_id);
      return [
        format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
        property ? `${property.address}, ${property.city}` : 'Unknown',
        payment.amount,
        payment.payment_method,
        payment.status,
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif">Audit</h1>
          <p className="text-muted-foreground text-sm md:text-base">Financial tracking and reporting</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* View Mode Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">View By</label>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'property' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('property')}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Property
                </Button>
                <Button
                  variant={viewMode === 'tenant' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('tenant')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Tenant
                </Button>
              </div>
            </div>

            {/* Date Preset */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date Range</label>
              <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range Picker */}
            {datePreset === 'custom' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Custom Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, yyyy")} - {format(dateRange.to, "LLL dd, yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, yyyy")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Property/Tenant Filter */}
            {viewMode === 'property' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Property</label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map(property => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{formatCurrency(summary.totalCollected)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dateRange?.from && dateRange?.to && (
                <>
                  {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.transactionCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Total payments recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Transaction</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.avgTransaction)}</div>
            <p className="text-xs text-muted-foreground mt-1">Per payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending ACH</CardTitle>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{formatCurrency(summary.pendingACH)}</div>
            <p className="text-xs text-muted-foreground mt-1">Submitted, not yet cleared</p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Summary */}
      {summary.groupedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">
              {viewMode === 'property' ? 'Revenue by Property' : 'Payments by Tenant'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.groupedData.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.count} payment(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(item.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No transactions found for the selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <div className="min-w-[600px] px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.slice(0, 50).map((payment) => {
                      const property = properties.find(p => p.id === payment.property_id);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {format(parseISO(payment.payment_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            {property ? `${property.address}, ${property.city}` : 'Unknown'}
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(Number(payment.amount))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {payment.payment_method?.replace('_', ' ')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
