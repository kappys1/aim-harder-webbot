#!/bin/bash

# ROLLBACK SCRIPT: Revert Race Condition Prevention Feature
# This script reverts all code changes made for the session lock feature
# Usage: bash scripts/rollback-race-condition-fix.sh

set -e

echo "🔄 Starting rollback of race condition prevention feature..."

# Files to revert
FILES=(
  "modules/auth/api/services/supabase-session.service.ts"
  "app/api/execute-prebooking/route.ts"
  "app/api/cron/refresh-tokens/route.ts"
)

# Check if git is available
if ! command -v git &> /dev/null; then
  echo "❌ git is not installed. Cannot rollback without git."
  exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Not in a git repository. Cannot rollback."
  exit 1
fi

# Stash any uncommitted changes
echo "📦 Stashing uncommitted changes..."
git stash push -m "Pre-rollback stash" || true

# Revert each file to previous commit
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "⏮️  Reverting $file..."
    git checkout HEAD~1 -- "$file" 2>/dev/null || {
      echo "⚠️  Could not revert $file with git. Using manual approach..."
      # If git revert fails, we'll need manual intervention
      echo "   Please manually revert $file to its previous version"
    }
  fi
done

echo ""
echo "✅ Code rollback completed!"
echo ""
echo "📝 Next steps:"
echo "1. Run: git status (to see what's been reverted)"
echo "2. Run the SQL rollback migration on Supabase:"
echo "   - supabase migration up --method up"
echo "   - Or manually execute: supabase/migrations/010_rollback_session_locks.sql"
echo "3. Delete the migration files:"
echo "   - rm supabase/migrations/009_add_session_locks_table.sql"
echo "   - rm supabase/migrations/010_rollback_session_locks.sql"
echo "4. Commit the changes:"
echo "   - git add ."
echo "   - git commit -m 'revert: disable race condition prevention feature'"
echo ""
echo "⚠️  WARNING: If you had stashed changes, restore them with:"
echo "   - git stash pop"
