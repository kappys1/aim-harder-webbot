-- Create prebookings table for automatic booking execution
CREATE TABLE IF NOT EXISTS prebookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  booking_data JSONB NOT NULL, -- {day, familyId, id, insist}
  available_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/loaded/executing/completed/failed
  result JSONB, -- Execution result
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  loaded_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);

-- Index for efficient queries by status and available_at
CREATE INDEX IF NOT EXISTS idx_prebookings_available_at_status
  ON prebookings(available_at, status)
  WHERE status IN ('pending', 'loaded');

-- Index for FIFO ordering
CREATE INDEX IF NOT EXISTS idx_prebookings_created_at
  ON prebookings(created_at);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_prebookings_user_email
  ON prebookings(user_email);

-- Add comment for documentation
COMMENT ON TABLE prebookings IS 'Stores pre-bookings that will be automatically executed when booking becomes available';
COMMENT ON COLUMN prebookings.booking_data IS 'JSON with booking request data: {day, familyId, id, insist}';
COMMENT ON COLUMN prebookings.available_at IS 'Timestamp when the booking becomes available (from error message)';
COMMENT ON COLUMN prebookings.status IS 'pending: waiting, loaded: in memory ready, executing: processing, completed: success, failed: error';
COMMENT ON COLUMN prebookings.created_at IS 'Used for FIFO ordering - earlier created_at gets executed first';