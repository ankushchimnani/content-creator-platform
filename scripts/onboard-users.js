#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/contentdb';

// Sample users data - modify this array with your actual users
const USERS_TO_CREATE = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'ADMIN'
  },
  {
    email: 'creator1@example.com',
    password: 'creator123',
    name: 'Creator One',
    role: 'CREATOR'
  },
  {
    email: 'creator2@example.com',
    password: 'creator123',
    name: 'Creator Two',
    role: 'CREATOR'
  },
  {
    email: 'admin2@example.com',
    password: 'admin123',
    name: 'Admin Two',
    role: 'ADMIN'
  }
];

// Admin assignments for creators (optional)
const CREATOR_ADMIN_ASSIGNMENTS = {
  'creator1@example.com': 'admin@example.com',  // creator1 assigned to admin
  'creator2@example.com': 'admin2@example.com'  // creator2 assigned to admin2
};

async function createUsers() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });

  try {
    console.log('🚀 Starting user onboarding process...\n');

    // Create a map of admin emails to IDs for creator assignments
    const adminMap = new Map();

    for (const userData of USERS_TO_CREATE) {
      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email }
        });

        if (existingUser) {
          console.log(`⚠️  User ${userData.email} already exists, skipping...`);
          if (userData.role === 'ADMIN') {
            adminMap.set(userData.email, existingUser.id);
          }
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        // Create user
        const user = await prisma.user.create({
          data: {
            email: userData.email,
            password: hashedPassword,
            name: userData.name,
            role: userData.role
          }
        });

        console.log(`✅ Created ${userData.role.toLowerCase()}: ${userData.email} (ID: ${user.id})`);

        // Store admin ID for creator assignments
        if (userData.role === 'ADMIN') {
          adminMap.set(userData.email, user.id);
        }

      } catch (error) {
        console.error(`❌ Failed to create user ${userData.email}:`, error.message);
      }
    }

    // Assign creators to admins
    console.log('\n🔗 Assigning creators to admins...');
    
    for (const [creatorEmail, adminEmail] of Object.entries(CREATOR_ADMIN_ASSIGNMENTS)) {
      try {
        const adminId = adminMap.get(adminEmail);
        if (!adminId) {
          console.log(`⚠️  Admin ${adminEmail} not found, skipping assignment for ${creatorEmail}`);
          continue;
        }

        const creator = await prisma.user.findUnique({
          where: { email: creatorEmail }
        });

        if (!creator) {
          console.log(`⚠️  Creator ${creatorEmail} not found, skipping assignment`);
          continue;
        }

        // Update creator with admin assignment
        await prisma.user.update({
          where: { id: creator.id },
          data: { assignedAdminId: adminId }
        });

        console.log(`✅ Assigned ${creatorEmail} to ${adminEmail}`);

      } catch (error) {
        console.error(`❌ Failed to assign ${creatorEmail} to ${adminEmail}:`, error.message);
      }
    }

    console.log('\n🎉 User onboarding completed!');
    console.log('\n📋 Summary:');
    console.log('Users created:');
    
    const allUsers = await prisma.user.findMany({
      include: {
        assignedAdmin: {
          select: { name: true, email: true }
        }
      }
    });

    allUsers.forEach(user => {
      const adminInfo = user.assignedAdmin ? ` (assigned to ${user.assignedAdmin.name})` : '';
      console.log(`  - ${user.email} (${user.role})${adminInfo}`);
    });

  } catch (error) {
    console.error('❌ Fatal error during onboarding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to validate environment
function validateEnvironment() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.log('Set it like: DATABASE_URL="postgresql://user:password@localhost:5432/contentdb"');
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  validateEnvironment();
  createUsers().catch(console.error);
}

module.exports = { createUsers, USERS_TO_CREATE };
