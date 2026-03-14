const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  console.log('USER_COUNT=' + count);
  
  const users = await prisma.user.findMany();
  console.log('USERS:', users.map(u => ({ id: u.id, name: u.name, role: u.role })));
  
}

main().catch(console.error).finally(() => prisma.$disconnect());
