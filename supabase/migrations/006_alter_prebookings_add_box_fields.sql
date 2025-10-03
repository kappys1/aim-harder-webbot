-- Add box reference to prebookings table (for filtering and access validation)
-- Box data (subdomain, aimharder_id) will be stored in QStash payload, not here
ALTER TABLE prebookings
  ADD COLUMN IF NOT EXISTS box_id UUID REFERENCES boxes(id);

-- Create index for filtering prebookings by box
CREATE INDEX IF NOT EXISTS idx_prebookings_box_id ON prebookings(box_id);
CREATE INDEX IF NOT EXISTS idx_prebookings_user_box ON prebookings(user_email, box_id);
