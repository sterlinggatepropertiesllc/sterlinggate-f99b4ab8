import { useState, useEffect, useRef } from 'react';
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
import { useExpensePeople, useCreateExpensePerson } from '@/hooks/useExpensePeople';
import { useMaintenanceAttachments, useUploadMaintenanceAttachment, useDeleteMaintenanceAttachment } from '@/hooks/useMaintenanceAttachments';
import { useAuth } from '@/contexts/AuthContext';
import { AttachmentGallery } from './AttachmentGallery';
import { Upload, Plus, Loader2 } from 'lucide-react';
import type { MaintenanceRecord } from '@/hooks/useMaintenance';
import type { Database } from '@/integrations/supabase/types';

type Property = Database['public']['Tables']['properties']['Row'];

const schema = z.object({
  property_id: z.string().min(1, 'Property is required'),
  title: z.string().min(1, 'Title is required'),
  performed_date: z.string().min(1, 'Date is required'),
  performed_by: z.string().default('partner'),
  performed_by_name: z.string().optional(),
  total_cost: z.number().min(0).default(0),
  ownership_split_percentage: z.number().min(0).max(100).default(50),
  description: z.string().optional(),
  status: z.string().default('completed'),
});

type FormInput = z.input<typeof schema>;
type FormData = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  editRecord?: MaintenanceRecord | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function AddMaintenanceDialog({ open, onOpenChange, properties, editRecord }: Props) {
  const { user } = useAuth();
  const createMaintenance = useCreateMaintenance();
  const updateMaintenance = useUpdateMaintenance();
  const { data: people = [] } = useExpensePeople();
  const createPerson = useCreateExpensePerson();
  const { data: existingAttachments = [] } = useMaintenanceAttachments(editRecord?.id);
  const uploadAttachment = useUploadMaintenanceAttachment();
  const deleteAttachment = useDeleteMaintenanceAttachment();
  const isEdit = !!editRecord;

  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormInput, undefined, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      performed_by: 'partner',
      performed_date: format(new Date(), 'yyyy-MM-dd'),
      total_cost: 0,
      ownership_split_percentage: 50,
      status: 'completed',
    },
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (editRecord && open) {
      setValue('property_id', editRecord.property_id);
      setValue('title', editRecord.title);
      setValue('performed_date', editRecord.performed_date);
      setValue('performed_by', editRecord.performed_by);
      setValue('performed_by_name', editRecord.performed_by_name || '');
      setValue('total_cost', editRecord.total_cost || 0);
      setValue('ownership_split_percentage', editRecord.ownership_split_percentage);
      setValue('description', editRecord.description || '');
      setValue('status', editRecord.status);
      setSelectedDate(new Date(editRecord.performed_date));
    } else if (!editRecord && open) {
      reset({
        performed_by: 'partner',
        performed_date: format(new Date(), 'yyyy-MM-dd'),
        total_cost: 0,
        ownership_split_percentage: 50,
        status: 'completed',
      });
      setSelectedDate(new Date());
      setPendingFiles([]);
      setPendingPreviews([]);
    }
  }, [editRecord, open, setValue, reset]);

  const totalCost = watch('total_cost') || 0;
  const splitPct = watch('ownership_split_percentage') || 0;
  const performedBy = watch('performed_by');
  const partnerShare = totalCost * splitPct / 100;

  const formatCurrency = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const handlePerformedByChange = (value: string) => {
    if (value === '__add_person__') {
      setAddingPerson(true);
      return;
    }
    setValue('performed_by', value);
    // Set display name for custom people
    const person = people.find((p) => p.id === value);
    if (person) {
      setValue('performed_by_name', person.name);
    } else {
      setValue('performed_by_name', '');
    }
  };

  const handleSavePerson = async () => {
    if (!newPersonName.trim()) return;
    const result = await createPerson.mutateAsync(newPersonName.trim());
    setValue('performed_by', result.id);
    setValue('performed_by_name', result.name);
    setNewPersonName('');
    setAddingPerson(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        return false;
      }
      return f.type.startsWith('image/') || f.type === 'application/pdf';
    });

    setPendingFiles((prev) => [...prev, ...valid]);

    // Generate previews for images
    valid.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPendingPreviews((prev) => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setPendingPreviews((prev) => [...prev, '__pdf__']);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;

    let recordId: string;

    if (isEdit && editRecord) {
      await updateMaintenance.mutateAsync({
        id: editRecord.id,
        updates: {
          property_id: data.property_id,
          title: data.title,
          performed_date: data.performed_date,
          performed_by: data.performed_by,
          performed_by_name: data.performed_by_name || null,
          total_cost: data.total_cost,
          ownership_split_percentage: data.ownership_split_percentage,
          description: data.description || null,
          status: data.status,
        },
      });
      recordId = editRecord.id;
    } else {
      const result = await createMaintenance.mutateAsync({
        property_id: data.property_id,
        title: data.title,
        performed_date: data.performed_date,
        performed_by: data.performed_by,
        total_cost: data.total_cost,
        ownership_split_percentage: data.ownership_split_percentage,
        description: data.description,
        status: data.status,
        manager_id: user.id,
        performed_by_name: data.performed_by_name || undefined,
      });
      recordId = (result as any).id;
    }

    // Upload pending files
    for (const file of pendingFiles) {
      await uploadAttachment.mutateAsync({ maintenanceId: recordId, file });
    }

    reset();
    setPendingFiles([]);
    setPendingPreviews([]);
    onOpenChange(false);
  };

  const isPending = createMaintenance.isPending || updateMaintenance.isPending || uploadAttachment.isPending;

  // Determine display value for performed_by select
  const performedByDisplayValue = performedBy === 'partner' ? 'partner' : performedBy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[var(--tg-viewport-stable-height,90vh)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{isEdit ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update expense details.' : 'Record a new expense or maintenance activity.'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Property */}
          <div>
            <Label className="text-base">Property *</Label>
            <Select value={watch('property_id') || ''} onValueChange={(v) => setValue('property_id', v)}>
              <SelectTrigger className="text-base"><SelectValue placeholder="Select property" /></SelectTrigger>
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
            <Label className="text-base">Title *</Label>
            <Input {...register('title')} placeholder="e.g. Insurance, Light Bill, Roof Repair" className="text-base" />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>

          {/* Date & Status row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-base">Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal text-base", !selectedDate && "text-muted-foreground")}
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
            </div>
            <div>
              <Label className="text-base">Status</Label>
              <Select value={watch('status') || 'completed'} onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger className="text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Paid / Performed By */}
          <div>
            <Label className="text-base">Paid / Performed By</Label>
            {addingPerson ? (
              <div className="flex gap-2 mt-1">
                <Input
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Person name"
                  className="text-base flex-1"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSavePerson(); } }}
                />
                <Button type="button" size="sm" onClick={handleSavePerson} disabled={createPerson.isPending || !newPersonName.trim()}>
                  {createPerson.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setAddingPerson(false); setNewPersonName(''); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1.5">
                <button
                  type="button"
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                    performedBy === 'partner'
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  )}
                  onClick={() => handlePerformedByChange('partner')}
                >
                  Partner
                </button>
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                      performedBy === p.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                    )}
                    onClick={() => handlePerformedByChange(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-dashed border-primary/50 text-primary hover:bg-primary/10"
                  onClick={() => setAddingPerson(true)}
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />Add
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <Label className="text-base">Description</Label>
            <Textarea {...register('description')} placeholder="Additional details or cost breakdown..." rows={3} className="text-base" />
          </div>

          {/* Cost & Split */}
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-base">Total Cost ($) *</Label>
                <Input type="number" step="0.01" {...register('total_cost', { valueAsNumber: true })} className="text-base" />
              </div>
              <div>
                <Label className="text-base">Split %</Label>
                <Input type="number" step="1" min={0} max={100} {...register('ownership_split_percentage', { valueAsNumber: true })} className="text-base" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</p>
                <p className="text-xl font-bold">{formatCurrency(totalCost)}</p>
              </div>
              <div className="rounded-lg bg-accent/10 p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Partner Share</p>
                <p className="text-xl font-bold text-accent">{formatCurrency(partnerShare)}</p>
              </div>
            </div>
          </Card>

          {/* Proof Upload */}
          <div className="space-y-3">
            <Label className="text-base">Upload Proof (Optional)</Label>

            {/* Existing attachments (edit mode) */}
            {isEdit && existingAttachments.length > 0 && (
              <AttachmentGallery
                attachments={existingAttachments}
                onDelete={(att) => deleteAttachment.mutate({ id: att.id, fileUrl: att.file_url, maintenanceId: editRecord!.id })}
                isDeleting={deleteAttachment.isPending}
              />
            )}

            {/* Pending file previews */}
            {pendingPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pendingPreviews.map((preview, i) => (
                  <button
                    key={i}
                    type="button"
                    className="relative aspect-square rounded-lg overflow-hidden border border-border group"
                    onClick={() => removePendingFile(i)}
                  >
                    {preview === '__pdf__' ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <span className="text-xs text-muted-foreground">PDF</span>
                      </div>
                    ) : (
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-destructive/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-xs text-white font-medium">Remove</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full text-base"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" /> Choose Files
            </Button>
            <p className="text-xs text-muted-foreground text-center">Images and PDFs, max 10MB each</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="text-base">Cancel</Button>
            <Button type="submit" disabled={isPending} className="text-base">
              {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : isEdit ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
