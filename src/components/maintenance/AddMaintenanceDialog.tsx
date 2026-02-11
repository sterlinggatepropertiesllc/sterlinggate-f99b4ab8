import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreateMaintenance } from '@/hooks/useMaintenance';
import { useAuth } from '@/contexts/AuthContext';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
}

export function AddMaintenanceDialog({ open, onOpenChange, properties }: Props) {
  const { user } = useAuth();
  const createMaintenance = useCreateMaintenance();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'other',
      performed_by: 'owner',
      material_cost: 0,
      labor_cost: 0,
      ownership_split_percentage: 50,
      status: 'pending',
    },
  });

  const materialCost = watch('material_cost') || 0;
  const laborCost = watch('labor_cost') || 0;
  const splitPct = watch('ownership_split_percentage') || 0;
  const performedBy = watch('performed_by');

  const totalCost = materialCost + laborCost;
  const partnerShare = totalCost * splitPct / 100;

  const onSubmit = async (data: FormData) => {
    if (!user) return;
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
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Add Maintenance</DialogTitle>
          <DialogDescription>Record a new maintenance activity.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Property */}
          <div>
            <Label>Property *</Label>
            <Select onValueChange={(v) => setValue('property_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.address}, {p.city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.property_id && <p className="text-sm text-destructive mt-1">{errors.property_id.message}</p>}
          </div>

          {/* Title */}
          <div>
            <Label>Title *</Label>
            <Input {...register('title')} placeholder="e.g. Roof repair" />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select defaultValue="other" onValueChange={(v) => setValue('category', v)}>
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
              <Input type="date" {...register('performed_date')} />
              {errors.performed_date && <p className="text-sm text-destructive mt-1">{errors.performed_date.message}</p>}
            </div>
          </div>

          {/* Performed By */}
          <div>
            <Label>Performed By</Label>
            <RadioGroup defaultValue="owner" onValueChange={(v) => setValue('performed_by', v)} className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="owner" id="owner" />
                <Label htmlFor="owner" className="cursor-pointer">Owner</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="partner" id="partner" />
                <Label htmlFor="partner" className="cursor-pointer">Partner</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="vendor" id="vendor" />
                <Label htmlFor="vendor" className="cursor-pointer">Vendor</Label>
              </div>
            </RadioGroup>
          </div>

          {performedBy === 'vendor' && (
            <div>
              <Label>Vendor Name</Label>
              <Input {...register('performed_by_name')} placeholder="Vendor company name" />
            </div>
          )}

          {/* Costs */}
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

          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Total Cost:</span>{' '}
            <span className="font-semibold">${totalCost.toFixed(2)}</span>
          </div>

          {/* Split */}
          <div>
            <Label>Ownership Split %</Label>
            <Input type="number" step="1" min={0} max={100} {...register('ownership_split_percentage', { valueAsNumber: true })} />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Partner Share Owed:</span>{' '}
            <span className="font-semibold">${partnerShare.toFixed(2)}</span>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea {...register('description')} placeholder="Additional details..." />
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
            <Select defaultValue="pending" onValueChange={(v) => setValue('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMaintenance.isPending}>
              {createMaintenance.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
