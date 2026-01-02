-- Enable realtime for balance_adjustments table
ALTER TABLE public.balance_adjustments REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.balance_adjustments;