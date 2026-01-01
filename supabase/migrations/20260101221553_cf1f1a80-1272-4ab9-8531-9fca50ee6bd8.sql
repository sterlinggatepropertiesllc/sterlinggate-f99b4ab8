-- Step 1: Drop the existing FK that points to auth.users
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_user_id_fkey;

-- Step 2: Add FK to profiles instead (profiles.id matches auth.users.id)
ALTER TABLE public.tenants 
ADD CONSTRAINT tenants_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 3: Add manager_id column for fast filtering
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id);

-- Step 4: Backfill manager_id from properties or created_by
UPDATE public.tenants t
SET manager_id = COALESCE(
  (SELECT p.manager_id FROM public.properties p WHERE p.id = t.property_id),
  t.created_by
)
WHERE t.manager_id IS NULL;

-- Step 5: Add index for fast manager-scoped queries
CREATE INDEX IF NOT EXISTS idx_tenants_manager_id_created_at 
ON public.tenants(manager_id, created_at DESC);

-- Step 6: Update RLS policies to use manager_id
DROP POLICY IF EXISTS "Property managers can manage their tenants" ON public.tenants;

CREATE POLICY "Property managers can manage their tenants" 
ON public.tenants FOR ALL
USING (manager_id = auth.uid())
WITH CHECK (manager_id = auth.uid());

-- Step 7: Enable realtime for tenants table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;