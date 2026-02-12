

## Fix: Telegram Mini App Stuck on Loading Screen

### Root Cause

The app gets stuck on "Loading..." because of a silent failure in the role-fetching logic:

1. When a Telegram user authenticates, the backend creates the user and inserts a `tenant` role in `user_roles`
2. The `AuthContext` then tries to fetch this role via `fetchUserRole()`
3. If the query returns no data (race condition -- role not yet inserted) or errors (RLS), `role` stays `null` forever
4. Both Dashboard and TenantPortal have a guard: `if (user && role === null)` = show loading spinner
5. There is no retry, no timeout, no fallback -- the app is permanently stuck

### Fix

**File: `src/contexts/AuthContext.tsx`**

1. Add retry logic to `fetchUserRole` -- if the first attempt returns no data, retry up to 3 times with a short delay (500ms). This handles the race condition where the edge function hasn't finished inserting the role yet.

2. Add a fallback: if after all retries the role is still not found, default to `'tenant'` for Telegram users (since the edge function always assigns tenant role). For non-Telegram users, set a sensible fallback or stop blocking the UI.

3. Add error handling: if the query itself throws an error, log it and stop blocking the loading screen.

**File: `src/pages/Dashboard.tsx` and `src/pages/TenantPortal.tsx`**

4. Add a safety timeout: if the loading state persists for more than 10 seconds, show an error message with a retry button instead of an infinite spinner. This prevents the app from appearing broken even if something unexpected fails.

### Technical Details

```text
Current flow (broken):
  AuthContext.fetchUserRole() --> query fails silently --> role = null forever
  Dashboard/TenantPortal: (user && role === null) --> "Loading..." forever

Fixed flow:
  AuthContext.fetchUserRole() --> no data? retry 3x with 500ms delay
                               --> still no data? default to 'tenant'
                               --> query error? log + set role to 'tenant' fallback
  Dashboard/TenantPortal: add 10s safety timeout with retry button
```

### Changes Summary

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Add retry logic (3 attempts, 500ms delay) and fallback role for `fetchUserRole`. Handle query errors gracefully. |
| `src/pages/Dashboard.tsx` | Add 10-second timeout on loading state with error message and retry button |
| `src/pages/TenantPortal.tsx` | Same timeout safety net as Dashboard |

