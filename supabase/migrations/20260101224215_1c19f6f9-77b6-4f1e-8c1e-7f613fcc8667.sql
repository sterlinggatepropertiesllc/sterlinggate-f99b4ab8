-- Add new late fee and payment timing columns
ALTER TABLE public.leases
ADD COLUMN rent_due_day integer DEFAULT 1,
ADD COLUMN late_after_day integer DEFAULT 5,
ADD COLUMN late_fee_type text DEFAULT 'percentage',
ADD COLUMN late_fee_flat_amount numeric DEFAULT 0,
ADD COLUMN late_fee_daily_amount numeric DEFAULT 0,
ADD COLUMN late_fee_max_amount numeric DEFAULT NULL;