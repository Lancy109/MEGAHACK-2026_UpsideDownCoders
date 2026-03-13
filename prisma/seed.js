const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'victim@test.com' },
    update: {},
    create: {
      name: 'Ramesh Kumar',
      phone: '+919999999991',
      email: 'victim@test.com',
      role: 'VICTIM',
      lat: 19.2183,
      lng: 72.9781,
    },
  });
  await prisma.user.upsert({
    where: { email: 'volunteer@test.com' },
    update: {},
    create: {
      name: 'Priya Sharma',
      phone: '+919999999992',
      email: 'volunteer@test.com',
      role: 'VOLUNTEER',
      lat: 19.2283,
      lng: 72.9881,
    },
  });
  await prisma.user.upsert({
    where: { email: 'ngo@test.com' },
    update: {},
    create: {
      name: 'NDMA Relief',
      phone: '+919999999993',
      email: 'ngo@test.com',
      role: 'NGO',
    },
  });
  console.log('Seed complete');
}

main().catch(console.error).finally(() => prisma.$disconnect());
