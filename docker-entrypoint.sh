#!/bin/sh
set -e

echo "================================================"
echo "   مشويات بسوني - Mashweyat Basiony POS System"
echo "================================================"
echo ""

echo "⏳ Pushing database schema..."
npx prisma db push --skip-generate
echo "✅ Database schema is up to date"
echo ""

echo "🌱 Seeding database..."
npx prisma db seed 2>/dev/null || echo "ℹ️  Seed skipped (already applied or no changes)"
echo ""

echo "🚀 Starting Mashweyat Basiony POS on port ${PORT:-3000}..."
exec npm start
