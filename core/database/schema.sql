-- Create auth_sessions table for storing Aimharder authentication data
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL UNIQUE,
  aimharder_token TEXT NOT NULL,
  aimharder_cookies JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_refresh_date TIMESTAMPTZ,
  refresh_count INTEGER DEFAULT 0,
  last_refresh_error TEXT,
  auto_refresh_enabled BOOLEAN DEFAULT true,
  last_token_update_date TIMESTAMP,
  token_update_count INTEGER DEFAULT 0,
  last_token_update_error TEXT,
  fingerprint VARCHAR(50),
  is_admin BOOLEAN NOT NULL DEFAULT false
);

-- Index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_auth_sessions_email ON auth_sessions(user_email);

-- Index for faster lookups by creation date (for cleanup)
CREATE INDEX IF NOT EXISTS idx_auth_sessions_created_at ON auth_sessions(created_at);

-- Index for refresh tracking
CREATE INDEX IF NOT EXISTS idx_auth_sessions_last_refresh ON auth_sessions(last_refresh_date, auto_refresh_enabled)
  WHERE auto_refresh_enabled = true;

-- Index for refresh errors
CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh_errors ON auth_sessions(last_refresh_error, last_refresh_date)
  WHERE last_refresh_error IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policy for users to manage their own sessions
CREATE POLICY "Users can manage their own sessions" ON auth_sessions
  FOR ALL USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auth_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER auth_sessions_updated_at_trigger
  BEFORE UPDATE ON auth_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_auth_sessions_updated_at();

-- Function to clean up expired sessions (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_sessions
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE auth_sessions IS 'Stores Aimharder authentication sessions with cookies and tokens';
COMMENT ON COLUMN auth_sessions.user_email IS 'User email as unique identifier';
COMMENT ON COLUMN auth_sessions.aimharder_token IS 'Token extracted from Aimharder login response';
COMMENT ON COLUMN auth_sessions.aimharder_cookies IS 'JSON array of cookies (AWSALB, AWSALBCORS, PHPSESSID, amhrdrauth)';
COMMENT ON COLUMN auth_sessions.last_refresh_date IS 'Last time the token was refreshed via setrefresh endpoint';
COMMENT ON COLUMN auth_sessions.refresh_count IS 'Number of successful token refreshes';
COMMENT ON COLUMN auth_sessions.last_refresh_error IS 'Last error message from token refresh attempt';
COMMENT ON COLUMN auth_sessions.auto_refresh_enabled IS 'Whether automatic token refresh is enabled for this session';
COMMENT ON COLUMN auth_sessions.last_token_update_date IS 'Last time the token was updated via tokenUpdate endpoint';
COMMENT ON COLUMN auth_sessions.token_update_count IS 'Number of successful token updates';
COMMENT ON COLUMN auth_sessions.last_token_update_error IS 'Last error message from token update attempt';
COMMENT ON COLUMN auth_sessions.fingerprint IS 'Browser fingerprint for this session';
COMMENT ON COLUMN auth_sessions.is_admin IS 'Whether this user has admin privileges';