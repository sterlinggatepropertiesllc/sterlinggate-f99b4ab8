

## Seamless Telegram Connection Flow

### What Already Exists (No Changes Needed)
- `telegram-webhook` edge function already handles `/start` and updates `telegram_chat_id`
- `useTelegramNotificationPrefs` hook already checks `chatLinked` status from `profiles.telegram_chat_id`
- Notification toggles are already disabled when not connected

### Changes

#### 1. Update `src/components/settings/TelegramNotificationSettings.tsx`
- When `chatLinked = false`, replace the small status bar with a prominent connect card:
  - Title: "Enable Telegram Notifications" with bell icon
  - Description explaining the benefit
  - "Connect Telegram" button that calls `Telegram.WebApp.openTelegramLink("https://t.me/BOT_USERNAME?start=connect")`
  - Falls back to a regular link when not inside Telegram
  - Small muted text: "You will only need to do this once."
- When `chatLinked = true`, show a green "Connected" badge and enable all toggles (current behavior, slightly polished)
- Bot username will be sourced from an environment variable (`VITE_TELEGRAM_BOT_USERNAME`) or hardcoded if you provide the bot username

#### 2. Update `src/hooks/useTelegramNotificationPrefs.ts`
- Add a `visibilitychange` event listener so when the user returns to the Mini App after messaging the bot, the hook automatically re-fetches and detects the newly linked `telegram_chat_id`
- This gives the seamless "auto-refresh" behavior without polling

#### 3. Files to Change
| File | Change |
|------|--------|
| `src/components/settings/TelegramNotificationSettings.tsx` | Connect card UI with `openTelegramLink` button, polished connected state |
| `src/hooks/useTelegramNotificationPrefs.ts` | Add `visibilitychange` listener for auto-refresh |

No backend changes needed -- the webhook and database logic are already in place.

### Technical Details
- `Telegram.WebApp.openTelegramLink()` is the official API to open a chat with the bot from inside a Mini App, avoiding popup blockers
- The `?start=connect` deep link triggers the `/start` command in the bot, which the existing webhook handles
- The `visibilitychange` approach is lightweight and only fires when the user actually returns to the app tab
