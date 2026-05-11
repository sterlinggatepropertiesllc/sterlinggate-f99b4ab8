-- Admin reliability monitoring.
--
-- stripe_webhook_events records every verified Stripe webhook delivery and whether
-- app-side processing succeeded, failed, or was retried.
-- admin_audit_logs records money-path mutations so the admin dashboard has a
-- human-readable operational trail for tenant balances and payment state.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text,
  event_type text NOT NULL,
  livemode boolean,
  api_version text,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  payment_intent_id text,
  checkout_session_id text,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_webhook_events_event_id_unique
  ON public.stripe_webhook_events (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status_received
  ON public.stripe_webhook_events (status, last_received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_payment_intent
  ON public.stripe_webhook_events (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

CREATE TRIGGER update_stripe_webhook_events_updated_at
  BEFORE UPDATE ON public.stripe_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property managers can view stripe webhook health"
  ON public.stripe_webhook_events;

CREATE POLICY "Property managers can view stripe webhook health"
  ON public.stripe_webhook_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'property_manager'::public.app_role));

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  summary text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_tenant_created_at
  ON public.admin_audit_logs (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_payment_created_at
  ON public.admin_audit_logs (payment_id, created_at DESC)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity_created_at
  ON public.admin_audit_logs (entity_type, entity_id, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Property managers can view admin audit logs"
  ON public.admin_audit_logs;

CREATE POLICY "Property managers can view admin audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'property_manager'::public.app_role));

CREATE OR REPLACE FUNCTION public.audit_changed_fields(
  _old_data jsonb,
  _new_data jsonb,
  _ignored_fields text[] DEFAULT ARRAY['updated_at']
)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
  FROM (
    SELECT key
    FROM (
      SELECT jsonb_object_keys(COALESCE(_old_data, '{}'::jsonb)) AS key
      UNION
      SELECT jsonb_object_keys(COALESCE(_new_data, '{}'::jsonb)) AS key
    ) keys
    WHERE NOT (key = ANY(_ignored_fields))
      AND COALESCE(_old_data, '{}'::jsonb)->key IS DISTINCT FROM COALESCE(_new_data, '{}'::jsonb)->key
  ) changed;
$$;

CREATE OR REPLACE FUNCTION public.write_admin_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  _new jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  _actor_id uuid := auth.uid();
  _tenant_id uuid := NULL;
  _property_id uuid := NULL;
  _payment_id uuid := NULL;
  _entity_id uuid := NULL;
  _action text := lower(TG_OP);
  _summary text := TG_TABLE_NAME || ' ' || lower(TG_OP);
  _changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_TABLE_NAME = 'balance_adjustments' THEN
    _entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    _tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
    _actor_id := COALESCE(
      CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END,
      _actor_id
    );
    _action := CASE TG_OP
      WHEN 'INSERT' THEN 'balance_adjustment_created'
      WHEN 'UPDATE' THEN 'balance_adjustment_updated'
      ELSE 'balance_adjustment_deleted'
    END;
    _summary := CASE TG_OP
      WHEN 'INSERT' THEN format(
        'Balance %s of $%s changed tenant balance from $%s to $%s',
        NEW.adjustment_type,
        NEW.amount,
        NEW.previous_balance,
        NEW.new_balance
      )
      WHEN 'UPDATE' THEN 'Balance adjustment updated'
      ELSE 'Balance adjustment deleted'
    END;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    _entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    _payment_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    _tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
    _property_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.property_id ELSE NEW.property_id END;
    _action := CASE TG_OP
      WHEN 'INSERT' THEN 'payment_created'
      WHEN 'UPDATE' THEN 'payment_updated'
      ELSE 'payment_deleted'
    END;
    _summary := CASE
      WHEN TG_OP = 'INSERT' THEN format('Payment created: $%s %s (%s)', NEW.amount, COALESCE(NEW.payment_type, 'payment'), NEW.status)
      WHEN TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN format('Payment status changed from %s to %s', OLD.status, NEW.status)
      WHEN TG_OP = 'UPDATE' AND OLD.balance_adjustment_id IS DISTINCT FROM NEW.balance_adjustment_id THEN 'Payment linked to tenant balance ledger'
      WHEN TG_OP = 'UPDATE' THEN 'Payment updated'
      ELSE format('Payment deleted: $%s %s', OLD.amount, COALESCE(OLD.payment_type, 'payment'))
    END;
  ELSIF TG_TABLE_NAME = 'tenants' THEN
    _entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    _tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    _property_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.property_id ELSE NEW.property_id END;
    _action := CASE TG_OP
      WHEN 'INSERT' THEN 'tenant_created'
      WHEN 'UPDATE' THEN 'tenant_updated'
      ELSE 'tenant_deleted'
    END;
    _summary := CASE
      WHEN TG_OP = 'INSERT' THEN 'Tenant created'
      WHEN TG_OP = 'UPDATE' AND OLD.current_balance IS DISTINCT FROM NEW.current_balance THEN format('Tenant balance changed from $%s to $%s', OLD.current_balance, NEW.current_balance)
      WHEN TG_OP = 'UPDATE' AND OLD.is_active IS DISTINCT FROM NEW.is_active THEN format('Tenant active status changed to %s', NEW.is_active)
      WHEN TG_OP = 'UPDATE' THEN 'Tenant updated'
      ELSE 'Tenant deleted'
    END;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    _changed_fields := public.audit_changed_fields(_old, _new);
    IF array_length(_changed_fields, 1) IS NULL THEN
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_logs (
    action,
    entity_type,
    entity_id,
    actor_id,
    tenant_id,
    property_id,
    payment_id,
    summary,
    changed_fields,
    old_data,
    new_data,
    metadata
  )
  VALUES (
    _action,
    TG_TABLE_NAME,
    _entity_id,
    _actor_id,
    _tenant_id,
    _property_id,
    _payment_id,
    _summary,
    _changed_fields,
    _old,
    _new,
    jsonb_build_object('operation', TG_OP, 'source', 'database_trigger')
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_balance_adjustments ON public.balance_adjustments;
CREATE TRIGGER audit_balance_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON public.balance_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.write_admin_audit_log();

DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.write_admin_audit_log();

DROP TRIGGER IF EXISTS audit_tenants ON public.tenants;
CREATE TRIGGER audit_tenants
  AFTER INSERT OR UPDATE OR DELETE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.write_admin_audit_log();
