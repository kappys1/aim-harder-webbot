-- Rollback: 007_multi_session_architecture_rollback.sql
-- Description: Rollback multi-session architecture to single session per user
-- Date: 2025-10-17
-- Author: Claude Code
--
-- WARNING: This rollback will DELETE all sessions except one per user
-- Only run this if you need to completely revert the multi-session feature

BEGIN;

-- ============================================================================
-- STEP 1: Drop new RLS policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own sessions" ON auth_sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON auth_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON auth_sessions;
DROP POLICY IF EXISTS "Users can delete only their device sessions" ON auth_sessions;
DROP POLICY IF EXISTS "Service role has full access" ON auth_sessions;

-- Restore original simple policy
CREATE POLICY "Users can manage their own sessions" ON auth_sessions
  FOR ALL
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- ============================================================================
-- STEP 2: Clean up data - keep only one session per user
-- ============================================================================
-- WARNING: This will delete background sessions and extra device sessions
-- Keeps the most recently updated session for each user

WITH ranked_sessions AS (
  SELECT
    id,
    user_email,
    ROW_NUMBER() OVER (
      PARTITION BY user_email
      ORDER BY updated_at DESC
    ) as rn
  FROM auth_sessions
)
DELETE FROM auth_sessions
WHERE id IN (
  SELECT id
  FROM ranked_sessions
  WHERE rn > 1
);

-- ============================================================================
-- STEP 3: Drop new indexes
-- ============================================================================
DROP INDEX IF EXISTS idx_auth_sessions_email_type;
DROP INDEX IF EXISTS idx_auth_sessions_background;
DROP INDEX IF EXISTS idx_auth_sessions_device;
DROP INDEX IF EXISTS idx_auth_sessions_protected;
DROP INDEX IF EXISTS idx_auth_sessions_cleanup;
DROP INDEX IF EXISTS idx_auth_sessions_background_unique;

-- Restore original email index
CREATE INDEX IF NOT EXISTS idx_auth_sessions_email ON auth_sessions(user_email);

-- ============================================================================
-- STEP 4: Drop new constraints
-- ============================================================================
ALTER TABLE auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_email_fingerprint_unique;

-- Restore original unique constraint on user_email
ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_user_email_key UNIQUE (user_email);

-- ============================================================================
-- STEP 5: Remove new columns
-- ============================================================================
ALTER TABLE auth_sessions
  DROP COLUMN IF EXISTS session_type,
  DROP COLUMN IF EXISTS protected;

-- ============================================================================
-- STEP 6: Make fingerprint nullable again (restore original)
-- ============================================================================
ALTER TABLE auth_sessions
  ALTER COLUMN fingerprint DROP NOT NULL;

-- ============================================================================
-- STEP 7: Restore original cleanup function
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  -- Original: Delete all sessions older than 7 days
  DELETE FROM auth_sessions
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions IS 'Cleans up all sessions older than 7 days.';

-- ============================================================================
-- STEP 8: Update table comment
-- ============================================================================
COMMENT ON TABLE auth_sessions IS 'Stores Aimharder authentication sessions with cookies and tokens';

COMMIT;

-- ============================================================================
-- Rollback complete!
-- ============================================================================
-- WARNING: After running this rollback:
-- 1. All background sessions have been deleted
-- 2. Only one session per user remains
-- 3. Pre-bookings may fail if they were using background sessions
-- 4. Users will need to re-login if their session was deleted
-- ============================================================================
