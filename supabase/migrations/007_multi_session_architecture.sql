-- Migration: 007_multi_session_architecture.sql
-- Description: Implement multi-session architecture with background and device sessions
-- Date: 2025-10-17
-- Author: Claude Code (based on nextjs-architect design with critical fix)
--
-- CRITICAL FIX APPLIED: Background fingerprint is deterministic (no timestamp)
-- This ensures each user has exactly ONE background session that is reused on re-login
--
-- Key Changes:
-- 1. Remove UNIQUE constraint on user_email (allow multiple sessions per user)
-- 2. Add session_type column (background | device)
-- 3. Add protected column (safety flag for background sessions)
-- 4. Make fingerprint NOT NULL
-- 5. Add composite UNIQUE constraint on (user_email, fingerprint)
-- 6. Add partial UNIQUE index ensuring only ONE background session per user
-- 7. Create optimized indexes for common query patterns
-- 8. Update cleanup function to ONLY delete device sessions
-- 9. Update RLS policies for granular access control

BEGIN;

-- ============================================================================
-- STEP 1: Handle dependent foreign key from user_boxes
-- ============================================================================
-- The auth_sessions_user_email_key constraint is referenced by user_boxes.user_email_fkey
-- We need to drop and recreate this foreign key constraint

-- Drop the foreign key constraint from user_boxes
ALTER TABLE user_boxes
  DROP CONSTRAINT IF EXISTS user_boxes_user_email_fkey;

COMMENT ON TABLE user_boxes IS 'Foreign key to auth_sessions temporarily dropped for migration';

-- ============================================================================
-- STEP 2: Drop existing UNIQUE constraint on user_email
-- ============================================================================
-- Now we can safely drop the UNIQUE constraint
ALTER TABLE auth_sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_user_email_key;

COMMENT ON TABLE auth_sessions IS 'Updated to support multiple sessions per user (background + devices)';

-- ============================================================================
-- STEP 3: Add new columns
-- ============================================================================
ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) NOT NULL DEFAULT 'device'
    CHECK (session_type IN ('background', 'device')),
  ADD COLUMN IF NOT EXISTS protected BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN auth_sessions.session_type IS 'Type of session: background (for cron jobs/pre-bookings) or device (for user devices)';
COMMENT ON COLUMN auth_sessions.protected IS 'If true, session cannot be deleted automatically (safety flag for background sessions)';

-- ============================================================================
-- STEP 4: Make fingerprint required (was nullable)
-- ============================================================================
-- First, set a default value for existing rows (shouldn't be any, but just in case)
UPDATE auth_sessions
SET fingerprint = 'legacy-' || id::text
WHERE fingerprint IS NULL;

ALTER TABLE auth_sessions
  ALTER COLUMN fingerprint SET NOT NULL;

-- ============================================================================
-- STEP 5: Add composite unique constraint
-- ============================================================================
-- This ensures that each (user_email, fingerprint) combination is unique
-- Allows multiple sessions per user, but each must have different fingerprint
ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_email_fingerprint_unique
    UNIQUE (user_email, fingerprint);

-- ============================================================================
-- STEP 6: Add unique constraint for background sessions
-- ============================================================================
-- CRITICAL: This partial index ensures each user has only ONE background session
-- Works together with deterministic fingerprint generation (bg-{hash(email)})
CREATE UNIQUE INDEX idx_auth_sessions_background_unique
  ON auth_sessions (user_email)
  WHERE session_type = 'background';

COMMENT ON INDEX idx_auth_sessions_background_unique IS 'Ensures each user has only ONE background session. Works with deterministic fingerprint.';

-- ============================================================================
-- STEP 7: Update indexes for optimal query performance
-- ============================================================================

-- Drop old email-only index (replaced by more specific indexes)
DROP INDEX IF EXISTS idx_auth_sessions_email;

-- Index for querying sessions by email and type (general purpose)
CREATE INDEX idx_auth_sessions_email_type
  ON auth_sessions (user_email, session_type);

-- Partial index for background session lookups (most common query for pre-bookings)
CREATE INDEX idx_auth_sessions_background
  ON auth_sessions (user_email, session_type)
  WHERE session_type = 'background';

-- Partial index for device session lookups
CREATE INDEX idx_auth_sessions_device
  ON auth_sessions (user_email, session_type)
  WHERE session_type = 'device';

-- Index for protected sessions (prevent accidental deletion)
CREATE INDEX idx_auth_sessions_protected
  ON auth_sessions (protected)
  WHERE protected = true;

-- Index for cleanup queries (only device sessions, sorted by age)
CREATE INDEX idx_auth_sessions_cleanup
  ON auth_sessions (created_at, session_type)
  WHERE session_type = 'device';

-- ============================================================================
-- STEP 8: Update cleanup function to ONLY delete device sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  -- CRITICAL: Only delete device sessions, NEVER background sessions
  -- Background sessions should persist indefinitely (user must manually delete)
  DELETE FROM auth_sessions
  WHERE session_type = 'device'
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions IS 'Cleans up ONLY device sessions older than 7 days. Background sessions are never auto-deleted.';

-- ============================================================================
-- STEP 9: Update RLS policies for granular access control
-- ============================================================================

-- Drop existing broad policy
DROP POLICY IF EXISTS "Users can manage their own sessions" ON auth_sessions;

-- Policy for users to read their own sessions
CREATE POLICY "Users can read their own sessions" ON auth_sessions
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Policy for users to create their own sessions (login)
CREATE POLICY "Users can create their own sessions" ON auth_sessions
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Policy for users to update their own sessions (token refresh)
CREATE POLICY "Users can update their own sessions" ON auth_sessions
  FOR UPDATE
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Policy for users to delete ONLY their device sessions
-- CRITICAL: Users cannot delete background sessions (prevents breaking pre-bookings)
CREATE POLICY "Users can delete only their device sessions" ON auth_sessions
  FOR DELETE
  USING (
    user_email = current_setting('request.jwt.claims', true)::json->>'email'
    AND session_type = 'device'
  );

-- Service role bypass (for cron jobs and admin operations)
CREATE POLICY "Service role has full access" ON auth_sessions
  FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

COMMENT ON POLICY "Users can delete only their device sessions" ON auth_sessions IS
  'Users can only delete their own device sessions. Background sessions can only be deleted by service role to prevent breaking pre-bookings.';

-- ============================================================================
-- STEP 10: Create cleanup function for orphaned user_boxes
-- ============================================================================
-- Since we can't have a foreign key with CASCADE (user_email is not UNIQUE),
-- we create a function to clean up user_boxes when ALL sessions are deleted

CREATE OR REPLACE FUNCTION cleanup_orphaned_user_boxes()
RETURNS void AS $$
BEGIN
  -- Delete user_boxes entries where the user has NO sessions at all
  DELETE FROM user_boxes
  WHERE user_email NOT IN (
    SELECT DISTINCT user_email FROM auth_sessions
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_orphaned_user_boxes IS
  'Removes user_boxes entries for users with no active sessions. Call this periodically (e.g., after session cleanup) or via trigger.';

-- Optional: Create a trigger to auto-cleanup after session deletion
-- This ensures user_boxes are cleaned up immediately when last session is deleted
CREATE OR REPLACE FUNCTION trigger_cleanup_user_boxes_on_session_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this was the user's last session
  IF NOT EXISTS (
    SELECT 1 FROM auth_sessions WHERE user_email = OLD.user_email
  ) THEN
    -- Delete all user_boxes for this user
    DELETE FROM user_boxes WHERE user_email = OLD.user_email;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auth_sessions_cleanup_user_boxes ON auth_sessions;
CREATE TRIGGER auth_sessions_cleanup_user_boxes
  AFTER DELETE ON auth_sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_user_boxes_on_session_delete();

COMMENT ON TRIGGER auth_sessions_cleanup_user_boxes ON auth_sessions IS
  'Automatically deletes user_boxes entries when the last session for a user is deleted. Mimics ON DELETE CASCADE behavior without requiring UNIQUE constraint.';

COMMENT ON TABLE user_boxes IS
  'Many-to-many relationship between users (by email) and boxes. User_boxes are automatically cleaned up when all user sessions are deleted (via trigger).';

-- ============================================================================
-- STEP 11: Add helpful comments for future reference
-- ============================================================================
COMMENT ON CONSTRAINT auth_sessions_email_fingerprint_unique ON auth_sessions IS
  'Ensures uniqueness of (user_email, fingerprint) combination. Allows multiple sessions per user with different fingerprints.';

-- ============================================================================
-- Verification queries (for testing after migration)
-- ============================================================================
-- Uncomment to run verification after migration:

-- SELECT
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE tablename = 'auth_sessions'
-- ORDER BY indexname;

-- SELECT
--   column_name,
--   data_type,
--   is_nullable,
--   column_default
-- FROM information_schema.columns
-- WHERE table_name = 'auth_sessions'
-- ORDER BY ordinal_position;

COMMIT;

-- ============================================================================
-- Migration complete!
-- ============================================================================
-- Next steps:
-- 1. Update SupabaseSessionService with new methods
-- 2. Update authentication endpoints (login/logout)
-- 3. Fix cron job (don't delete background sessions)
-- 4. Fix pre-booking execution (use getBackgroundSession)
-- ============================================================================
