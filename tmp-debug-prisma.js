const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing Prisma connection and ChatMessage model...');
    // We check if the model exists in the generated client
    if (!prisma.chatMessage) {
      console.error('ERROR: prisma.chatMessage is undefined. The Prisma client has not been generated with the ChatMessage model.');
      process.exit(1);
    }
    
    const count = await prisma.chatMessage.count();
    console.log(`Successfully connected. Current ChatMessage count: ${count}`);
    
    // Check fields of the model
    const sample = await prisma.chatMessage.findFirst();
    if (sample) {
      console.log('--- ChatMessage RECORD KEYS ---');
      console.log(JSON.stringify(Object.keys(sample), null, 2));
      console.log('-------------------------------');
      if ('readBy' in sample) {
        console.log('SUCCESS: readBy field exists in database.');
      } else {
        console.error('ERROR: readBy field DOES NOT exist in database result.');
      }
    } else {
      console.log('No messages found to check fields.');
    }
  } catch (err) {
    console.error('FAILED to query ChatMessage:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
