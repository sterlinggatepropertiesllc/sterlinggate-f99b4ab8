

## Telegram Mini App Touch and UI Polish

### Problem
While the core integration is solid, there are a few touch/UX refinements needed for a smooth Telegram Mini App experience:
1. No `touch-action: manipulation` -- mobile browsers inside Telegram may have a 300ms tap delay on buttons/links
2. The Telegram Back Button is wired up but never shown/hidden based on navigation state
3. Unused `useNavigate` import in TelegramContext

### Changes

#### 1. Add touch optimization CSS (`src/index.css`)
Add `touch-action: manipulation` to interactive elements to eliminate the 300ms tap delay:
```css
button, a, [role="button"], input, select, textarea {
  touch-action: manipulation;
}
```

#### 2. Dynamic Telegram Back Button visibility (`src/contexts/TelegramContext.tsx`)
- Remove unused `useNavigate` import
- Add a `useEffect` that listens to `popstate` / route changes and calls `tg.BackButton.show()` when not on the root route, and `tg.BackButton.hide()` when on root
- This requires accessing the current location, so we'll use `window.location.pathname`

#### 3. Add `-webkit-tap-highlight-color: transparent` (`src/index.css`)
Prevents the blue/grey tap highlight flash on Android Telegram clients.

### Files to Change
- `src/index.css` -- add touch-action and tap highlight CSS
- `src/contexts/TelegramContext.tsx` -- dynamic back button show/hide, remove unused import
