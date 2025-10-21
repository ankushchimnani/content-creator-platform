#!/bin/bash

# Production Database Seeding Script
# This script should be run on the production server

echo "🌱 Seeding production database..."

# Navigate to backend directory
cd apps/backend

# Run the superadmin seed
echo "Creating superadmin user..."
npx tsx src/seed-super-admin.ts

# Run the guidelines seed
echo "Creating guidelines templates..."
npx tsx src/seed-comprehensive-guidelines.ts

echo "✅ Production database seeding completed!"
echo ""
echo "🔐 Superadmin credentials:"
echo "   Email: superadmin@masaischool.com"
echo "   Password: SuperAdmin123!"
echo ""
echo "📋 Guidelines have been created for all content types"
