

## Maintenance Module — Final Polish

### Root Cause Analysis

**Storage Upload RLS Error (Part 4):** The storage policy expects the folder path to start with the user's `auth.uid()`, but the upload code uses `maintenanceId` as the folder name. This mismatch causes every upload to fail. Additionally, the bucket is private, so `getPublicUrl()` returns URLs that won't load -- need to either make the bucket public or use signed URLs.

**UUID in Table (Part 2):** The `performed_by` column stores the UUID of the person from `expense_people`, and the dashboard renders `performed_by_name || performed_by` -- when `performed_by_name` is null (for older records), the raw UUID shows.

### Changes

#### 1. Replace Dropdown with Pill Buttons (`AddMaintenanceDialog.tsx`)

Replace the `<Select>` dropdown for "Paid / Performed By" with a row of clickable pill buttons:
- `[ Partner ]` -- always present
- `[ {person.name} ]` -- one per entry in `expense_people`
- `[ + Add ]` -- triggers inline name input (existing behavior, just triggered from pill instead of dropdown)

Selected pill gets `bg-primary text-primary-foreground`; unselected gets `bg-muted`. Store the `performed_by` value (either `'partner'` or the person's UUID) and `performed_by_name` as before.

#### 2. Fix UUID Display in Table (`MaintenanceDashboard.tsx`)

The `performed_by_name` field is sometimes null for records where `performed_by` is a UUID. Fix:
- In the table cell, display `performed_by_name` if available
- If `performed_by` is `'partner'`, display "Partner"  
- Otherwise fall back to "—" (never show a UUID)

Also in CSV export: same logic.

#### 3. Fix Title Wrapping (`MaintenanceDashboard.tsx`)

Add `max-w-[240px] truncate` to the Title `<TableCell>` so long titles get ellipsis instead of wrapping.

#### 4. Fix Storage Upload RLS (`migration + useMaintenanceAttachments.ts`)

**Database migration:**
- Drop and recreate the 3 storage policies for `maintenance-attachments` bucket to use the maintenance record's ID path (matching what the code uploads) instead of `auth.uid()`. The new policy will join through `maintenance_records` to verify the uploader is the manager.
- Make the bucket public so uploaded file URLs are accessible without signed URLs.

**Hook update (`useMaintenanceAttachments.ts`):**
- Keep existing path pattern `${maintenanceId}/${uuid}.${ext}` (it's logical and correct)
- The storage policies will now match this pattern

#### 5. Add Proof Column with Eye Icon (`MaintenanceDashboard.tsx`)

- Fetch attachment counts per record by adding a lightweight query or by fetching all attachments grouped by maintenance_id
- Add a new "Proof" column in the table header
- For rows with attachments: render an `Eye` icon button
- Clicking the eye opens the `AttachmentGallery` in a read-only dialog (no delete buttons)
- For rows without attachments: render nothing

This requires:
- A new hook `useAllMaintenanceAttachments()` that fetches all attachments for the current user's records (or a count query)
- A state variable for which record's attachments to view
- Reuse `AttachmentGallery` component in read-only mode (no `onDelete` prop)

#### 6. UI Cleanup

- Remove extra spacing in the performer column
- Ensure consistent `py-4` padding on all table cells
- Verify responsive behavior (table already has horizontal scroll via Card overflow)

### Files

| File | Action |
|------|--------|
| Database migration | Fix storage policies, make bucket public |
| `src/hooks/useMaintenanceAttachments.ts` | Add `useAllMaintenanceAttachments()` hook for fetching all attachment records |
| `src/components/maintenance/AddMaintenanceDialog.tsx` | Replace dropdown with pill buttons for "Paid / Performed By" |
| `src/components/maintenance/MaintenanceDashboard.tsx` | Fix UUID display, add title truncation, add Proof column with eye icon + viewer dialog |
| `src/components/maintenance/AttachmentGallery.tsx` | No changes needed -- already supports read-only mode (omit `onDelete` prop) |

### Technical Details

```text
Storage policy fix:

  Current (broken): auth.uid()::text = (storage.foldername(name))[1]
  Upload path:      {maintenanceId}/{uuid}.{ext}
  
  Fix: Change storage policies to verify ownership through maintenance_records table:
    EXISTS (
      SELECT 1 FROM public.maintenance_records mr
      WHERE mr.id::text = (storage.foldername(name))[1]
      AND mr.manager_id = auth.uid()
    )

  Also: UPDATE storage.buckets SET public = true WHERE id = 'maintenance-attachments'
  (so getPublicUrl() works for viewing)

Pill button UI:
  <div className="flex flex-wrap gap-2 mt-1">
    <button className={cn("px-3 py-1.5 rounded-full text-sm ...", selected && "bg-primary text-primary-foreground")}>
      Partner
    </button>
    {people.map(p => <button ...>{p.name}</button>)}
    <button>+ Add</button>
  </div>

UUID display fix:
  Current:  r.performed_by_name || capitalise(r.performed_by)
  Fixed:    r.performed_by_name || (r.performed_by === 'partner' ? 'Partner' : '—')
```
