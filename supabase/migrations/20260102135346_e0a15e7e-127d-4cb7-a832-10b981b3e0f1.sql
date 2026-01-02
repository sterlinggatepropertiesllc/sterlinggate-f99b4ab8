-- Add current_balance column to tenants table
ALTER TABLE public.tenants ADD COLUMN current_balance numeric DEFAULT 0;

-- Create balance_adjustments table for audit trail
CREATE TABLE public.balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('credit', 'charge', 'late_fee', 'payment', 'correction')),
  description text,
  previous_balance numeric NOT NULL,
  new_balance numeric NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;

-- Property managers can manage adjustments for their tenants
CREATE POLICY "Property managers can manage balance adjustments"
  ON public.balance_adjustments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.tenants WHERE tenants.id = balance_adjustments.tenant_id 
    AND tenants.manager_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenants WHERE tenants.id = balance_adjustments.tenant_id 
    AND tenants.manager_id = auth.uid()
  ));

-- Tenants can view their own adjustments
CREATE POLICY "Tenants can view their own balance adjustments"
  ON public.balance_adjustments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenants WHERE tenants.id = balance_adjustments.tenant_id 
    AND tenants.user_id = auth.uid()
  ));