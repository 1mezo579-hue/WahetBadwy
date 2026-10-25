const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function inspect() {
  await prisma.$connect();
  
  const categories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: {
        select: { items: true }
      }
    }
  });

  const allItems = await prisma.menuItem.findMany({
    orderBy: { nameAr: 'asc' },
    include: {
      category: true,
      _count: {
        select: { orderItems: true }
      }
    }
  });

  console.log(`=== TOTAL CATEGORIES IN DB: ${categories.length} ===`);
  categories.forEach(c => {
    console.log(`- [${c.id}] "${c.nameAr}" ("${c.name}") | Items: ${c._count.items} | Order: ${c.order}`);
  });

  console.log(`\n=== TOTAL MENU ITEMS IN DB: ${allItems.length} ===`);
  const activeItems = allItems.filter(i => i.active);
  const inactiveItems = allItems.filter(i => !i.active);
  console.log(`Active Items: ${activeItems.length}`);
  console.log(`Inactive Items: ${inactiveItems.length}`);

  // Save full JSON backup before anything
  const backup = {
    timestamp: new Date().toISOString(),
    categories,
    allItems
  };
  fs.writeFileSync('scripts/catalog-backup-pre-clean.json', JSON.stringify(backup, null, 2), 'utf8');
  console.log('\n✓ Full backup saved to scripts/catalog-backup-pre-clean.json');

  console.log('\n=== LIST OF ALL MENU ITEMS IN DB ===');
  allItems.forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.id}] "${item.nameAr}" | Price: ${item.price} EGP | Category: ${item.category?.nameAr || item.categoryId} | Active: ${item.active} | In Orders: ${item._count.orderItems}`);
  });

  await prisma.$disconnect();
}

inspect().catch(e => {
  console.error(e);
  process.exit(1);
});
