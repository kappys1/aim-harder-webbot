-- Create session_locks table for race condition prevention
-- This table prevents the cron job from updating a token while it's being used by QStash
CREATE TABLE IF NOT EXISTS session_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  lock_acquired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  lock_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  acquired_by TEXT NOT NULL, -- 'execute-prebooking', 'booking', etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Composite unique constraint: only one active lock per session
  CONSTRAINT unique_active_lock UNIQUE (user_email, fingerprint)
);

-- Index for efficient lock cleanup
CREATE INDEX idx_session_locks_expires_at ON session_locks(lock_expires_at);

-- Index for checking if lock exists
CREATE INDEX idx_session_locks_user_email_fingerprint ON session_locks(user_email, fingerprint);

-- Function to acquire lock with automatic expiration
CREATE OR REPLACE FUNCTION acquire_session_lock(
  p_user_email TEXT,
  p_fingerprint TEXT,
  p_acquired_by TEXT,
  p_lock_duration_ms INT DEFAULT 5000 -- 5 seconds default
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Try to insert a new lock
  -- If it already exists, the UNIQUE constraint will prevent insertion
  INSERT INTO session_locks (
    user_email,
    fingerprint,
    lock_acquired_at,
    lock_expires_at,
    acquired_by
  )
  VALUES (
    p_user_email,
    p_fingerprint,
    NOW(),
    NOW() + (p_lock_duration_ms || ' milliseconds')::INTERVAL,
    p_acquired_by
  )
  ON CONFLICT (user_email, fingerprint) DO UPDATE
  SET
    lock_acquired_at = NOW(),
    lock_expires_at = NOW() + (p_lock_duration_ms || ' milliseconds')::INTERVAL,
    acquired_by = p_acquired_by
  WHERE session_locks.lock_expires_at < NOW(); -- Only update if expired

  RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
  -- Lock already exists and hasn't expired
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if lock exists and is active
CREATE OR REPLACE FUNCTION has_active_lock(
  p_user_email TEXT,
  p_fingerprint TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_lock_count INT;
BEGIN
  SELECT COUNT(*) INTO v_lock_count
  FROM session_locks
  WHERE user_email = p_user_email
    AND fingerprint = p_fingerprint
    AND lock_expires_at > NOW();

  RETURN v_lock_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to release lock
CREATE OR REPLACE FUNCTION release_session_lock(
  p_user_email TEXT,
  p_fingerprint TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM session_locks
  WHERE user_email = p_user_email
    AND fingerprint = p_fingerprint;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired locks (can be called by cron periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM session_locks
  WHERE lock_expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_deleted;
END;
$$ LANGUAGE plpgsql;
