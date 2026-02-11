

## Fix Telegram Mini App Top Header Overlap

### Problem
When the app runs inside a Telegram Mini App, Telegram's native header controls (Close button, notification badge, collapse arrow, three-dot menu) overlap with the app's own top header bar (hamburger menu, title, notification bell, settings). This makes the top of the app unusable.

### Solution
Add a CSS class that applies top padding only when running inside a Telegram Mini App, using the safe-area inset values provided by Telegram's WebApp environment. This ensures the app content starts below Telegram's native controls.

### Changes

#### 1. Add Telegram safe-area class to the root element (`src/contexts/TelegramContext.tsx`)
- When Telegram is detected, add a CSS class (e.g., `telegram-webapp`) to the `<html>` element
- This allows global CSS to apply Telegram-specific padding without affecting normal browser usage

#### 2. Add Telegram-specific top padding (`src/index.css`)
- Add a CSS rule that applies top padding when the `telegram-webapp` class is present on the `<html>` element
- Use `env(safe-area-inset-top, 48px)` as padding, with a fallback of 48px (approximate height of Telegram's header controls)

#### 3. Adjust sticky header in Dashboard (`src/pages/Dashboard.tsx`)
- Update the sticky top header bar's `top` value to account for Telegram's safe area so it doesn't slide under Telegram's controls when scrolling

### Files to Change
- `src/contexts/TelegramContext.tsx` -- add `telegram-webapp` class to `<html>` element when in Telegram
- `src/index.css` -- add `.telegram-webapp` padding-top rule
- `src/pages/Dashboard.tsx` -- no changes needed if global padding handles it, but may need minor sticky header adjustment

