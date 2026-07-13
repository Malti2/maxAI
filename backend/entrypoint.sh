#!/bin/sh
set -e

echo "🔄 Applying database migrations..."
# The migration history in prisma/migrations is the source of truth. On a
# fresh database this creates every table; on an existing one it applies only
# the migrations that have not run yet. This is safe and non-destructive.
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "🚀 Starting maxAI backend..."
exec node dist/index.js
