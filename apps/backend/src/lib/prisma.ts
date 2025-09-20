import { PrismaClient } from '@prisma/client';

// Create a single shared Prisma client instance
export const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'minimal',
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
