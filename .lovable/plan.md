

# Auto-Refresh App Updates (With Safety Guards)

## The Approach

Yes, we can make it automatic! But we need to be smart about **when** to auto-refresh so we don't interrupt tenants mid-payment or mid-signature.

## Safety Rules

The app will **only auto-refresh** when it's safe:

| Situation | Auto-Refresh? |
|-----------|---------------|
| Tenant browsing dashboard | Yes |
| Payment dialog open | No (wait until closed) |
| Signing a lease | No (wait until done) |
| Filling out application form | No (wait until submitted) |
| Messaging/typing | No (wait until idle) |

## How It Works

```text
New version detected
        |
        v
  Is user in a "safe" state?
        |
    +---+---+
    |       |
   Yes      No
    |       |
    v       v
  Auto    Wait & check again
  refresh   every 5 seconds
```

---

## Implementation

### 1. Create Safe-State Detection

The hook will check if any dialogs or forms are open by:
- Looking for open payment dialogs (`showPaymentDialog`, `rentPaymentDialog.open`)
- Checking if on the `/sign-lease/` route
- Detecting if user is actively typing (no keyboard activity for 10 seconds)

### 2. Version Check Hook with Auto-Refresh

```typescript
// src/hooks/useAppVersion.ts
export const useAppVersion = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersion = useRef<string | null>(null);
  const location = useLocation();

  // Detect if user is in a "safe" state for auto-refresh
  const isSafeToRefresh = useCallback(() => {
    // Don't refresh during lease signing
    if (location.pathname.startsWith('/sign-lease')) return false;
    
    // Don't refresh if any dialogs are open (check DOM)
    const hasOpenDialog = document.querySelector('[role="dialog"][data-state="open"]');
    if (hasOpenDialog) return false;
    
    // Don't refresh if user is actively typing
    const activeElement = document.activeElement;
    if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
      return false;
    }
    
    return true;
  }, [location.pathname]);

  // When update available and safe, auto-refresh
  useEffect(() => {
    if (!updateAvailable) return;
    
    const attemptRefresh = () => {
      if (isSafeToRefresh()) {
        forceHardRefresh();
      }
    };
    
    // Try immediately
    attemptRefresh();
    
    // Keep checking every 5 seconds if not safe yet
    const interval = setInterval(attemptRefresh, 5000);
    return () => clearInterval(interval);
  }, [updateAvailable, isSafeToRefresh]);

  // ... version checking logic
};
```

### 3. Hard Refresh Function (Cache Clearing)

```typescript
const forceHardRefresh = async () => {
  // Clear Cache API
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
  }
  
  // Unregister service workers
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
  
  // Navigate with cache-busting parameter
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString());
  window.location.href = url.toString();
};
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `public/version.json` | Create | Version identifier |
| `public/_headers` | Create | Prevent caching of HTML |
| `src/hooks/useAppVersion.ts` | Create | Version check + safe auto-refresh |
| `src/App.tsx` | Modify | Initialize the hook |

---

## User Experience

- **No banner** - updates happen silently when safe
- If user is mid-payment, the refresh waits until they close the dialog
- If user is signing a lease, the refresh waits until they navigate away
- Maximum wait: a few seconds after they finish their current action

---

## Optional: Visual Indicator

If you'd like, we can add a small "Updating..." toast notification when the auto-refresh happens so users know why the page reloaded. This is optional and can be enabled/disabled.

