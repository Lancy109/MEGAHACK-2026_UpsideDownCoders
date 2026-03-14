const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing Prisma CREATE with readBy...');
    
    const newMsg = await prisma.chatMessage.create({
      data: {
        sosId: 'cmmpoq8lx0001l104wiisqzkm',
        senderId: 'debug_user',
        senderName: 'Debug Bot',
        senderRole: 'SYSTEM',
        message: 'Test message from debug script',
        readBy: ['debug_user']
      }
    });
    console.log('SUCCESS: create worked with readBy.', newMsg.id);
  } catch (err) {
    console.error('FAILED: create failed with readBy error message follows:');
    console.error(err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
