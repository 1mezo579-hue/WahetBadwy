const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initAuditTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        order_id TEXT,
        user_id TEXT,
        user_name TEXT,
        user_role TEXT,
        details JSONB DEFAULT '{}',
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('1. Created audit_logs table');
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_audit_logs_order_id ON audit_logs(order_id)`);
    console.log('2. Created index idx_audit_logs_order_id');
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
    console.log('3. Created index idx_audit_logs_action');
    console.log('Audit logs table initialized successfully.');
  } catch (e) {
    console.error('Error initializing audit_logs table:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

initAuditTable();
