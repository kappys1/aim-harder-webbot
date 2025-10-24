-- Add timezone support to boxes table for Phase 2 of DST fix
-- Allows each box to have its own timezone for accurate prebooking calculations
-- Default to 'Europe/Madrid' for backward compatibility

ALTER TABLE boxes
ADD COLUMN timezone TEXT DEFAULT 'Europe/Madrid' NOT NULL;

-- Add check constraint to ensure valid IANA timezone format
-- IANA timezones follow pattern: Continent/City or similar
ALTER TABLE boxes
ADD CONSTRAINT boxes_valid_timezone CHECK (timezone ~ '^[A-Z][a-z_]+/[A-Z][a-z_]+$');

-- Create index on timezone for potential future filtering
CREATE INDEX idx_boxes_timezone ON boxes(timezone);

-- Add comment to document the timezone column
COMMENT ON COLUMN boxes.timezone IS 'IANA timezone string (e.g., Europe/Madrid, America/New_York) for calculating prebooking availability at box local time';
