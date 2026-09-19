import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const tables = await prisma.$queryRaw`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
`;
console.log(JSON.stringify(tables));
await prisma.$disconnect();
