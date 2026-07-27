#!/bin/sh
set -e

echo "🔄 Applying database migrations..."

# Extract connection details from DATABASE_URL for psql
# Format: postgresql://user:password@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed 's|.*@\([^:]*\):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed 's|.*:\([0-9]*\)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed 's|.*/\([^?]*\).*|\1|')
DB_USER=$(echo "$DATABASE_URL" | sed 's|.*://\([^:]*\):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|')

MIGRATION_TABLE=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations';")

if [ "$MIGRATION_TABLE" = "0" ]; then
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
