

## Enhance Global Telegram Safe-Area System

### What's Already Done
- `telegram-webapp` class is added to `<html>` when in Telegram
- `tg.expand()` and `tg.requestFullscreen()` are called
- CSS rule exists: `html.telegram-webapp body { padding-top: max(env(safe-area-inset-top, 0px), 48px); }`

### What Needs to Change

The current 48px fallback is not always sufficient (Dynamic Island devices need more), and Telegram provides its own `safeAreaInset` values that should be used when available.

#### 1. Read Telegram's safe area values and set CSS variables (`src/contexts/TelegramContext.tsx`)
- After `tg.ready()`, read `tg.safeAreaInset` and `tg.contentSafeAreaInset` (available in newer Telegram clients)
- Set CSS custom properties on `<html>`: `--tg-safe-top`, `--tg-safe-bottom`
- These values give the exact pixel offset needed for that device and Telegram version
- Fall back gracefully when these APIs are not available

#### 2. Update global CSS rule (`src/index.css`)
- Replace the current Telegram padding rule with a more robust one:
  - Use `calc(var(--tg-safe-top, 0px) + env(safe-area-inset-top, 0px) + 8px)` for top padding
  - The extra `8px` ensures content never touches the Dynamic Island edge
  - Use `max()` with a 48px minimum fallback for older Telegram clients that don't report safe area
  - Add `padding-bottom` using the same pattern for bottom safe area
- Remove the `telegram-sticky-header` class approach in favor of the global body padding (sticky headers will naturally respect body padding)

#### 3. Clean up Dashboard sticky header (`src/pages/Dashboard.tsx`)
- Remove the `telegram-sticky-header` class from the sticky header div (no longer needed since global body padding handles positioning)

### Files to Change
- `src/contexts/TelegramContext.tsx` -- read Telegram safe area insets and set CSS variables
- `src/index.css` -- enhanced padding-top rule with +8px and proper fallbacks
- `src/pages/Dashboard.tsx` -- remove unnecessary `telegram-sticky-header` class

### What Stays the Same
- Dark theme, card spacing, dashboard layout, buttons -- all untouched
- No per-page modifications -- everything handled at root CSS level
- No scroll containers or position:fixed hacks introduced
