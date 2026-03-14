import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const dbUrl = process.env.DATABASE_URL;
const connectionUrl = dbUrl ? (dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'connection_limit=2') : undefined;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: connectionUrl
    }
  }
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
