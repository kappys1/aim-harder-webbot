-- Add is_admin column to auth_sessions table
ALTER TABLE auth_sessions
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_auth_sessions_is_admin
  ON auth_sessions(is_admin);

-- Add comment for documentation
COMMENT ON COLUMN auth_sessions.is_admin IS 'Indicates if the user has admin privileges (can bypass prebooking limits)';
