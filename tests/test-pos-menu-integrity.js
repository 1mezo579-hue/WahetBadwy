const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runIntegrityTest() {
  console.log("=== RUNNING POS MENU INTEGRITY & DYNAMIC CONNECTION TEST ===");

  await prisma.$connect();

  // 1. Fetch categories as POS does
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  });

  console.log(`\n[Check 1] Categories in POS (Total: ${categories.length}):`);
  const catNames = categories.map(c => c.nameAr.trim());
  console.log(catNames.join(" | "));

  const requiredCategories = [
    "فراخ مشوية عالفحم",
    "ساندوتشات سوري عالفحم",
    "المشويات",
    "ساندوتشات على الفحم",
    "الساندوتشات الفرنساوي",
    "صواني بسيوني الخاصة",
    "صواني العيلة",
    "وجبات العمالة",
    "حلويات اللحمة (السقط)",
    "العروض الحصرية",
    "الإضافات والمشروبات",
  ];

  for (const rc of requiredCategories) {
    if (!catNames.includes(rc)) {
      throw new Error(`Missing expected category in DB: "${rc}"`);
    }
  }
  console.log("✓ All 11 categories including the two new categories are present in DB!");

  // 2. Fetch active menu items as POS does
  const menuItems = await prisma.menuItem.findMany({
    where: { active: true },
    orderBy: { nameAr: "asc" },
    include: { category: true }
  });

  console.log(`\n[Check 2] Active Menu Items in POS (Total: ${menuItems.length}):`);
  if (menuItems.length !== 64) {
    throw new Error(`Expected exactly 64 active menu items, found ${menuItems.length}!`);
  }
  console.log("✓ Exactly 64 active menu items found in DB.");

  // 3. Verify items under the two new categories
  const syrianItems = menuItems.filter(i => i.category?.nameAr.trim() === "ساندوتشات سوري عالفحم");
  console.log(`\n[Check 3] Syrian Charcoal Sandwiches (Count: ${syrianItems.length}):`);
  syrianItems.forEach(i => console.log(`  - ${i.nameAr} (${i.price} EGP)`));
  if (syrianItems.length !== 5) {
    throw new Error(`Expected 5 Syrian sandwich items, found ${syrianItems.length}`);
  }

  const chickenItems = menuItems.filter(i => i.category?.nameAr.trim() === "فراخ مشوية عالفحم");
  console.log(`\n[Check 4] Charcoal Grilled Chicken (Count: ${chickenItems.length}):`);
  chickenItems.forEach(i => console.log(`  - ${i.nameAr} (${i.price} EGP)`));
  if (chickenItems.length !== 3) {
    throw new Error(`Expected 3 Chicken items, found ${chickenItems.length}`);
  }

  // 4. Verify no old/demo items (e.g. shisha, mock burgers, demo coffee)
  console.log("\n[Check 5] Verifying absence of legacy demo items...");
  const forbiddenKeywords = ["شيشة", "معسل", "برجر تجريبي", "بيتزا تجريبية", "قهوة فرنساوي قديمة"];
  for (const item of menuItems) {
    for (const kw of forbiddenKeywords) {
      if (item.nameAr.includes(kw)) {
        throw new Error(`Found unauthorized legacy demo item: ${item.nameAr}`);
      }
    }
  }
  console.log("✓ Zero unauthorized demo items detected.");

  // 5. Verify Real Drinks are present
  const pepsi = menuItems.find(i => i.nameAr.includes("بيبسي"));
  if (!pepsi) {
    throw new Error("Expected legitimate Pepsi drink item to be present.");
  }
  console.log(`✓ Legitimate drinks present: ${pepsi.nameAr} (${pepsi.price} EGP)`);

  // 6. Test Dynamic Reflectivity (Simulate Admin creating an item & verifying it reflects in POS data)
  console.log("\n[Check 6] Testing real-time reflectiveness from Admin to POS...");
  const testCat = categories[0];
  const testItem = await prisma.menuItem.create({
    data: {
      name: "صنف تجربة التحديث التلقائي",
      nameAr: "صنف تجربة التحديث التلقائي",
      price: 999,
      categoryId: testCat.id,
      active: true,
    }
  });

  const posItemsWithTest = await prisma.menuItem.findMany({
    where: { active: true },
  });
  const found = posItemsWithTest.find(i => i.id === testItem.id);
  if (!found || found.price !== 999) {
    throw new Error("Real-time reflectivity test failed!");
  }
  console.log(`✓ Added item dynamically reflected in POS query: ${found.nameAr}`);

  // Clean up test item
  await prisma.menuItem.delete({ where: { id: testItem.id } });
  const restoredCount = await prisma.menuItem.count({ where: { active: true } });
  console.log(`✓ Cleaned up test item. Active items restored to: ${restoredCount}`);
  if (restoredCount !== 64) {
    throw new Error(`Count after cleanup should be 64, got ${restoredCount}`);
  }

  console.log("\n=======================================================");
  console.log("ALL 6 POS INTEGRITY & DYNAMIC CONNECTION CHECKS PASSED ✓");
  console.log("=======================================================");

  await prisma.$disconnect();
}

runIntegrityTest().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
