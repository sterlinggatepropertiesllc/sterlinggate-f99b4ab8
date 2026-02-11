

## Maintenance Module UX Overhaul

A comprehensive UI/interaction upgrade to make the Maintenance module feel modern and production-grade. No database changes.

### 1. Date Range Picker (Google-style)

Replace the two native `<Input type="date">` fields with a single Popover-based date range picker:
- Uses the existing `Calendar` component with `mode="range"` (supported by `react-day-picker`)
- Shows a clickable button displaying "Feb 1, 2026 -- Feb 28, 2026" or "Select date range"
- Highlights selected range visually
- Clears with an X button
- Filters table in real-time as range changes

### 2. Edit Functionality

- Add `useUpdateMaintenance` hook to `useMaintenance.ts` (uses `.update().eq('id', id)`)
- Refactor `AddMaintenanceDialog` to accept an optional `editRecord?: MaintenanceRecord` prop
- When `editRecord` is provided: pre-fill all fields, show "Edit Maintenance" title, call update instead of create
- Add a Pencil icon button next to the Trash icon in each row
- Clicking opens the dialog pre-filled with that record's data

### 3. Bulk Selection + Live Summary Bar

- Add `selectedIds: Set<string>` state in `MaintenanceDashboard`
- Add a `Checkbox` in the header row (master select/deselect all visible)
- Add a `Checkbox` in each data row
- When 1+ rows selected, show a sticky summary bar below the table with:
  - Selected count, Total Cost, Total Partner Share (all memoized)
  - "Export Selected" button that exports only checked rows to CSV
- Selection state is purely client-side, no re-fetching

### 4. Summary Cards Above Table

Add 3 cards above the table (below filters):
- **Total Records** -- count of filtered records
- **Total Maintenance Cost** -- sum of `total_cost` from filtered records
- **Total Partner Share** -- sum of `partner_share_amount` from filtered records
- All values derived from memoized `filtered` array, updating as filters change

### 5. Visual Design Upgrades (MaintenanceDashboard)

- Table rows: increase vertical padding (`py-4`), add hover effect (`hover:bg-muted/50 transition-colors`)
- Currency formatting: use `toLocaleString('en-US', { style: 'currency', currency: 'USD' })` for proper `$1,670.00` display
- Partner Share column: subtle accent color text
- Status badges: Completed = green (`bg-emerald-500/15 text-emerald-500`), Pending = amber (`bg-amber-500/15 text-amber-500`) with custom classes
- Buttons: "Add Maintenance" stays primary, "Export CSV" stays outline/secondary
- Property names: `max-w-[180px] truncate` with title tooltip

### 6. Modal UX Upgrade (AddMaintenanceDialog)

Reorganize into clearly labeled sections:

**Section 1 -- Basic Info** (with a subtle section header)
- Property, Title, Category, Date, Performed By

**Section 2 -- Cost Breakdown** (inside a Card with border)
- Material Cost, Labor Cost side-by-side
- Total Cost displayed large and bold below

**Section 3 -- Ownership Split** (inside a Card with border)
- Split % input
- Partner Share displayed large, bold, with accent color
- Helper text: "Partner share is calculated automatically."

**Performed By** -- Replace radio circles with pill-style toggle buttons:
- Three side-by-side buttons styled like selectable pills (using ToggleGroup or custom styled buttons)
- Active state has primary bg, inactive has muted bg
- Vendor Name field animates in with a CSS transition when "Vendor" is selected

### 7. Table Improvements

- Right-align all monetary columns
- Proper currency formatting throughout
- Subtle row dividers (already via Table component, ensure visible)
- Increased row padding for breathing room
- Actions column: Edit (Pencil) + Delete (Trash) icons side-by-side

### Files to Change

| File | Changes |
|------|---------|
| `src/hooks/useMaintenance.ts` | Add `useUpdateMaintenance` hook |
| `src/components/maintenance/MaintenanceDashboard.tsx` | Full rewrite: date range picker, summary cards, bulk selection, visual upgrades, edit support |
| `src/components/maintenance/AddMaintenanceDialog.tsx` | Full rewrite: edit mode support, sectioned layout, pill toggles, card-style cost sections |

### Technical Notes

- All summary calculations use `useMemo` derived from `filtered` array -- no extra queries
- Bulk selection is pure client state (`Set<string>`) -- no performance impact
- `react-day-picker` already supports `mode="range"` out of the box via the existing `Calendar` component
- No database schema changes, no RLS changes, no new tables

