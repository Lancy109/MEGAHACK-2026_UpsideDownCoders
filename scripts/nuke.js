
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function nuke() {
  console.log('🚀 Starting Database Nuke...');

  try {
    // Order matters due to foreign keys
    console.log('🗑️ Deleting Tasks...');
    await prisma.task.deleteMany();

    console.log('🗑️ Deleting SOS Alerts...');
    await prisma.sosAlert.deleteMany();

    console.log('🗑️ Deleting Users...');
    await prisma.user.deleteMany();

    console.log('✅ Database cleared successfully!');
  } catch (error) {
    console.error('❌ Error nuking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

nuke();
