-- Enable realtime for tenant_properties table
ALTER TABLE public.tenant_properties REPLICA IDENTITY FULL;

-- Drop existing trigger if it exists (to recreate cleanly)
DROP TRIGGER IF EXISTS sync_primary_property_trigger ON public.tenant_properties;

-- Create/replace the sync function
CREATE OR REPLACE FUNCTION public.sync_tenant_primary_property()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT or UPDATE: If this is now the primary, update tenants.property_id
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.is_primary = true THEN
      UPDATE public.tenants 
      SET property_id = NEW.property_id,
          rent_amount = COALESCE(NEW.rent_amount, 0),
          updated_at = now()
      WHERE id = NEW.tenant_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- On DELETE: If we deleted the primary, find new primary or set null
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_primary = true THEN
      -- Try to find another property to set as primary, or set to null
      UPDATE public.tenants 
      SET property_id = (
        SELECT property_id FROM public.tenant_properties 
        WHERE tenant_id = OLD.tenant_id 
        ORDER BY created_at ASC LIMIT 1
      ),
      rent_amount = COALESCE((
        SELECT rent_amount FROM public.tenant_properties 
        WHERE tenant_id = OLD.tenant_id 
        ORDER BY created_at ASC LIMIT 1
      ), 0),
      updated_at = now()
      WHERE id = OLD.tenant_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on tenant_properties
CREATE TRIGGER sync_primary_property_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_properties
FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_primary_property();

-- Backfill: Fix tenants that have no tenant_properties but still have property_id set
UPDATE public.tenants t
SET property_id = NULL, rent_amount = 0, updated_at = now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_properties tp WHERE tp.tenant_id = t.id
)
AND (t.property_id IS NOT NULL OR t.rent_amount > 0);

-- Backfill: Fix tenants that have tenant_properties but property_id doesn't match primary
UPDATE public.tenants t
SET property_id = tp.property_id, 
    rent_amount = COALESCE(tp.rent_amount, 0),
    updated_at = now()
FROM public.tenant_properties tp
WHERE tp.tenant_id = t.id
  AND tp.is_primary = true
  AND (t.property_id IS DISTINCT FROM tp.property_id OR t.rent_amount IS DISTINCT FROM tp.rent_amount);