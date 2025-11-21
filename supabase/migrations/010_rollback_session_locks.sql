-- ROLLBACK: Remove session_locks table and related functions
-- Run this if you need to revert the race condition prevention feature
-- WARNING: This will remove all active locks from the database

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_expired_locks() CASCADE;
DROP FUNCTION IF EXISTS has_active_lock(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS release_session_lock(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS acquire_session_lock(TEXT, TEXT, TEXT, INT) CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_session_locks_expires_at CASCADE;
DROP INDEX IF EXISTS idx_session_locks_user_email_fingerprint CASCADE;

-- Drop table
DROP TABLE IF EXISTS session_locks CASCADE;

-- Verify rollback
SELECT 'Rollback completed successfully. session_locks table and all related functions have been removed.' AS status;
