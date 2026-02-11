
-- Create maintenance_records table
CREATE TABLE public.maintenance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  material_cost numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (material_cost + labor_cost) STORED,
  performed_by text NOT NULL DEFAULT 'owner',
  performed_by_name text,
  ownership_split_percentage numeric NOT NULL DEFAULT 50,
  partner_share_amount numeric GENERATED ALWAYS AS ((material_cost + labor_cost) * ownership_split_percentage / 100) STORED,
  status text NOT NULL DEFAULT 'pending',
  performed_date date NOT NULL DEFAULT CURRENT_DATE,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- RLS: Property managers can do everything on their own records
CREATE POLICY "Property managers can view their maintenance records"
  ON public.maintenance_records FOR SELECT
  USING (manager_id = auth.uid());

CREATE POLICY "Property managers can insert maintenance records"
  ON public.maintenance_records FOR INSERT
  WITH CHECK (manager_id = auth.uid() AND has_role(auth.uid(), 'property_manager'::app_role));

CREATE POLICY "Property managers can update their maintenance records"
  ON public.maintenance_records FOR UPDATE
  USING (manager_id = auth.uid());

CREATE POLICY "Property managers can delete their maintenance records"
  ON public.maintenance_records FOR DELETE
  USING (manager_id = auth.uid());

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-attachments', 'maintenance-attachments', false);

CREATE POLICY "Managers can upload maintenance attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'maintenance-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Managers can view their maintenance attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'maintenance-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Managers can delete their maintenance attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'maintenance-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
