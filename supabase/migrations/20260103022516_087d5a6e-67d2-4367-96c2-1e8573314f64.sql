-- Enable realtime for signatures table only (leases already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.signatures;