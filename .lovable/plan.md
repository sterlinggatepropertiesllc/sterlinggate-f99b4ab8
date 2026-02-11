

# Fix Mobile Layout for Admin Panel

## Problems Identified

After thoroughly reviewing all admin panel components, here are the mobile layout issues found:

### 1. TenantsTable - Full HTML table doesn't work on mobile
The tenants list uses a 7-column `<Table>` that overflows horizontally on mobile. Columns like "Contact", "Property", "Rent", "Lease Period" get squished or cut off.

**Fix:** On mobile, switch to a card-based layout showing key info (name, property, status) stacked vertically instead of the table.

### 2. Dashboard Leases Tab - Button overflow on lease cards
Each lease card has 4-5 action buttons (View, Sign, Certificate, Edit, Delete) in a horizontal row. On mobile these overflow or wrap awkwardly.

**Fix:** Stack the lease card content vertically on mobile. Move action buttons below the lease info and use a flex-wrap layout with smaller buttons.

### 3. Dashboard Applications Tab - Approve/Reject buttons crowd the card
The application cards show name + badge + approve/reject buttons in a row that breaks on small screens.

**Fix:** Stack the application card layout vertically on mobile, moving the action buttons to a full-width row below the info.

### 4. Dashboard Properties Tab - Header "Properties" + "Add Property" button
The heading and button don't wrap properly on mobile.

**Fix:** Stack the header and button vertically on mobile using `flex-col sm:flex-row`.

### 5. Dashboard Leases Tab Header - Same issue
"Leases" heading and "Create Lease" button side by side.

**Fix:** Same flex-col pattern.

### 6. AuditDashboard - Payment table overflow
Uses a full HTML table for payment records that overflows on mobile.

**Fix:** Make the table horizontally scrollable on mobile, or switch to card layout.

### 7. TenantDetail Page - Tab content overflow
The contact info cards in the Overview tab use `grid-cols-1 md:grid-cols-3` which is fine, but the individual cards with long email addresses can overflow.

**Fix:** Add `overflow-hidden` and `break-all` on email text to prevent overflow.

### 8. TenantPropertiesTab - Property edit form fields
The grid layout `grid-cols-1 md:grid-cols-3` with date pickers can be tight. Calendar popovers may render off-screen on mobile.

**Fix:** Ensure popovers use `align="start"` and have proper z-index.

### 9. TenantDetailsDialog (legacy) - Content overflow
The dialog with max-w-2xl has many sections that stack vertically. The "Revoke Access" button text wraps oddly.

**Fix:** Ensure proper text wrapping and button sizing on mobile.

### 10. Settings Dialog - Tab triggers too narrow
Three tabs ("Fees", "Discord", "In-App") with icons may get too small on mobile.

**Fix:** Use icon-only tabs on very small screens or reduce icon sizes.

---

## Technical Changes

### File: `src/components/tenants/TenantsTable.tsx`
- Replace the HTML table with a responsive layout:
  - Desktop: Keep current table
  - Mobile: Card-based layout showing name, property, balance, and status per card
- Use `useIsMobile()` hook to toggle

### File: `src/pages/Dashboard.tsx`
- **Properties tab header** (line ~712): Change to `flex flex-col sm:flex-row sm:items-center` and button to `w-full sm:w-auto`
- **Leases tab header** (line ~898): Same pattern
- **Tenants tab header** (line ~860): Same pattern  
- **Application cards** (line ~795): Stack layout vertically on mobile, move approve/reject buttons below
- **Lease cards** (line ~964): Stack the content/buttons vertically on mobile, wrap action buttons in a `flex flex-wrap gap-2` container

### File: `src/components/audit/AuditDashboard.tsx`
- Wrap the payment table in a `div` with `overflow-x-auto` for horizontal scrolling on mobile
- Add `min-w-[600px]` to the table to maintain readability when scrolling

### File: `src/components/tenants/TenantOverviewTab.tsx`
- Add `break-all` or `truncate` on email display to prevent overflow
- Ensure contact info cards handle long text gracefully

### File: `src/components/tenants/TenantBalanceTab.tsx`
- The balance cards already use `grid-cols-1 md:grid-cols-2` which is correct
- Add `break-words` on balance text for very large numbers

### File: `src/components/tenants/TenantDetailsDialog.tsx`
- Add responsive width `max-w-[95vw] sm:max-w-2xl`
- Ensure "Revoke Access" section stacks vertically on mobile (flex-col)

### File: `src/components/settings/SettingsDialog.tsx`
- Tab triggers: hide text labels on very small screens, show icon-only

### File: `src/components/tenants/TenantPropertiesTab.tsx`
- Ensure property assignment cards handle the edit form responsively
- Calendar popovers: ensure proper mobile positioning

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/components/tenants/TenantsTable.tsx` | Mobile card layout instead of table |
| `src/pages/Dashboard.tsx` | Fix headers, application cards, lease cards for mobile |
| `src/components/audit/AuditDashboard.tsx` | Scrollable table wrapper on mobile |
| `src/components/tenants/TenantOverviewTab.tsx` | Text overflow handling |
| `src/components/tenants/TenantDetailsDialog.tsx` | Responsive dialog width and button layout |
| `src/components/tenants/TenantPropertiesTab.tsx` | Form fields and calendar positioning |

