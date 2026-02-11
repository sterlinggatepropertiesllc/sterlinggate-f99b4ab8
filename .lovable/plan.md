

## Add Maintenance Module

### Overview
A new "Maintenance" tab in the admin dashboard for tracking property maintenance records with cost breakdowns, ownership splits, and CSV export.

### 1. Database Migration
Create `maintenance_records` table with RLS policies for property managers.

```text
Table: maintenance_records
- id (uuid, PK)
- property_id (uuid, FK to properties)
- manager_id (uuid, references auth.users)
- title (text, NOT NULL)
- description (text)
- category (text: repair, upgrade, inspection, landscaping, other)
- material_cost (numeric, default 0)
- labor_cost (numeric, default 0)
- total_cost (numeric, generated as material_cost + labor_cost)
- performed_by (text: owner, partner, vendor)
- performed_by_name (text, nullable)
- ownership_split_percentage (numeric, default 50)
- partner_share_amount (numeric, generated as total_cost * ownership_split_percentage / 100)
- status (text: pending, completed, default pending)
- performed_date (date)
- attachments (jsonb, default '[]')
- created_at (timestamptz, default now())

RLS: Property managers can manage records where manager_id = auth.uid()
```

`total_cost` and `partner_share_amount` will be generated columns so they always stay in sync.

### 2. Sidebar Update (Dashboard.tsx)
- Add `'maintenance'` to the `DashboardTab` type union
- Add a new nav item after "Payments" (audit): `{ id: 'maintenance', label: 'Maintenance', icon: Wrench }`
- Add the tab rendering case for `maintenance`

### 3. New Files

| File | Purpose |
|------|---------|
| `src/hooks/useMaintenance.ts` | CRUD hooks using react-query + Supabase (follows `usePayments.ts` pattern) |
| `src/components/maintenance/MaintenanceDashboard.tsx` | Main tab content: filters, table, export CSV |
| `src/components/maintenance/AddMaintenanceDialog.tsx` | Modal form with live cost calculations |

### 4. MaintenanceDashboard Component
- Property dropdown filter, date range picker, status filter (reusing existing date picker pattern from AuditDashboard)
- Table with columns: Property, Title, Category, Total Cost, Partner Share, Performed By, Date, Status
- Export CSV button that respects active filters
- "+ Add Maintenance" button opening the dialog

### 5. AddMaintenanceDialog Component
- Property dropdown (required), Title (required), Category dropdown, Performed Date (required)
- Performed By radio: Owner / Partner / Vendor (if Vendor, show Vendor Name field)
- Material Cost + Labor Cost inputs with live Total Cost display
- Ownership Split % input with live Partner Share calculation
- Description textarea, Status toggle, Attachments file upload (stored in Supabase storage)
- Form validation via react-hook-form + zod

### 6. CSV Export
- Generates CSV from filtered records
- Triggers browser download
- Columns match the table display

### Technical Notes
- Generated columns in Postgres ensure `total_cost` and `partner_share_amount` are always consistent
- Follows the same design patterns as the existing Payments/Audit tab
- No changes to the Payments module or any ledger integration
- File attachments stored in a new `maintenance-attachments` storage bucket
