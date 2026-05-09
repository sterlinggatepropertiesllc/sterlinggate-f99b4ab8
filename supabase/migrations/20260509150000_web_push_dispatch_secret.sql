CREATE TABLE IF NOT EXISTS public.private_app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.private_app_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.queue_web_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dispatch_secret text;
BEGIN
  SELECT value
  INTO _dispatch_secret
  FROM public.private_app_config
  WHERE key = 'web_push_dispatch_secret';

  IF _dispatch_secret IS NULL OR length(_dispatch_secret) = 0 THEN
    RAISE WARNING 'Web push notification queue skipped: dispatch secret not configured';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://gwixdarqhmgxjkgwzuoe.supabase.co/functions/v1/send-web-push-notification',
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'metadata', COALESCE(NEW.metadata, '{}'::jsonb)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-web-push-secret', _dispatch_secret
    )::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Web push notification queue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
