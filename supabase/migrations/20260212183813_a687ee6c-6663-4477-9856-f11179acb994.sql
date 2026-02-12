
-- Step 1: Add a temp column to preserve computed values
ALTER TABLE maintenance_records ADD COLUMN _temp_total NUMERIC;
UPDATE maintenance_records SET _temp_total = material_cost + labor_cost;

-- Step 2: Drop generated columns
ALTER TABLE maintenance_records DROP COLUMN partner_share_amount;
ALTER TABLE maintenance_records DROP COLUMN total_cost;

-- Step 3: Drop old cost columns
ALTER TABLE maintenance_records DROP COLUMN material_cost;
ALTER TABLE maintenance_records DROP COLUMN labor_cost;

-- Step 4: Add total_cost as regular column
ALTER TABLE maintenance_records ADD COLUMN total_cost NUMERIC NOT NULL DEFAULT 0;

-- Step 5: Restore data from temp
UPDATE maintenance_records SET total_cost = COALESCE(_temp_total, 0);
ALTER TABLE maintenance_records DROP COLUMN _temp_total;

-- Step 6: Recreate partner_share_amount as generated column
ALTER TABLE maintenance_records ADD COLUMN partner_share_amount NUMERIC GENERATED ALWAYS AS (total_cost * ownership_split_percentage / 100) STORED;

-- Step 7: Change default status to 'completed'
ALTER TABLE maintenance_records ALTER COLUMN status SET DEFAULT 'completed';

-- ============================================
-- Create expense_people table
-- ============================================
CREATE TABLE public.expense_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expense_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own people"
  ON public.expense_people FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own people"
  ON public.expense_people FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own people"
  ON public.expense_people FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================
-- Create maintenance_attachments table
-- ============================================
CREATE TABLE public.maintenance_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_id UUID NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.maintenance_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view attachments for their records"
  ON public.maintenance_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM maintenance_records mr
    WHERE mr.id = maintenance_attachments.maintenance_id
    AND mr.manager_id = auth.uid()
  ));

CREATE POLICY "Managers can insert attachments for their records"
  ON public.maintenance_attachments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM maintenance_records mr
    WHERE mr.id = maintenance_attachments.maintenance_id
    AND mr.manager_id = auth.uid()
  ));

CREATE POLICY "Managers can delete attachments for their records"
  ON public.maintenance_attachments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM maintenance_records mr
    WHERE mr.id = maintenance_attachments.maintenance_id
    AND mr.manager_id = auth.uid()
  ));
