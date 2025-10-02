import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding guidelines templates...');

  // Find the super admin user
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });

  if (!superAdmin) {
    console.error('Super admin user not found. Please run seed-super-admin.ts first.');
    return;
  }

  // Default guidelines for each content type
  const defaultGuidelines = [
    {
      name: 'Assignment Guidelines v1',
      contentType: 'ASSIGNMENT' as const,
      guidelines: `Focus on practical application and problem-solving skills. Ensure assignments are challenging but achievable within the given timeframe. Include clear instructions, examples, and evaluation criteria. Encourage critical thinking and real-world application of concepts.`,
    },
    {
      name: 'Lecture Note Guidelines v1', 
      contentType: 'LECTURE_NOTE' as const,
      guidelines: `Structure content with clear learning objectives, engaging introductions, and practical examples. Use progressive difficulty and include interactive elements. Ensure content is comprehensive yet digestible, with proper headings and visual aids where appropriate.`,
    },
    {
      name: 'Pre-Read Guidelines v1',
      contentType: 'PRE_READ' as const,
      guidelines: `Provide foundational knowledge that prepares students for upcoming lectures. Keep content concise and focused on essential concepts. Include key definitions, basic examples, and preparatory exercises. Ensure smooth transition to main lecture content.`,
    },
  ];

  for (const guideline of defaultGuidelines) {
    // Check if guidelines already exist for this content type
    const existing = await prisma.guidelinesTemplate.findFirst({
      where: { 
        contentType: guideline.contentType,
        isActive: true 
      }
    });

    if (!existing) {
      await prisma.guidelinesTemplate.create({
        data: {
          ...guideline,
          createdById: superAdmin.id,
          isActive: true,
        }
      });
      console.log(`Created guidelines template: ${guideline.name}`);
    } else {
      console.log(`Guidelines template already exists for ${guideline.contentType}`);
    }
  }

  console.log('Guidelines seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
