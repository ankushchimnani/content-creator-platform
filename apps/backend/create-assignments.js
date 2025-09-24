const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSampleAssignments() {
  try {
    console.log('🚀 Creating sample assignments...\n');

    const admin = await prisma.user.findUnique({
      where: { email: 'admin@masaischool.com' }
    });

    const creator = await prisma.user.findUnique({
      where: { email: 'creator@masaischool.com' }
    });

    if (!admin || !creator) {
      console.error('❌ Users not found. Please run the onboard-users script first.');
      return;
    }

    console.log(`✅ Found admin: ${admin.name} (${admin.email})`);
    console.log(`✅ Found creator: ${creator.name} (${creator.email})`);

    const sampleAssignments = [
      {
        topic: 'JS Objects',
        prerequisiteTopics: ['JavaScript Basics', 'Variables'],
        guidelines: 'Create comprehensive content about JavaScript objects including properties, methods, and prototypes.',
        contentType: 'LECTURE_NOTE',
        dueDate: new Date('2025-09-25').toISOString(),
        assignedToId: creator.id,
        assignedById: admin.id,
        status: 'ASSIGNED'
      },
      {
        topic: 'Java Methods',
        prerequisiteTopics: ['Java Basics', 'Classes'],
        guidelines: 'Explain Java methods including parameters, return types, and method overloading.',
        contentType: 'ASSIGNMENT',
        difficulty: 'MEDIUM',
        dueDate: new Date('2025-09-26').toISOString(),
        assignedToId: creator.id,
        assignedById: admin.id,
        status: 'IN_PROGRESS'
      },
      {
        topic: 'Python Loops',
        prerequisiteTopics: ['Python Basics', 'Conditionals'],
        guidelines: 'Cover for loops, while loops, and loop control statements in Python.',
        contentType: 'PRE_READ',
        dueDate: new Date('2025-09-24').toISOString(),
        assignedToId: creator.id,
        assignedById: admin.id,
        status: 'COMPLETED'
      },
      {
        topic: 'HTML Basics',
        prerequisiteTopics: ['Web Development Introduction'],
        guidelines: 'Create content covering HTML structure, tags, and semantic elements.',
        contentType: 'LECTURE_NOTE',
        dueDate: new Date('2025-09-23').toISOString(),
        assignedToId: creator.id,
        assignedById: admin.id,
        status: 'COMPLETED'
      }
    ];

    for (const assignmentData of sampleAssignments) {
      try {
        const assignment = await prisma.contentAssignment.create({
          data: assignmentData
        });
        console.log(`✅ Created assignment: ${assignment.topic} (${assignment.status})`);
      } catch (error) {
        console.error(`❌ Failed to create assignment ${assignmentData.topic}:`, error.message);
      }
    }

    console.log('\n🎯 Sample assignments created successfully!');
  } catch (error) {
    console.error('❌ Error creating sample assignments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleAssignments();
