-- Create payments table for tracking rent and financial data
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES leases(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT DEFAULT 'bank_transfer',
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies for payments
CREATE POLICY "Property managers can view payments for their properties"
ON public.payments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = payments.property_id
  AND properties.manager_id = auth.uid()
));

CREATE POLICY "Property managers can insert payments for their properties"
ON public.payments
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = payments.property_id
  AND properties.manager_id = auth.uid()
));

CREATE POLICY "Property managers can update payments for their properties"
ON public.payments
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = payments.property_id
  AND properties.manager_id = auth.uid()
));

CREATE POLICY "Property managers can delete payments for their properties"
ON public.payments
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM properties
  WHERE properties.id = payments.property_id
  AND properties.manager_id = auth.uid()
));

CREATE POLICY "Tenants can view their own payments"
ON public.payments
FOR SELECT
USING (tenant_id = auth.uid());