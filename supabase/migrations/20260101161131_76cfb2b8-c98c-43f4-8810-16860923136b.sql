-- Make bedrooms and bathrooms optional for commercial properties
ALTER TABLE properties ALTER COLUMN bedrooms DROP NOT NULL;
ALTER TABLE properties ALTER COLUMN bedrooms SET DEFAULT NULL;
ALTER TABLE properties ALTER COLUMN bathrooms DROP NOT NULL;
ALTER TABLE properties ALTER COLUMN bathrooms SET DEFAULT NULL;

-- Add property_type for commercial categorization
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type TEXT;