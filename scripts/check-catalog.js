const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        items: true,
      },
      orderBy: { order: 'asc' },
    });
    console.log('Categories count:', categories.length);
    categories.forEach((c) => {
      console.log(`[Category: ${c.nameAr} (${c.name})] active: ${c.active}, items: ${c.items.length}`);
      c.items.slice(0, 5).forEach((item) => {
        console.log(`   - ${item.nameAr}: ${item.price} EGP (active: ${item.active})`);
      });
      if (c.items.length > 5) {
        console.log(`   ... and ${c.items.length - 5} more`);
      }
    });

    const totalItems = await prisma.menuItem.count();
    console.log('\nTotal Menu Items in DB:', totalItems);
  } catch (err) {
    console.error('Error checking catalog:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
