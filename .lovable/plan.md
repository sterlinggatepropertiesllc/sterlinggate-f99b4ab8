

## Fix: Telegram Mini App Blank Black Screen

The app renders nothing when an uncaught error occurs during initialization because there is no error boundary. Additionally, `TelegramContext` accesses several Telegram WebApp APIs that can throw without being caught, and the auth failure state is never surfaced to the user.

### Changes

#### 1. Add Global Error Boundary (`src/components/ErrorBoundary.tsx` -- NEW FILE)

Create a class-based React Error Boundary component that:
- Catches any uncaught rendering error in the entire app tree
- Renders a centered message: "Something went wrong loading the app. Please refresh or reopen from Telegram."
- Logs the error to `console.error`
- Includes a "Retry" button that reloads the page

#### 2. Wrap App in Error Boundary (`src/App.tsx`)

- Import and wrap the entire `<QueryClientProvider>` tree inside the new `<ErrorBoundary>`
- This ensures even provider-level crashes are caught

#### 3. Harden Telegram Init (`src/contexts/TelegramContext.tsx`)

- Add comprehensive `console.log` statements at each stage: app init, Telegram detected, auth request sent, auth response received, auth failure
- Wrap all Telegram API calls (`BackButton.onClick`, `BackButton.show/hide`, `requestFullscreen`, `onEvent`, `safeAreaInset` access) in try/catch so a single API failure doesn't crash the entire provider
- When `authError` is set, render a visible error screen instead of silently passing `children` through: "Session expired. Please reopen from Telegram."
- When `isAuthenticating` is true, render a centered "Loading Sterling Gate..." screen so the user never sees a blank screen during auth
- When not in Telegram and not otherwise authenticated, the app continues to render normally (non-Telegram users use email login)

#### 4. Add `_headers` rule (`public/_headers`)

- Add `X-Frame-Options: ALLOWALL` to prevent iframe blocking (Telegram loads mini apps in iframes)

### Files

| File | Action |
|------|--------|
| `src/components/ErrorBoundary.tsx` | Create -- React Error Boundary class component |
| `src/App.tsx` | Edit -- wrap root in ErrorBoundary |
| `src/contexts/TelegramContext.tsx` | Edit -- try/catch all TG API calls, add logging, render loading/error states during auth |
| `public/_headers` | Edit -- add permissive X-Frame-Options |

