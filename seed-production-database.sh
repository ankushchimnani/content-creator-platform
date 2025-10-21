#!/bin/bash

# Production Database Seeding Script
# Run this script on the production server to seed the database

set -e  # Exit on any error

echo "🌱 Starting production database seeding..."

# Check if we're in the right directory
if [ ! -f "apps/backend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: content_validation_platform/"
    exit 1
fi

# Navigate to backend directory
cd apps/backend

echo "📦 Installing dependencies..."
npm install

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🗄️ Running database migrations..."
npx prisma migrate deploy

echo "👤 Creating superadmin user..."
npx tsx src/seed-super-admin.ts

echo "📋 Creating guidelines templates..."
npx tsx src/seed-comprehensive-guidelines.ts

echo "✅ Production database seeding completed successfully!"
echo ""
echo "🔐 Superadmin credentials:"
echo "   Email: superadmin@masaischool.com"
echo "   Password: SuperAdmin123!"
echo ""
echo "📋 Guidelines have been created for all content types"
echo "🎉 You can now log in with the superadmin credentials!"
