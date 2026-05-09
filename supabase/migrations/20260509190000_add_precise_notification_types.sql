ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_received';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_processing';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_incomplete';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_late';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_missing';
