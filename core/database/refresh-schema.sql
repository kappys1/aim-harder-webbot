-- Add refresh tracking fields to auth_sessions table
ALTER TABLE auth_sessions
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_refresh_error TEXT,
ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT true;

-- Create index for refresh queries (find sessions needing refresh)
CREATE INDEX IF NOT EXISTS idx_auth_sessions_last_refresh
ON auth_sessions(last_refresh_date, auto_refresh_enabled)
WHERE auto_refresh_enabled = true;

-- Create index for error tracking
CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh_errors
ON auth_sessions(last_refresh_error, last_refresh_date)
WHERE last_refresh_error IS NOT NULL;

-- Update the trigger function to handle new fields
CREATE OR REPLACE FUNCTION update_auth_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- If refresh_count is being updated, update last_refresh_date
  IF NEW.refresh_count > OLD.refresh_count THEN
    NEW.last_refresh_date = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get sessions needing refresh (older than specified hours)
CREATE OR REPLACE FUNCTION get_sessions_needing_refresh(hours_threshold INTEGER DEFAULT 6)
RETURNS TABLE (
  id UUID,
  user_email VARCHAR(255),
  aimharder_token TEXT,
  aimharder_cookies JSONB,
  created_at TIMESTAMPTZ,
  last_refresh_date TIMESTAMPTZ,
  refresh_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_email,
    s.aimharder_token,
    s.aimharder_cookies,
    s.created_at,
    s.last_refresh_date,
    s.refresh_count
  FROM auth_sessions s
  WHERE s.auto_refresh_enabled = true
    AND (
      -- Never refreshed and created more than threshold hours ago
      (s.last_refresh_date IS NULL AND s.created_at < NOW() - INTERVAL '1 hour' * hours_threshold)
      OR
      -- Last refresh was more than threshold hours ago
      (s.last_refresh_date IS NOT NULL AND s.last_refresh_date < NOW() - INTERVAL '1 hour' * hours_threshold)
    )
    -- Exclude sessions with recent errors (retry after 1 hour)
    AND (s.last_refresh_error IS NULL OR s.updated_at < NOW() - INTERVAL '1 hour')
  ORDER BY
    COALESCE(s.last_refresh_date, s.created_at) ASC
  LIMIT 20; -- Default batch size
END;
$$ LANGUAGE plpgsql;

-- Function to record successful refresh
CREATE OR REPLACE FUNCTION record_successful_refresh(session_email VARCHAR(255))
RETURNS VOID AS $$
BEGIN
  UPDATE auth_sessions
  SET
    refresh_count = refresh_count + 1,
    last_refresh_date = NOW(),
    last_refresh_error = NULL,
    updated_at = NOW()
  WHERE user_email = session_email;
END;
$$ LANGUAGE plpgsql;

-- Function to record failed refresh
CREATE OR REPLACE FUNCTION record_failed_refresh(session_email VARCHAR(255), error_message TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE auth_sessions
  SET
    last_refresh_error = LEFT(error_message, 500), -- Truncate long error messages
    updated_at = NOW()
  WHERE user_email = session_email;
END;
$$ LANGUAGE plpgsql;

-- Function to get refresh statistics
CREATE OR REPLACE FUNCTION get_refresh_stats()
RETURNS TABLE (
  total_sessions INTEGER,
  auto_refresh_enabled INTEGER,
  recently_refreshed INTEGER,
  sessions_with_errors INTEGER,
  avg_refresh_count NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_sessions,
    COUNT(*) FILTER (WHERE auto_refresh_enabled = true)::INTEGER as auto_refresh_enabled,
    COUNT(*) FILTER (WHERE last_refresh_date > NOW() - INTERVAL '24 hours')::INTEGER as recently_refreshed,
    COUNT(*) FILTER (WHERE last_refresh_error IS NOT NULL)::INTEGER as sessions_with_errors,
    COALESCE(AVG(refresh_count), 0) as avg_refresh_count
  FROM auth_sessions;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old refresh errors (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_refresh_errors()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  UPDATE auth_sessions
  SET last_refresh_error = NULL
  WHERE last_refresh_error IS NOT NULL
    AND updated_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for new fields
COMMENT ON COLUMN auth_sessions.last_refresh_date IS 'Timestamp of last successful token refresh';
COMMENT ON COLUMN auth_sessions.refresh_count IS 'Number of successful refreshes performed';
COMMENT ON COLUMN auth_sessions.last_refresh_error IS 'Last refresh error message (if any)';
COMMENT ON COLUMN auth_sessions.auto_refresh_enabled IS 'Whether this session should be included in automatic refresh';

-- Comments for new functions
COMMENT ON FUNCTION get_sessions_needing_refresh(INTEGER) IS 'Returns sessions that need refresh based on age threshold';
COMMENT ON FUNCTION record_successful_refresh(VARCHAR) IS 'Records successful refresh and updates counters';
COMMENT ON FUNCTION record_failed_refresh(VARCHAR, TEXT) IS 'Records failed refresh with error message';
COMMENT ON FUNCTION get_refresh_stats() IS 'Returns overall refresh statistics';
COMMENT ON FUNCTION cleanup_old_refresh_errors() IS 'Cleans up old refresh errors (run periodically)';