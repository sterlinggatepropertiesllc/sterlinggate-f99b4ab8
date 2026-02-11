

## Telegram Mini App Integration

### What You Need to Do First (Outside Lovable)

1. Open Telegram, search for **@BotFather**, and send `/newbot`
2. Follow the prompts to name your bot (e.g., "SterlingGateBot")
3. Save the **Bot Token** you receive
4. Send `/newapp` to BotFather and select your bot
5. When asked for the **Web App URL**, enter: `https://sterlinggate.lovable.app`
6. BotFather will give you a link like `t.me/YourBot/app` -- this is your Mini App link

Once you have the Bot Token, come back here and I'll store it securely.

### What I'll Build

#### 1. Install Telegram SDK
Add `@telegram-apps/sdk-react` to detect when the app runs inside Telegram and access Telegram-specific features (theme, back button, user data).

#### 2. Telegram Auth Edge Function
Create a `telegram-auth` backend function that:
- Receives the Telegram `initData` string from the Mini App
- Validates it using the Bot Token (HMAC-SHA256 verification per Telegram's spec)
- Extracts the Telegram user (ID, name, username)
- Looks up or creates a corresponding account in your database
- Returns a session token so the user is auto-logged in

#### 3. Telegram Context Provider
Add a `TelegramProvider` component that wraps the app and:
- Detects if the app is running inside Telegram's WebView
- Initializes the Telegram SDK (theme colors, viewport, back button handling)
- Auto-authenticates the user using the edge function above
- Falls through to normal email/password login when NOT in Telegram

#### 4. UI Adaptations
- Hide the normal header/navigation chrome when inside Telegram (Telegram provides its own)
- Use Telegram's theme colors so the app matches the user's Telegram theme (dark/light)
- Wire up Telegram's back button to React Router navigation
- Skip the login page entirely for Telegram users (they're auto-authenticated)

#### 5. Database Changes
- Add `telegram_id` column to the `profiles` table so Telegram users can be linked to existing accounts
- Add a unique index on `telegram_id` for fast lookups

### How It Works

```text
User opens t.me/YourBot/app
        |
        v
  Telegram WebView loads sterlinggate.lovable.app
        |
        v
  TelegramProvider detects Telegram environment
        |
        v
  Sends initData to telegram-auth edge function
        |
        v
  Edge function validates signature with Bot Token
        |
        v
  Finds or creates user, returns session
        |
        v
  User is logged in automatically (no email/password needed)
```

### What I Need From You

1. **Bot Token** from BotFather -- I'll store it securely as a backend secret
2. Confirm the published URL (`https://sterlinggate.lovable.app`) is what you want to use as the Mini App URL

