-- Add new columns to leases table for comprehensive lease terms
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS lease_type TEXT DEFAULT 'gross';
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS document_hash TEXT;
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS cam_charges NUMERIC;
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS property_tax_responsibility TEXT DEFAULT 'landlord';
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS insurance_responsibility TEXT DEFAULT 'tenant';
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS late_fee_percentage NUMERIC DEFAULT 5;
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 5;
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS renewal_terms TEXT;
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS additional_clauses TEXT;

-- Add user_agent to signatures for complete audit trail
ALTER TABLE public.signatures ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;