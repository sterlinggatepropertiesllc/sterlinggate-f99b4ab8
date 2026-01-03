-- Enable realtime for applications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;

-- Drop existing trigger if it exists (from notify_on_new_application function)
DROP TRIGGER IF EXISTS on_new_application ON applications;
DROP TRIGGER IF EXISTS notify_new_application ON applications;

-- Create trigger for new applications (uses existing notify_on_new_application function)
CREATE TRIGGER on_new_application
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_application();