#!/bin/sh
set -e

echo "🔄 Applying database migrations..."

# If the DB already has schema but no migration history (P3005), baseline all
# known migrations so prisma migrate deploy does not try to re-run them.
MIGRATION_TABLE_EXISTS=$(npx prisma db execute --stdin <<'SQL'
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = '_prisma_migrations';
SQL
)

if echo "$MIGRATION_TABLE_EXISTS" | grep -q '^0$\|^(0)\| 0$'; then
  echo "⚠️  No migration history found — baselining all migrations..."
  npx prisma migrate resolve --applied 20260101000000_init
  npx prisma migrate resolve --applied 20260101000001_add_personality_and_chat_mode
  npx prisma migrate resolve --applied 20260101000002_add_message_reactions_and_replies
  npx prisma migrate resolve --applied 20260101000003_add_sound_edited_and_indexes
  npx prisma migrate resolve --applied 20260101000004_add_settings
  npx prisma migrate resolve --applied 20260201000000_add_web_search_and_generation
  echo "✅ Baseline complete."
fi

npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "🚀 Starting maxAI backend..."
exec node dist/index.js
