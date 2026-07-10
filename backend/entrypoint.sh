#!/bin/sh
set -e

echo "🔄 Syncing database schema..."
# This repo is migration-less: the schema is the source of truth. `db push`
# creates the tables on a fresh database and applies additive schema changes
# (such as the `personality` column) idempotently and without data loss.
npx prisma db push --schema=./prisma/schema.prisma --skip-generate

echo "🚀 Starting maxAI backend..."
exec node dist/index.js
