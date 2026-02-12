

## Refactor Maintenance/Expense Form — Simplified, Mobile-First

This is a significant refactor touching the database schema, a new table for custom people, file uploads with proof viewing, and a complete form UI overhaul.

### Database Changes (Migration)

**1. Alter `maintenance_records` table:**
- Drop generated columns `total_cost` and `partner_share_amount`
- Drop `material_cost` and `labor_cost` columns
- Add `total_cost NUMERIC NOT NULL DEFAULT 0` as a regular (non-generated) column
- Recreate `partner_share_amount` as a generated column: `total_cost * ownership_split_percentage / 100`
- Change default for `status` from `'pending'` to `'completed'`
- Keep `category` column in the database (default `'other'`) but remove it from the form UI -- avoids a destructive migration on existing data

**2. Create `expense_people` table:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name TEXT NOT NULL`
- `created_by UUID NOT NULL REFERENCES auth.users(id)`
- `created_at TIMESTAMPTZ DEFAULT now()`
- RLS: users can only see/manage their own people

**3. Create `maintenance_attachments` table:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `maintenance_id UUID NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE`
- `file_url TEXT NOT NULL`
- `file_type TEXT NOT NULL`
- `file_name TEXT`
- `created_at TIMESTAMPTZ DEFAULT now()`
- RLS: accessible by the manager who owns the parent maintenance record

### Frontend Changes

**File: `src/hooks/useMaintenance.ts`**
- Update `MaintenanceRecord` interface: remove `material_cost`, `labor_cost`, `category`; keep `total_cost`
- Update `MaintenanceInsert`: remove `material_cost`, `labor_cost`, `category`; add `total_cost`
- Update `MaintenanceUpdate`: same removals/additions

**File: `src/hooks/useExpensePeople.ts` (NEW)**
- `useExpensePeople()` -- fetch all people for current user
- `useCreateExpensePerson()` -- insert new person
- Simple CRUD hook following existing patterns

**File: `src/hooks/useMaintenanceAttachments.ts` (NEW)**
- `useMaintenanceAttachments(maintenanceId)` -- fetch attachments for a record
- `useUploadMaintenanceAttachment()` -- upload file to `maintenance-attachments` bucket, insert row
- `useDeleteMaintenanceAttachment()` -- delete file and row

**File: `src/components/maintenance/AddMaintenanceDialog.tsx` (REWRITE)**
- Remove Category dropdown entirely
- Remove Material Cost and Labor Cost fields
- Add single "Total Cost ($)" number input
- Replace "Performed By" pill toggles with a dropdown: "Partner" + all custom people from `expense_people` + "+ Add Person" option
- When "+ Add Person" selected, open inline input (not a separate modal) to type name and save
- Default status changed to "Completed"
- Add "Upload Proof (Optional)" section at the bottom with file input accepting images and PDFs
- Show thumbnail previews of selected files before save
- Mobile optimizations: full-width inputs, `text-base` (16px) font size, safe-area padding, dynamic height for dialog

**File: `src/components/maintenance/AttachmentGallery.tsx` (NEW)**
- Display uploaded proof thumbnails in a grid
- Tap to open fullscreen image viewer modal
- Swipe between images in fullscreen mode
- Lazy load images with placeholder
- PDF files shown as file icon with name

**File: `src/components/maintenance/MaintenanceDashboard.tsx`**
- Remove "Category" column from the table
- Update CSV export to exclude category, material_cost, labor_cost
- Show attachment count indicator on rows that have proof

### Technical Details

```text
Schema migration:

  maintenance_records:
    DROP total_cost (generated)
    DROP partner_share_amount (generated)
    DROP material_cost
    DROP labor_cost
    ADD total_cost NUMERIC NOT NULL DEFAULT 0
    ADD partner_share_amount NUMERIC GENERATED ALWAYS AS (total_cost * ownership_split_percentage / 100)
    ALTER status DEFAULT 'completed'

  NEW TABLE expense_people:
    id, name, created_by (FK auth.users), created_at
    RLS: created_by = auth.uid()

  NEW TABLE maintenance_attachments:
    id, maintenance_id (FK maintenance_records CASCADE), file_url, file_type, file_name, created_at
    RLS: via maintenance_records.manager_id = auth.uid()

  Storage: uses existing 'maintenance-attachments' bucket (already created, private)

Data migration for existing rows:
  UPDATE maintenance_records SET total_cost = material_cost + labor_cost
  (run before dropping old columns -- handled in single migration)
```

### Files Summary

| File | Action |
|------|--------|
| Database migration | Alter maintenance_records, create expense_people, create maintenance_attachments |
| `src/hooks/useMaintenance.ts` | Update interfaces to remove material/labor cost, add total_cost |
| `src/hooks/useExpensePeople.ts` | New -- CRUD for custom expense people |
| `src/hooks/useMaintenanceAttachments.ts` | New -- upload/fetch/delete proof files |
| `src/components/maintenance/AddMaintenanceDialog.tsx` | Major rewrite -- simplified form, new people dropdown, proof upload |
| `src/components/maintenance/AttachmentGallery.tsx` | New -- thumbnail grid with fullscreen viewer |
| `src/components/maintenance/MaintenanceDashboard.tsx` | Remove category column, add attachment indicators |
