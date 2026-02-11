

## Fix Telegram Mini App Compatibility

### Problem
The Telegram Web App SDK script tag is missing from `index.html`. Without it, Telegram's `window.Telegram.WebApp` object won't be available, and the `TelegramProvider` won't detect the Telegram environment. Additionally, we need to ensure the UI fits properly within Telegram's viewport (safe areas, no overflow).

### Changes

#### 1. Add Telegram Web App SDK script to `index.html`
Add the official Telegram script tag in the `<head>`:
```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```
Also add viewport-fit=cover to the viewport meta tag for proper safe area handling on devices with notches.

#### 2. Add CSS safe area and overflow guards
Add CSS rules to `index.html` or `index.css` to:
- Use `env(safe-area-inset-*)` padding so content doesn't hide behind Telegram's header or device notches
- Ensure `overflow-x: hidden` on the body to prevent horizontal scrolling
- Set `min-height: 100vh` with Telegram's viewport variable fallback

#### 3. Update `TelegramProvider` for robustness
- Add `tg.requestFullscreen?.()` call if available (newer Telegram clients)
- Set `tg.isVerticalSwipesEnabled = false` to prevent accidental close on scroll
- Listen for `viewportChanged` events to handle resize

### Files to Change
- `index.html` -- add script tag and viewport-fit meta
- `src/index.css` -- add Telegram-specific safe area CSS
- `src/contexts/TelegramContext.tsx` -- add fullscreen and swipe prevention

### What You Need to Do (in Telegram)
1. Send `/newapp` to @BotFather
2. Select @sterlinggate_bot
3. Title: `Sterling Gate`
4. Description: `Commercial real estate management`
5. Photo: send logo or `/empty`
6. GIF: `/empty`
7. Web App URL: `https://sterlinggate.lovable.app`
8. Short name: `app`
9. Test via `t.me/sterlinggate_bot/app`

