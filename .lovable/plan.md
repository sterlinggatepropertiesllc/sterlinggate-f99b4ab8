

## Fix Telegram Mini App Layout for iOS Safe Area

### Problem
- `min-h-screen` (which maps to `100vh`) doesn't account for Telegram's actual viewport on iOS, causing cramped layouts
- The body already uses `--tg-viewport-stable-height` but individual pages all use `min-h-screen` which overrides this
- `tg.expand()` is already called -- no change needed there

### Solution

#### 1. Set `--tg-viewport-height` CSS variable dynamically (`src/contexts/TelegramContext.tsx`)
- Listen to `Telegram.WebApp.onEvent('viewportChanged', ...)` to capture `viewportStableHeight`
- Set `--tg-viewport-stable-height` CSS variable on `document.documentElement` dynamically
- This keeps the variable in sync even when the Telegram keyboard opens/closes

#### 2. Replace `min-h-screen` with a Telegram-aware utility (`src/index.css`)
- Add a CSS rule for `html.telegram-webapp` that overrides `min-h-screen` behavior:
  ```css
  html.telegram-webapp .min-h-screen {
    min-height: var(--tg-viewport-stable-height, 100vh) !important;
  }
  ```
- This is a single global rule that fixes ALL pages without touching each file individually
- On non-Telegram browsers, the fallback `100vh` keeps everything working normally

#### 3. Fix sidebar `min-h-screen` in Dashboard/TenantPortal
- The desktop sidebar in `Dashboard.tsx` (line 480) and `TenantPortal.tsx` (line 426) uses `min-h-screen` directly -- the global CSS override handles this too

#### 4. Fix MessagingCenter `100vh` calc
- `MessagingCenter.tsx` uses `h-[calc(100vh-180px)]` -- replace with `h-[calc(var(--tg-viewport-stable-height,100vh)-180px)]` inside a Telegram-aware class, or simply use a more flexible approach like `h-[calc(100dvh-180px)]` which respects dynamic viewport on modern browsers

#### 5. Improve safe area padding (`src/index.css`)
- The existing `html.telegram-webapp body` rule already has safe area padding, but add a minimum bottom padding of 16px for comfort:
  ```css
  padding-bottom: calc(
    max(...existing...) + 16px
  );
  ```

### Files to Change

| File | Change |
|------|--------|
| `src/contexts/TelegramContext.tsx` | Add `viewportChanged` event listener, set `--tg-viewport-stable-height` CSS variable dynamically |
| `src/index.css` | Add global `html.telegram-webapp .min-h-screen` override; update bottom padding; add `100dvh` fallback for body |
| `src/components/messages/MessagingCenter.tsx` | Replace `100vh` calc with `100dvh` for dynamic viewport support |

### Why This Approach
- **Zero page-level changes**: A single global CSS rule catches all `min-h-screen` usage across every page
- **Dynamic updates**: Listening to `viewportChanged` keeps the variable accurate as the Telegram viewport shifts
- **Progressive enhancement**: Falls back to `100vh` on non-Telegram browsers and `100dvh` on modern browsers

