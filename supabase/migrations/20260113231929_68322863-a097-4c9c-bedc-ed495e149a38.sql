-- Add payment_id column to applications table to link applications to their payments
ALTER TABLE applications 
ADD COLUMN payment_id uuid REFERENCES payments(id);

-- Add index for faster lookups
CREATE INDEX idx_applications_payment_id ON applications(payment_id);