-- Create junction table for tenant-property many-to-many relationship
CREATE TABLE public.tenant_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rent_amount NUMERIC DEFAULT 0,
  lease_start_date DATE,
  lease_end_date DATE,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, property_id)
);

-- Enable RLS
ALTER TABLE public.tenant_properties ENABLE ROW LEVEL SECURITY;

-- Policy: Property managers can manage tenant properties for their tenants
CREATE POLICY "Property managers can manage tenant properties"
ON public.tenant_properties FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.tenants t 
  WHERE t.id = tenant_properties.tenant_id 
  AND t.manager_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tenants t 
  WHERE t.id = tenant_properties.tenant_id 
  AND t.manager_id = auth.uid()
));

-- Policy: Tenants can view their own property assignments
CREATE POLICY "Tenants can view their property assignments"
ON public.tenant_properties FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tenants t 
  WHERE t.id = tenant_properties.tenant_id 
  AND t.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_tenant_properties_updated_at
BEFORE UPDATE ON public.tenant_properties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing property assignments from tenants table to tenant_properties
INSERT INTO public.tenant_properties (tenant_id, property_id, rent_amount, lease_start_date, lease_end_date, is_primary)
SELECT id, property_id, rent_amount, lease_start_date, lease_end_date, true
FROM public.tenants
WHERE property_id IS NOT NULL;