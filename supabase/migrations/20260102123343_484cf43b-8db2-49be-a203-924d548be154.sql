-- Enable realtime for leases table
ALTER TABLE leases REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE leases;