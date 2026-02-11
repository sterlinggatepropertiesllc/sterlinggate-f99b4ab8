

## Add Dismiss/Clear to Overdue Rent Alerts

### Problem
Currently there's no way to dismiss individual overdue rent alerts. Once a tenant is overdue, the alert persists with no option to clear it from the list.

### Solution
Add a dismiss (X) button on each alert row so you can clear individual alerts from the list. Dismissed alerts are stored in `localStorage` so they stay hidden across sessions but automatically reappear if the overdue amount changes (indicating new activity).

### How It Works

1. **Dismiss button per row** -- Small X icon on the right side of each tenant row (replacing the chevron, or alongside it). Clicking it removes that alert from the visible list.

2. **Persistent dismissals** -- Store dismissed tenant IDs (along with the amount at time of dismissal) in `localStorage`. If the overdue amount changes later, the alert automatically reappears since the situation has changed.

3. **"Clear All" button** -- Add a "Clear All" option in the popover header to dismiss all current alerts at once.

4. **Badge updates** -- The alert icon badge count updates to reflect only non-dismissed alerts. If all are dismissed, the entire alert icon hides.

### Changes

| File | What Changes |
|------|-------------|
| `src/hooks/useOverdueTenants.ts` | Add `dismissedIds` state from localStorage, filter them out, expose `dismissAlert` and `clearAllAlerts` functions. Re-show if amount changes. |
| `src/components/notifications/OverdueRentAlert.tsx` | Add X button per row, "Clear All" button in header, pass dismiss handlers through. |

### Technical Details

- Dismissed state stored as `Record<tenantId, dismissedAmount>` in localStorage key `overdue-alerts-dismissed`
- On each query result, filter out tenants whose `id` is in dismissed map AND whose `amountOwed` matches the stored amount
- If the amount differs from what was stored, the dismissal is automatically invalidated (alert reappears)
- No database changes needed -- this is purely a UI preference

