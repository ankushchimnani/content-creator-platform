import { PrismaClient, Role, ContentType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminEmail = 'admin@example.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  let adminUser;
  
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    adminUser = await prisma.user.create({ 
      data: { 
        email: adminEmail, 
        name: 'Admin User', 
        role: Role.ADMIN, 
        passwordHash 
      } 
    });
    console.log('Seeded admin user: admin@example.com / Admin@123');
  } else {
    adminUser = existingAdmin;
    console.log('Admin user already exists');
  }

  // Create a second admin for testing
  const admin2Email = 'admin2@example.com';
  const existingAdmin2 = await prisma.user.findUnique({ where: { email: admin2Email } });
  let admin2User;
  
  if (!existingAdmin2) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    admin2User = await prisma.user.create({ 
      data: { 
        email: admin2Email, 
        name: 'Admin Two', 
        role: Role.ADMIN, 
        passwordHash 
      } 
    });
    console.log('Seeded second admin user: admin2@example.com / Admin@123');
  } else {
    admin2User = existingAdmin2;
    console.log('Second admin user already exists');
  }

  // Create content creator users
  const creators = [
    { email: 'creator1@example.com', name: 'John Creator', assignedAdminId: adminUser.id },
    { email: 'creator2@example.com', name: 'Jane Writer', assignedAdminId: adminUser.id },
    { email: 'creator3@example.com', name: 'Bob Author', assignedAdminId: admin2User.id },
  ];

  for (const creator of creators) {
    const existing = await prisma.user.findUnique({ where: { email: creator.email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash('Creator@123', 10);
      await prisma.user.create({
        data: {
          email: creator.email,
          name: creator.name,
          role: Role.CREATOR,
          passwordHash,
          assignedAdminId: creator.assignedAdminId,
        }
      });
      console.log(`Seeded creator: ${creator.email} / Creator@123 (assigned to ${creator.assignedAdminId === adminUser.id ? 'Admin User' : 'Admin Two'})`);
    } else {
      console.log(`Creator ${creator.email} already exists`);
    }
  }

  // Create superadmin user
  const superadminEmail = 'ankush@masaischool.com';
  const existingSuperadmin = await prisma.user.findUnique({ where: { email: superadminEmail } });
  
  if (!existingSuperadmin) {
    const passwordHash = await bcrypt.hash('ankush123', 10);
    await prisma.user.create({ 
      data: { 
        email: superadminEmail, 
        name: 'Ankush Superadmin', 
        role: Role.SUPERADMIN, 
        passwordHash 
      } 
    });
    console.log('Seeded superadmin user: ankush@masaischool.com / ankush123');
  } else {
    console.log('Superadmin user already exists');
  }

  // Create payment configurations
  const paymentConfigs = [
    { contentType: ContentType.PRE_READ, amountPerUnit: 2500.0 }, // ₹2500
    { contentType: ContentType.ASSIGNMENT, amountPerUnit: 3750.0 }, // ₹3750
    { contentType: ContentType.LECTURE_NOTE, amountPerUnit: 5000.0 } // ₹5000
  ];

  for (const config of paymentConfigs) {
    const existing = await prisma.paymentConfiguration.findUnique({ 
      where: { contentType: config.contentType } 
    });
    if (!existing) {
      await prisma.paymentConfiguration.create({
        data: config
      });
      console.log(`Seeded payment config: ${config.contentType} - $${config.amountPerUnit}`);
    } else {
      console.log(`Payment config for ${config.contentType} already exists`);
    }
  }

  console.log('\n🎯 Seed completed!');
  console.log('👤 Admin Users:');
  console.log('   - admin@example.com / Admin@123');
  console.log('   - admin2@example.com / Admin@123');
  console.log('🔑 Superadmin User:');
  console.log('   - ankush@masaischool.com / ankush123');
  console.log('✍️  Creator Users:');
  console.log('   - creator1@example.com / Creator@123');
  console.log('   - creator2@example.com / Creator@123');
  console.log('   - creator3@example.com / Creator@123');
  console.log('💰 Payment Configurations:');
  console.log('   - PRE_READ: ₹2,500.00 per approved content');
  console.log('   - ASSIGNMENT: ₹3,750.00 per approved content');
  console.log('   - LECTURE_NOTE: ₹5,000.00 per approved content');
}

main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());


