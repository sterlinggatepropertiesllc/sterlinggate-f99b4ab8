

# Instant Auto-Update (No Waiting, No Banners)

## The Approach

When the app loads, it immediately checks if there's a newer version. If yes, it hard-refreshes right away - no banner, no waiting, no safety checks.

## How It Works

```text
App loads
    |
    v
Check version.json
    |
    v
Version mismatch?
    |
+---+---+
|       |
No     Yes
|       |
v       v
Continue  Instant hard refresh
normally  (clear cache + reload)
```

## Implementation

### 1. Version File: `public/version.json`

```json
{
  "version": "2024-02-04-1200"
}
```

### 2. Cache Headers: `public/_headers`

Prevents browsers from caching HTML and version file:

```text
/version.json
  Cache-Control: no-cache, no-store, must-revalidate

/index.html
  Cache-Control: no-cache, no-store, must-revalidate
```

### 3. Version Hook: `src/hooks/useAppVersion.ts`

Simple hook that:
- Checks version immediately on mount
- If mismatch detected, triggers hard refresh instantly
- No polling, no intervals - just one check on load

```typescript
export const useAppVersion = () => {
  useEffect(() => {
    const checkAndUpdate = async () => {
      try {
        // Get stored version from sessionStorage
        const storedVersion = sessionStorage.getItem('app_version');
        
        // Fetch current version (bypass cache)
        const response = await fetch('/version.json', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();
        
        if (!storedVersion) {
          // First load - store current version
          sessionStorage.setItem('app_version', data.version);
        } else if (storedVersion !== data.version) {
          // Version mismatch - hard refresh immediately
          sessionStorage.setItem('app_version', data.version);
          forceHardRefresh();
        }
      } catch (e) {
        // Silently fail if version check fails
      }
    };

    checkAndUpdate();
  }, []);
};

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

### 4. Initialize in App: `src/App.tsx`

Add the hook at the top level so it runs on every page load:

```typescript
import { useAppVersion } from "@/hooks/useAppVersion";

const App = () => {
  useAppVersion(); // Check version immediately on load
  
  return (
    // ... rest of app
  );
};
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `public/version.json` | Create | Version identifier |
| `public/_headers` | Create | Prevent caching of HTML |
| `src/hooks/useAppVersion.ts` | Create | Instant version check + hard refresh |
| `src/App.tsx` | Modify | Initialize the hook |

## User Experience

1. User opens app (or returns to it)
2. App checks version instantly
3. If outdated: immediate hard refresh (happens so fast they might just see a flash)
4. Fresh version loads

## Updating the Version

When you publish changes, update `public/version.json`:

```json
{
  "version": "2024-02-04-1430"
}
```

Next time any user loads the app, they'll get the new version automatically.

