
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function nuke() {
  console.log('🚀 Starting Database Nuke...');

  try {
    // Order matters due to foreign keys (Children first)
    console.log('🗑️ Deleting Volunteer Ratings...');
    await prisma.volunteerRating.deleteMany();

    console.log('🗑️ Deleting Tasks...');
    await prisma.task.deleteMany();

    console.log('🗑️ Deleting Chat Messages...');
    await prisma.chatMessage.deleteMany();

    console.log('🗑️ Deleting SOS Events...');
    await prisma.sosEvent.deleteMany();

    console.log('🗑️ Deleting SOS Alerts...');
    await prisma.sosAlert.deleteMany();

    console.log('🗑️ Deleting Resources...');
    await prisma.resource.deleteMany();

    console.log('🗑️ Deleting Map Resources...');
    await prisma.mapResource.deleteMany();

    console.log('🗑️ Deleting Missing Persons...');
    await prisma.missingPerson.deleteMany();

    console.log('🗑️ Deleting Disaster Alerts...');
    await prisma.disasterAlert.deleteMany();

    console.log('🗑️ Deleting Broadcast Messages...');
    await prisma.broadcastMessage.deleteMany();

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
