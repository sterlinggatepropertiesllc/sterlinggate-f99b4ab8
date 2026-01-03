-- Create rent_charges table to track rent periods and late fees
CREATE TABLE public.rent_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES public.leases(id) ON DELETE SET NULL,
  rent_period DATE NOT NULL,
  rent_amount NUMERIC NOT NULL,
  charged_at TIMESTAMPTZ DEFAULT now(),
  late_fee_applied BOOLEAN DEFAULT false,
  late_fee_amount NUMERIC DEFAULT 0,
  late_fee_applied_at TIMESTAMPTZ,
  late_fee_waived BOOLEAN DEFAULT false,
  late_fee_waived_at TIMESTAMPTZ,
  late_fee_waived_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, rent_period)
);

-- Add automation flags to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS auto_charge_rent BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_apply_late_fees BOOLEAN DEFAULT true;

-- Enable RLS on rent_charges
ALTER TABLE public.rent_charges ENABLE ROW LEVEL SECURITY;

-- RLS policies for rent_charges
CREATE POLICY "Property managers can manage rent charges for their tenants"
ON public.rent_charges FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.tenants t
  WHERE t.id = rent_charges.tenant_id AND t.manager_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tenants t
  WHERE t.id = rent_charges.tenant_id AND t.manager_id = auth.uid()
));

CREATE POLICY "Tenants can view their own rent charges"
ON public.rent_charges FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tenants t
  WHERE t.id = rent_charges.tenant_id AND t.user_id = auth.uid()
));

-- Create index for efficient queries
CREATE INDEX idx_rent_charges_tenant_id ON public.rent_charges(tenant_id);
CREATE INDEX idx_rent_charges_status ON public.rent_charges(status);
CREATE INDEX idx_rent_charges_rent_period ON public.rent_charges(rent_period);

-- Function to calculate late fee based on lease terms
CREATE OR REPLACE FUNCTION public.calculate_late_fee(
  _lease_id UUID,
  _rent_amount NUMERIC,
  _days_late INTEGER
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _lease RECORD;
  _late_fee NUMERIC := 0;
BEGIN
  -- Get lease late fee configuration
  SELECT late_fee_type, late_fee_percentage, late_fee_flat_amount, 
         late_fee_daily_amount, late_fee_max_amount
  INTO _lease
  FROM leases WHERE id = _lease_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate based on late fee type
  CASE _lease.late_fee_type
    WHEN 'percentage' THEN
      _late_fee := _rent_amount * COALESCE(_lease.late_fee_percentage, 5) / 100;
    WHEN 'flat' THEN
      _late_fee := COALESCE(_lease.late_fee_flat_amount, 0);
    WHEN 'daily' THEN
      _late_fee := COALESCE(_lease.late_fee_daily_amount, 0) * _days_late;
      -- Cap at max amount if specified
      IF _lease.late_fee_max_amount IS NOT NULL AND _lease.late_fee_max_amount > 0 THEN
        _late_fee := LEAST(_late_fee, _lease.late_fee_max_amount);
      END IF;
    ELSE
      -- Default to percentage if type not set
      _late_fee := _rent_amount * COALESCE(_lease.late_fee_percentage, 5) / 100;
  END CASE;

  RETURN COALESCE(_late_fee, 0);
END;
$$;

-- Function to charge rent for a specific tenant
CREATE OR REPLACE FUNCTION public.charge_tenant_rent(
  _tenant_id UUID,
  _rent_period DATE DEFAULT NULL,
  _created_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant RECORD;
  _lease RECORD;
  _period DATE;
  _rent_charge_id UUID;
  _adjustment_result JSONB;
BEGIN
  -- Get tenant info
  SELECT * INTO _tenant FROM tenants WHERE id = _tenant_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found or inactive');
  END IF;

  -- Determine rent period (first day of month)
  _period := COALESCE(_rent_period, date_trunc('month', CURRENT_DATE)::DATE);

  -- Check if rent already charged for this period
  IF EXISTS (SELECT 1 FROM rent_charges WHERE tenant_id = _tenant_id AND rent_period = _period) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent already charged for this period');
  END IF;

  -- Get active lease for rent amount
  SELECT * INTO _lease 
  FROM leases 
  WHERE tenant_id = (SELECT user_id FROM tenants WHERE id = _tenant_id)
    AND status IN ('completed', 'pending_manager_signature', 'pending_tenant_signature')
    AND start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;

  -- Use tenant rent_amount if no lease, or lease monthly_rent
  DECLARE
    _rent_amount NUMERIC := COALESCE(_lease.monthly_rent, _tenant.rent_amount, 0);
  BEGIN
    IF _rent_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'No rent amount configured');
    END IF;

    -- Create rent charge record
    INSERT INTO rent_charges (tenant_id, lease_id, rent_period, rent_amount)
    VALUES (_tenant_id, _lease.id, _period, _rent_amount)
    RETURNING id INTO _rent_charge_id;

    -- Apply balance adjustment
    _adjustment_result := apply_balance_adjustment(
      _tenant_id,
      'charge',
      _rent_amount,
      'Monthly rent for ' || to_char(_period, 'Month YYYY'),
      _created_by
    );

    RETURN jsonb_build_object(
      'success', true,
      'rent_charge_id', _rent_charge_id,
      'amount', _rent_amount,
      'period', _period,
      'adjustment', _adjustment_result
    );
  END;
END;
$$;

-- Function to apply late fee for a specific rent charge
CREATE OR REPLACE FUNCTION public.apply_rent_late_fee(
  _rent_charge_id UUID,
  _created_by UUID DEFAULT NULL,
  _override_amount NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rent_charge RECORD;
  _tenant RECORD;
  _lease RECORD;
  _days_late INTEGER;
  _late_fee NUMERIC;
  _adjustment_result JSONB;
BEGIN
  -- Get rent charge
  SELECT * INTO _rent_charge FROM rent_charges WHERE id = _rent_charge_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent charge not found');
  END IF;

  -- Check if late fee already applied or waived
  IF _rent_charge.late_fee_applied THEN
    RETURN jsonb_build_object('success', false, 'error', 'Late fee already applied');
  END IF;
  IF _rent_charge.late_fee_waived THEN
    RETURN jsonb_build_object('success', false, 'error', 'Late fee was waived');
  END IF;

  -- Get tenant
  SELECT * INTO _tenant FROM tenants WHERE id = _rent_charge.tenant_id;

  -- Get lease for late fee configuration
  SELECT * INTO _lease FROM leases WHERE id = _rent_charge.lease_id;

  -- Calculate days late
  _days_late := GREATEST(0, CURRENT_DATE - (_rent_charge.rent_period + COALESCE(_lease.rent_due_day, 1) - 1 + COALESCE(_lease.grace_period_days, 5)));

  -- Calculate or use override amount
  IF _override_amount IS NOT NULL THEN
    _late_fee := _override_amount;
  ELSE
    _late_fee := calculate_late_fee(_rent_charge.lease_id, _rent_charge.rent_amount, _days_late);
  END IF;

  IF _late_fee <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Late fee amount is zero');
  END IF;

  -- Update rent charge record
  UPDATE rent_charges 
  SET late_fee_applied = true,
      late_fee_amount = _late_fee,
      late_fee_applied_at = now(),
      updated_at = now()
  WHERE id = _rent_charge_id;

  -- Apply balance adjustment
  _adjustment_result := apply_balance_adjustment(
    _rent_charge.tenant_id,
    'late_fee',
    _late_fee,
    'Late fee for ' || to_char(_rent_charge.rent_period, 'Month YYYY') || ' rent (' || _days_late || ' days late)',
    _created_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'late_fee', _late_fee,
    'days_late', _days_late,
    'adjustment', _adjustment_result
  );
END;
$$;

-- Function to waive late fee
CREATE OR REPLACE FUNCTION public.waive_rent_late_fee(
  _rent_charge_id UUID,
  _waived_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE rent_charges
  SET late_fee_waived = true,
      late_fee_waived_at = now(),
      late_fee_waived_by = _waived_by,
      updated_at = now()
  WHERE id = _rent_charge_id AND late_fee_applied = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rent charge not found or late fee already applied');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to process all pending rent charges (for cron job)
CREATE OR REPLACE FUNCTION public.process_monthly_rent()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant RECORD;
  _result JSONB;
  _processed INTEGER := 0;
  _errors INTEGER := 0;
  _current_period DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
  -- Process all active tenants with auto_charge_rent enabled
  FOR _tenant IN 
    SELECT t.* 
    FROM tenants t
    WHERE t.is_active = true 
      AND t.auto_charge_rent = true
      AND NOT EXISTS (
        SELECT 1 FROM rent_charges rc 
        WHERE rc.tenant_id = t.id AND rc.rent_period = _current_period
      )
  LOOP
    _result := charge_tenant_rent(_tenant.id, _current_period);
    IF (_result->>'success')::boolean THEN
      _processed := _processed + 1;
    ELSE
      _errors := _errors + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', _processed,
    'errors', _errors,
    'period', _current_period
  );
END;
$$;

-- Function to process late fees for all overdue rent charges (for cron job)
CREATE OR REPLACE FUNCTION public.process_late_fees()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rent_charge RECORD;
  _tenant RECORD;
  _lease RECORD;
  _result JSONB;
  _processed INTEGER := 0;
  _errors INTEGER := 0;
  _due_date DATE;
  _grace_end_date DATE;
BEGIN
  -- Find all pending rent charges that are past grace period and haven't had late fee applied
  FOR _rent_charge IN 
    SELECT rc.* 
    FROM rent_charges rc
    JOIN tenants t ON t.id = rc.tenant_id
    WHERE rc.status = 'pending'
      AND rc.late_fee_applied = false
      AND rc.late_fee_waived = false
      AND t.auto_apply_late_fees = true
      AND t.is_active = true
  LOOP
    -- Get lease for grace period
    SELECT * INTO _lease FROM leases WHERE id = _rent_charge.lease_id;
    
    -- Calculate due date and grace end date
    _due_date := _rent_charge.rent_period + COALESCE(_lease.rent_due_day, 1) - 1;
    _grace_end_date := _due_date + COALESCE(_lease.grace_period_days, 5);
    
    -- Only apply late fee if we're past grace period
    IF CURRENT_DATE > _grace_end_date THEN
      _result := apply_rent_late_fee(_rent_charge.id);
      IF (_result->>'success')::boolean THEN
        _processed := _processed + 1;
      ELSE
        _errors := _errors + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', _processed,
    'errors', _errors
  );
END;
$$;

-- Enable realtime for rent_charges
ALTER PUBLICATION supabase_realtime ADD TABLE public.rent_charges;

-- Trigger to update updated_at
CREATE TRIGGER update_rent_charges_updated_at
BEFORE UPDATE ON public.rent_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();