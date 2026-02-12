

## Fix Telegram iOS Layout — Remove 100vh and Properly Handle Viewport

### Problem
On iPhone inside Telegram, the top content is cramped/overlapping because `100vh` doesn't account for the Telegram native header, and safe-area insets are only read once (not updated dynamically).

### Changes

#### 1. Update Telegram viewport handler (`src/contexts/TelegramContext.tsx`)
- In the `updateViewportHeight` callback, also set `--tg-viewport-height` (in addition to the existing `--tg-viewport-stable-height`)
- Re-read safe area insets on every `viewportChanged` event (currently they're only read once at init)

#### 2. Fix body CSS (`src/index.css`)
- Replace the bare `min-height: 100vh` fallback on `body` with `min-height: 100dvh` (dynamic viewport height, which works correctly on iOS Safari)
- Keep the `var(--tg-viewport-stable-height, 100dvh)` override for Telegram

#### 3. Replace inline `100vh` in ErrorBoundary and TelegramContext
- In `src/components/ErrorBoundary.tsx`: change `minHeight: '100vh'` to `minHeight: 'var(--tg-viewport-stable-height, 100dvh)'`
- In `src/contexts/TelegramContext.tsx` (loading and error screens): same replacement for all three inline `minHeight: '100vh'` usages

#### 4. Global Telegram override for `min-h-screen` (already exists, verify correct)
- The existing rule at line 185 (`html.telegram-webapp .min-h-screen`) already overrides `min-height` to use the Telegram variable — this stays as-is
- This means all pages using Tailwind `min-h-screen` (Dashboard, TenantPortal, Auth, etc.) are automatically handled

#### 5. No fixed headers found
- Search confirmed no `position: fixed` usage in the project. Existing headers already use `sticky top-0`. No changes needed.

### Summary of Files

| File | Change |
|------|--------|
| `src/contexts/TelegramContext.tsx` | Set `--tg-viewport-height` alongside existing variable; move safe-area inset reading into the `viewportChanged` callback; replace 3x inline `100vh` with dynamic fallback |
| `src/index.css` | Change `min-height: 100vh` to `min-height: 100dvh` on body |
| `src/components/ErrorBoundary.tsx` | Replace inline `minHeight: '100vh'` with dynamic variable fallback |
