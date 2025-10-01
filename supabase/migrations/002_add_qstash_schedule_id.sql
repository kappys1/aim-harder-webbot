-- Add qstash_schedule_id column to prebookings table
-- This stores the QStash message ID for cancellation if user deletes the prebooking

ALTER TABLE prebookings
ADD COLUMN IF NOT EXISTS qstash_schedule_id TEXT;

-- Add index for faster lookups when canceling
CREATE INDEX IF NOT EXISTS idx_prebookings_qstash_schedule_id
ON prebookings(qstash_schedule_id)
WHERE qstash_schedule_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN prebookings.qstash_schedule_id IS 'QStash message ID for scheduled execution (used for cancellation)';
