-- Add late fee configuration columns to tenant_properties table
ALTER TABLE public.tenant_properties
ADD COLUMN late_fee_type text DEFAULT 'percentage',
ADD COLUMN late_fee_percentage numeric DEFAULT 5,
ADD COLUMN late_fee_flat_amount numeric DEFAULT 0,
ADD COLUMN late_fee_daily_amount numeric DEFAULT 0,
ADD COLUMN late_fee_max_amount numeric DEFAULT NULL,
ADD COLUMN grace_period_days integer DEFAULT 5,
ADD COLUMN rent_due_day integer DEFAULT 1;