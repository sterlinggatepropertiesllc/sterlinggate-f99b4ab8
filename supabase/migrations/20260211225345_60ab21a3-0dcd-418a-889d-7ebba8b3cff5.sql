
-- 1a. Add telegram_chat_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;

-- 1b. Create telegram_notification_topics table
CREATE TABLE public.telegram_notification_topics (
  key text PRIMARY KEY,
  role_scope text NOT NULL CHECK (role_scope IN ('property_manager', 'tenant', 'both')),
  description text NOT NULL
);

ALTER TABLE public.telegram_notification_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notification topics"
  ON public.telegram_notification_topics FOR SELECT
  USING (true);

-- 1c. Create telegram_notification_prefs table
CREATE TABLE public.telegram_notification_prefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_key text NOT NULL REFERENCES public.telegram_notification_topics(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_key)
);

ALTER TABLE public.telegram_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prefs"
  ON public.telegram_notification_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prefs"
  ON public.telegram_notification_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prefs"
  ON public.telegram_notification_prefs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_telegram_notification_prefs_updated_at
  BEFORE UPDATE ON public.telegram_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1d. Create telegram_notification_deliveries table
CREATE TABLE public.telegram_notification_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_key text NOT NULL,
  telegram_chat_id bigint,
  message_text text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own deliveries"
  ON public.telegram_notification_deliveries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage deliveries"
  ON public.telegram_notification_deliveries FOR ALL
  USING (auth.uid() IS NULL);

CREATE TRIGGER update_telegram_notification_deliveries_updated_at
  BEFORE UPDATE ON public.telegram_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1e. Seed notification topics
INSERT INTO public.telegram_notification_topics (key, role_scope, description) VALUES
  ('RENT_RECEIVED', 'property_manager', 'Notification when rent payment is received'),
  ('RENT_PAST_DUE', 'property_manager', 'Alert when tenant rent is past due'),
  ('RENT_PARTIAL_PAYMENT', 'property_manager', 'Alert when a partial rent payment is received'),
  ('ACH_INITIATED', 'property_manager', 'Notification when ACH payment is initiated'),
  ('ACH_CLEARED', 'property_manager', 'Notification when ACH payment clears'),
  ('NEW_APPLICATION_RECEIVED', 'property_manager', 'New rental application submitted'),
  ('LEASE_SIGNED', 'property_manager', 'Lease agreement has been signed'),
  ('WORK_ORDER_CREATED', 'property_manager', 'New maintenance work order created'),
  ('WORK_ORDER_OVERDUE', 'property_manager', 'Maintenance work order is overdue'),
  ('SYSTEM_ALERT', 'property_manager', 'System-level alerts and warnings'),
  ('RENT_DUE_REMINDER', 'tenant', 'Reminder that rent is due soon'),
  ('RENT_PAST_DUE_NOTICE', 'tenant', 'Notice that rent is past due'),
  ('PAYMENT_RECEIVED_CONFIRMATION', 'tenant', 'Confirmation that payment was received'),
  ('PAYMENT_FAILED', 'tenant', 'Notification that payment attempt failed'),
  ('LEASE_RENEWAL_REMINDER', 'tenant', 'Reminder about upcoming lease renewal'),
  ('WORK_ORDER_STATUS_UPDATE', 'tenant', 'Update on maintenance request status'),
  ('MESSAGE_FROM_MANAGER', 'tenant', 'New message from property manager');

-- Index for fast lookups
CREATE INDEX idx_telegram_deliveries_user_status ON public.telegram_notification_deliveries(user_id, status);
CREATE INDEX idx_telegram_deliveries_idempotency ON public.telegram_notification_deliveries(idempotency_key);
CREATE INDEX idx_telegram_prefs_user ON public.telegram_notification_prefs(user_id);
