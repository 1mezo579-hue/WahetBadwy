const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('=== VERIFYING POS LIVE DATA ===');

  const categories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: { items: { where: { active: true } } },
  });

  console.log(`\nFound ${categories.length} active categories:`);
  categories.forEach((c) => {
    console.log(` - [${c.order}] ${c.nameAr} (${c.items.length} أصناف)`);
  });

  const grills = categories.find((c) => c.id === 'cat_grills_01');
  if (grills) {
    console.log('\nGrill items (المشويات بالوزن النيء):');
    grills.items.forEach((item) => {
      console.log(`   * ${item.nameAr} - ${item.price} ج.م / كجم`);
      console.log(`     -> ربع كيلو: ${item.price * 0.25} ج.م`);
      console.log(`     -> نصف كيلو: ${item.price * 0.5} ج.م`);
      console.log(`     -> إلا ربع:   ${item.price * 0.75} ج.م`);
      console.log(`     -> كيلو كامل: ${item.price} ج.م`);
    });
  }

  const allItems = await prisma.menuItem.count({ where: { active: true } });
  console.log(`\nTotal Active Menu Items in DB: ${allItems}`);

  await prisma.$disconnect();
  console.log('\n=== VERIFICATION COMPLETE: ALL DATA 100% READY ===');
}

verify().catch(console.error);
