

## Role-Based Telegram Notification System

### Context: What Already Exists

The app already has a solid foundation that we'll build on top of rather than duplicating:

- **User system**: `profiles` table (with `telegram_id` column) + `user_roles` table (`tenant` / `property_manager` roles)
- **Notification system**: `notifications` table with triggers for payments, applications, leases, messages
- **Telegram auth**: Edge function that links Telegram users to system accounts
- **Discord notifications**: Edge function for webhook-based alerts (we'll follow the same pattern for Telegram)

### What We'll Build

```text
+-------------------+     +------------------------+     +---------------------------+
| Existing triggers |---->| notify-telegram        |---->| Telegram Bot API          |
| (payment, lease,  |     | (new edge function)    |     | sendMessage               |
|  application...)  |     +------------------------+     +---------------------------+
+-------------------+              |
                                   v
                    +------------------------------+
                    | telegram_notification_       |
                    | deliveries (tracking table)  |
                    +------------------------------+
```

---

### Part 1: Database Changes

**1a. Add `telegram_chat_id` to `profiles` table**
- The `telegram_id` (user ID) is already stored; we need `telegram_chat_id` (where to send messages)
- Chat ID is obtained when a user sends `/start` to the bot

**1b. Create `telegram_notification_topics` table**
- `key` (text, primary key) -- e.g., `RENT_RECEIVED`, `RENT_DUE_REMINDER`
- `role_scope` (text) -- `property_manager`, `tenant`, or `both`
- `description` (text)
- Seed with all 17 topics from the requirements

**1c. Create `telegram_notification_prefs` table**
- `id` (uuid, pk)
- `user_id` (uuid, references profiles)
- `topic_key` (text, references telegram_notification_topics)
- `enabled` (boolean, default true)
- `created_at`, `updated_at`
- Unique constraint on (user_id, topic_key)
- RLS: users can only read/update their own preferences

**1d. Create `telegram_notification_deliveries` table**
- `id` (uuid, pk)
- `user_id` (uuid, references profiles)
- `topic_key` (text)
- `telegram_chat_id` (bigint)
- `message_text` (text)
- `status` (text: `queued`, `sent`, `failed`)
- `attempts` (int, default 0)
- `last_error` (text, nullable)
- `idempotency_key` (text, unique) -- composed of event source + ID + user_id
- `metadata` (jsonb)
- `created_at`, `updated_at`
- RLS: service role only (edge functions write, users can read their own)

**1e. Seed notification topics**

Admin (property_manager) topics:
- `RENT_RECEIVED`, `RENT_PAST_DUE`, `ACH_INITIATED`, `ACH_CLEARED`
- `NEW_APPLICATION_RECEIVED`, `LEASE_SIGNED`
- `WORK_ORDER_CREATED`, `WORK_ORDER_OVERDUE`, `SYSTEM_ALERT`

Tenant topics:
- `RENT_DUE_REMINDER`, `RENT_PAST_DUE_NOTICE`
- `PAYMENT_RECEIVED_CONFIRMATION`, `PAYMENT_FAILED`
- `LEASE_RENEWAL_REMINDER`
- `WORK_ORDER_STATUS_UPDATE`, `MESSAGE_FROM_MANAGER`

---

### Part 2: Edge Functions

**2a. `send-telegram-notification` edge function**
- Accepts: `topic_key`, `user_id` (or list of user IDs), `message`, `metadata`
- Flow:
  1. Look up user's role from `user_roles`
  2. Verify the topic's `role_scope` matches the user's role
  3. Check `telegram_notification_prefs` -- skip if disabled
  4. Get `telegram_chat_id` from `profiles`
  5. If no chat_id, record as `failed` with reason "User has not started the bot"
  6. Generate `idempotency_key` and check for duplicates
  7. Send via Telegram Bot API: `POST https://api.telegram.org/bot{TOKEN}/sendMessage`
  8. Record delivery in `telegram_notification_deliveries`
- Uses `TELEGRAM_BOT_TOKEN` secret (already configured)

**2b. `telegram-webhook` edge function**
- Handles incoming messages from the Telegram bot
- When a user sends `/start`:
  - Extract `telegram_user_id` and `chat_id` from the update
  - Find matching profile by `telegram_id`
  - Update `telegram_chat_id` in `profiles`
  - Reply with a welcome message confirming notifications are enabled
- Registered as webhook URL with the Telegram Bot API

**2c. Update existing `telegram-auth` edge function**
- After successful authentication, also store `telegram_chat_id` if available from the WebApp context
- Note: Mini App context may provide chat ID in some cases

---

### Part 3: Hook Into Existing Notification Triggers

Update existing database trigger functions to also call the Telegram notification system. For each existing trigger:

- `notify_on_new_payment` -- also queue `RENT_RECEIVED` (admin) + `PAYMENT_RECEIVED_CONFIRMATION` (tenant)
- `notify_on_payment_status_change` -- also queue `ACH_CLEARED` (admin)
- `notify_on_new_application` -- also queue `NEW_APPLICATION_RECEIVED` (admin)
- `notify_on_lease_signed` -- also queue `LEASE_SIGNED` (admin)
- `notify_on_new_message` -- also queue `MESSAGE_FROM_MANAGER` (tenant, when sender is property_manager)

These triggers will insert records into a `telegram_notification_queue` table, and a separate edge function or database function will process the queue by calling the Telegram Bot API.

Alternative (simpler) approach: Create a database function `send_telegram_for_notification()` that gets called via `pg_net` HTTP extension or by modifying the existing triggers to also invoke the `send-telegram-notification` edge function using `pg_net`.

---

### Part 4: Message Templates

Formatted messages using Telegram's MarkdownV2:

**Admin examples:**
```
RENT_RECEIVED:
"Payment received: $1,200 from John Doe for 123 Main St via Card"

ACH_INITIATED:
"ACH payment initiated: $1,200 from John Doe (processing 3-5 days)"

NEW_APPLICATION_RECEIVED:
"New application: Jane Smith applied for 456 Oak Ave"
```

**Tenant examples:**
```
RENT_DUE_REMINDER:
"Your rent of $1,200 is due on Feb 1. Please submit payment to avoid late fees."

PAYMENT_RECEIVED_CONFIRMATION:
"Your payment of $1,200 has been received. Thank you!"

PAYMENT_FAILED:
"Your payment of $1,200 failed. Please try again or contact your property manager."
```

---

### Part 5: Security

- Telegram `initData` signature verification (already implemented)
- Auth date expiry check (add 24-hour validation)
- Role determined server-side from `user_roles` table only
- Idempotency via unique `idempotency_key` in deliveries table
- RLS policies on all new tables
- Edge functions use service role key for database operations

---

### Part 6: Notification Preferences UI

Add a "Telegram Notifications" section to the existing Settings dialog:
- Toggle switches for each topic relevant to the user's role
- Visual indicator showing whether chat_id is linked (bot started)
- Instructions to send `/start` to the bot if not yet linked

---

### Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Create tables, seed topics, add `telegram_chat_id` column |
| `supabase/functions/send-telegram-notification/index.ts` | New edge function |
| `supabase/functions/telegram-webhook/index.ts` | New edge function for bot /start |
| `supabase/functions/telegram-auth/index.ts` | Minor update for chat_id |
| `supabase/config.toml` | Register new functions with `verify_jwt = false` |
| Existing trigger functions | Update to queue Telegram notifications |
| `src/components/settings/TelegramNotificationSettings.tsx` | New UI component |
| `src/hooks/useTelegramNotificationPrefs.ts` | New hook |
| `src/components/settings/SettingsDialog.tsx` | Add Telegram tab |

