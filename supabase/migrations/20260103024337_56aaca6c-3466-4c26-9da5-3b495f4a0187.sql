-- Create atomic balance adjustment function
CREATE OR REPLACE FUNCTION public.apply_balance_adjustment(
  _tenant_id UUID,
  _adjustment_type TEXT,
  _amount NUMERIC,
  _description TEXT DEFAULT NULL,
  _created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _previous_balance NUMERIC;
  _new_balance NUMERIC;
  _adjustment_row balance_adjustments;
  _tenant_record tenants;
BEGIN
  -- Validate adjustment type
  IF _adjustment_type NOT IN ('credit', 'charge', 'late_fee', 'payment', 'correction') THEN
    RAISE EXCEPTION 'Invalid adjustment type: %', _adjustment_type;
  END IF;

  -- Validate amount (must be positive for all types except correction)
  IF _adjustment_type != 'correction' AND _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive for adjustment type: %', _adjustment_type;
  END IF;

  -- Get current tenant balance with row lock
  SELECT * INTO _tenant_record
  FROM tenants
  WHERE id = _tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', _tenant_id;
  END IF;

  _previous_balance := COALESCE(_tenant_record.current_balance, 0);

  -- Calculate new balance based on adjustment type
  CASE _adjustment_type
    WHEN 'charge', 'late_fee' THEN
      _new_balance := _previous_balance + ABS(_amount);
    WHEN 'credit', 'payment' THEN
      _new_balance := _previous_balance - ABS(_amount);
    WHEN 'correction' THEN
      _new_balance := _previous_balance + _amount;
  END CASE;

  -- Insert balance adjustment record
  INSERT INTO balance_adjustments (
    tenant_id,
    amount,
    adjustment_type,
    description,
    previous_balance,
    new_balance,
    created_by
  ) VALUES (
    _tenant_id,
    _amount,
    _adjustment_type,
    _description,
    _previous_balance,
    _new_balance,
    _created_by
  )
  RETURNING * INTO _adjustment_row;

  -- Update tenant's current balance
  UPDATE tenants
  SET current_balance = _new_balance, updated_at = now()
  WHERE id = _tenant_id;

  -- Return result
  RETURN jsonb_build_object(
    'new_balance', _new_balance,
    'previous_balance', _previous_balance,
    'adjustment_id', _adjustment_row.id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.apply_balance_adjustment TO authenticated;