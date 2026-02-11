import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useCreateMaintenance, useUpdateMaintenance } from '@/hooks/useMaintenance';
import { useAuth } from '@/contexts/AuthContext';
import type { MaintenanceRecord } from '@/hooks/useMaintenance';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];

const schema = z.object({
  property_id: z.string().min(1, 'Property is required'),
  title: z.string().min(1, 'Title is required'),
  category: z.string().default('other'),
  performed_date: z.string().min(1, 'Date is required'),
  performed_by: z.string().default('owner'),
  performed_by_name: z.string().optional(),
  material_cost: z.number().min(0).default(0),
  labor_cost: z.number().min(0).default(0),
  ownership_split_percentage: z.number().min(0).max(100).default(50),
  description: z.string().optional(),
  status: z.string().default('pending'),
});

type FormData = z.infer<typeof schema>;

const performedByOptions = [
  { value: 'owner', label: 'Owner' },
  { value: 'partner', label: 'Partner' },
  { value: 'vendor', label: 'Vendor' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  editRecord?: MaintenanceRecord | null;
}

export function AddMaintenanceDialog({ open, onOpenChange, properties, editRecord }: Props) {
  const { user } = useAuth();
  const createMaintenance = useCreateMaintenance();
  const updateMaintenance = useUpdateMaintenance();
  const isEdit = !!editRecord;

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'other',
      performed_by: 'owner',
      performed_date: format(new Date(), 'yyyy-MM-dd'),
      material_cost: 0,
      labor_cost: 0,
      ownership_split_percentage: 50,
      status: 'pending',
    },
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Pre-fill form when editing
  useEffect(() => {
    if (editRecord && open) {
      setValue('property_id', editRecord.property_id);
      setValue('title', editRecord.title);
      setValue('category', editRecord.category);
      setValue('performed_date', editRecord.performed_date);
      setValue('performed_by', editRecord.performed_by);
      setValue('performed_by_name', editRecord.performed_by_name || '');
      setValue('material_cost', editRecord.material_cost);
      setValue('labor_cost', editRecord.labor_cost);
      setValue('ownership_split_percentage', editRecord.ownership_split_percentage);
      setValue('description', editRecord.description || '');
      setValue('status', editRecord.status);
      setSelectedDate(new Date(editRecord.performed_date));
    } else if (!editRecord && open) {
      reset({
        category: 'other',
        performed_by: 'owner',
        performed_date: format(new Date(), 'yyyy-MM-dd'),
        material_cost: 0,
        labor_cost: 0,
        ownership_split_percentage: 50,
        status: 'pending',
      });
      setSelectedDate(new Date());
    }
  }, [editRecord, open, setValue, reset]);

  const materialCost = watch('material_cost') || 0;
  const laborCost = watch('labor_cost') || 0;
  const splitPct = watch('ownership_split_percentage') || 0;
  const performedBy = watch('performed_by');

  const totalCost = materialCost + laborCost;
  const partnerShare = totalCost * splitPct / 100;

  const formatCurrency = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    if (isEdit && editRecord) {
      await updateMaintenance.mutateAsync({
        id: editRecord.id,
        updates: {
          property_id: data.property_id,
          title: data.title,
          category: data.category,
          performed_date: data.performed_date,
          performed_by: data.performed_by,
          performed_by_name: data.performed_by === 'vendor' ? data.performed_by_name : null,
          material_cost: data.material_cost,
          labor_cost: data.labor_cost,
          ownership_split_percentage: data.ownership_split_percentage,
          description: data.description || null,
          status: data.status,
        },
      });
    } else {
      await createMaintenance.mutateAsync({
        property_id: data.property_id,
        title: data.title,
        category: data.category,
        performed_date: data.performed_date,
        performed_by: data.performed_by,
        material_cost: data.material_cost,
        labor_cost: data.labor_cost,
        ownership_split_percentage: data.ownership_split_percentage,
        description: data.description,
        status: data.status,
        manager_id: user.id,
        performed_by_name: data.performed_by === 'vendor' ? data.performed_by_name : undefined,
      });
    }
    reset();
    onOpenChange(false);
  };

  const isPending = createMaintenance.isPending || updateMaintenance.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{isEdit ? 'Edit Maintenance' : 'Add Maintenance'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update maintenance record details.' : 'Record a new maintenance activity.'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h3>

            <div>
              <Label>Property *</Label>
              <Select value={watch('property_id') || ''} onValueChange={(v) => setValue('property_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.property_id && <p className="text-sm text-destructive mt-1">{errors.property_id.message}</p>}
            </div>

            <div>
              <Label>Title *</Label>
              <Input {...register('title')} placeholder="e.g. Roof repair" />
              {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={watch('category') || 'other'} onValueChange={(v) => setValue('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="upgrade">Upgrade</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="landscaping">Landscaping</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Performed Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                    >
                      {format(selectedDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setValue('performed_date', format(date, 'yyyy-MM-dd'));
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {errors.performed_date && <p className="text-sm text-destructive mt-1">{errors.performed_date.message}</p>}
              </div>
            </div>

            {/* Performed By — Pill Toggles */}
            <div>
              <Label>Performed By</Label>
              <div className="flex gap-2 mt-2">
                {performedByOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setValue('performed_by', opt.value)}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border',
                      performedBy === opt.value
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor name with smooth transition */}
            <div className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out',
              performedBy === 'vendor' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
            )}>
              <Label>Vendor Name</Label>
              <Input {...register('performed_by_name')} placeholder="Vendor company name" />
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea {...register('description')} placeholder="Additional details..." rows={3} />
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <Select value={watch('status') || 'pending'} onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 2: Cost Breakdown */}
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cost Breakdown</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Material Cost ($)</Label>
                <Input type="number" step="0.01" {...register('material_cost', { valueAsNumber: true })} />
              </div>
              <div>
                <Label>Labor Cost ($)</Label>
                <Input type="number" step="0.01" {...register('labor_cost', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Cost</p>
              <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
            </div>
          </Card>

          {/* Section 3: Ownership Split */}
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ownership Split</h3>
            <div>
              <Label>Split %</Label>
              <Input type="number" step="1" min={0} max={100} {...register('ownership_split_percentage', { valueAsNumber: true })} />
            </div>
            <div className="rounded-lg bg-accent/10 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Partner Share Owed</p>
              <p className="text-2xl font-bold text-accent">{formatCurrency(partnerShare)}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">Partner share is calculated automatically.</p>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
