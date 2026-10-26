const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const res = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    console.log('Existing DB tables:', res.map(r => r.table_name));
  } catch (e) {
    console.error('DB query error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
