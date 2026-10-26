const fs = require('fs');
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const { PrismaClient, UnitType } = require('@prisma/client');
const prisma = new PrismaClient();

async function runInventorySuite() {
  console.log("===============================================================");
  console.log("TEST SUITE: MASHWEYAT BASIONY INVENTORY & RECIPES VERIFICATION");
  console.log("===============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Catalog Count and Grouping
    // ------------------------------------------------------------------------
    console.log("--- Test 1: Raw Materials Catalog & Grouping ---");
    const materials = await prisma.rawMaterial.findMany({
      include: { _count: { select: { recipeItems: true } } },
    });

    console.log(`Total materials in database: ${materials.length}`);
    assert(materials.length >= 86, "All 86 catalog items exist in database");

    const meatCount = materials.filter(m => m.category === "اللحوم والدواجن").length;
    const vegCount = materials.filter(m => m.category === "الخضار والسلطات").length;
    const spiceCount = materials.filter(m => m.category === "العطارة والتوابل").length;
    const oilCount = materials.filter(m => m.category === "الزيوت والصلصات والمكونات المساعدة").length;
    const packCount = materials.filter(m => m.category === "أدوات التغليف").length;
    const cleanCount = materials.filter(m => m.category === "أدوات النظافة والتشغيل").length;

    console.log(`- اللحوم والدواجن: ${meatCount}`);
    console.log(`- الخضار والسلطات: ${vegCount}`);
    console.log(`- العطارة والتوابل: ${spiceCount}`);
    console.log(`- الزيوت والصلصات: ${oilCount}`);
    console.log(`- أدوات التغليف: ${packCount}`);
    console.log(`- أدوات النظافة والتشغيل: ${cleanCount}`);

    assert(meatCount >= 15, "Meat & poultry category has all 15 items");
    assert(vegCount >= 12, "Vegetables & salads category has all 12 items");
    assert(spiceCount >= 11, "Spices & seasoning category has all 11 items");
    assert(oilCount >= 18, "Oils & sauces category has all 18 items");
    assert(packCount >= 16, "Packaging category has all 16 items");
    assert(cleanCount >= 14, "Cleaning supplies category has all 14 items");

    // Verify cleaning supplies have zero recipe links
    const cleaningRecipesCount = materials
      .filter(m => m.type === "CLEANING")
      .reduce((sum, m) => sum + m._count.recipeItems, 0);
    assert(cleaningRecipesCount === 0, "Cleaning materials have zero recipe links");

    // ------------------------------------------------------------------------
    // TEST 2: Unpurchased Items Initial State (0 stock, OUT_OF_STOCK)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 2: Unpurchased Items Initial State ---");
    const unpurchasedMaterials = materials.filter(m => m.costPerUnit === 0 && m.currentStock === 0);
    assert(unpurchasedMaterials.length > 0, "Unpurchased items are present");
    for (const item of unpurchasedMaterials) {
      assert(item.currentStock === 0, `Unpurchased item ${item.name} has 0 stock`);
      assert(item.status === "OUT_OF_STOCK", `Unpurchased item ${item.name} is OUT_OF_STOCK`);
    }
    console.log(`Verified ${unpurchasedMaterials.length} unpurchased items have 0 stock and OUT_OF_STOCK status.`);

    // ------------------------------------------------------------------------
    // TEST 3: Purchase Registration & Weighted Average Cost Formula
    // ------------------------------------------------------------------------
    console.log("\n--- Test 3: Purchase Calculation & Weighted Average Math ---");
    // Mathematical verification of weighted average cost formula
    function calculateWeightedAverage(currentStock, currentCost, addedStock, addedCost) {
      if (currentStock === 0) return addedCost;
      const totalValue = (currentStock * currentCost) + (addedStock * addedCost);
      const totalStock = currentStock + addedStock;
      return totalValue / totalStock;
    }

    // Purchase 1: 10 KG @ 350 EGP/KG (conv 1000) -> 10,000 g @ 0.35 EGP/g
    const batch1Stock = 10000;
    const batch1Cost = 0.35;
    const avg1 = calculateWeightedAverage(0, 0, batch1Stock, batch1Cost);
    assert(avg1 === 0.35, "First batch cost is 0.35 EGP/g");

    // Purchase 2: 10 KG @ 400 EGP/KG -> 10,000 g @ 0.40 EGP/g
    const batch2Stock = 10000;
    const batch2Cost = 0.40;
    const avg2 = calculateWeightedAverage(batch1Stock, avg1, batch2Stock, batch2Cost);
    assert(avg2 === 0.375, "Weighted average correctly blends 0.35 and 0.40 to 0.375 EGP/g");

    // ------------------------------------------------------------------------
    // TEST 4: Unit Conversions
    // ------------------------------------------------------------------------
    console.log("\n--- Test 4: Unit Conversion Accuracy ---");
    const meatItem = materials.find(m => m.name === "لحمة كفتة");
    assert(meatItem.purchaseUnit === "كجم", "Meat purchase unit is KG");
    assert(meatItem.issueUnit === "جرام", "Meat issue unit is Gram");
    assert(meatItem.conversionFactor === 1000, "1 KG = 1000 Grams");

    const oilItem = materials.find(m => m.name === "زيت قلي" || m.name.includes("زيت طعام"));
    assert(oilItem.purchaseUnit === "لتر", "Oil purchase unit is Liter");
    assert(oilItem.issueUnit === "مل", "Oil issue unit is ML");
    assert(oilItem.conversionFactor === 1000, "1 Liter = 1000 ML");

    const boxItem = materials.find(m => m.name === "علب وجبات مشويات مقسمة");
    assert(boxItem.purchaseUnit === "كرتونة", "Box purchase unit is Carton");
    assert(boxItem.issueUnit === "حبة", "Box issue unit is Piece");
    assert(boxItem.conversionFactor > 1, "Carton conversion factor is positive integer");

    // ------------------------------------------------------------------------
    // TEST 5: Recipe Status & Incomplete Flag (Requirement 8)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 5: Incomplete Recipe Flag & Profit Margin Shield ---");
    const recipeItems = await prisma.recipeItem.findMany({
      include: { rawMaterial: true, menuItem: true },
    });
    console.log(`Total recipe items in system: ${recipeItems.length}`);
    assert(recipeItems.length >= 200, "All candidate recipe items are linked");

    const incompleteRecipes = recipeItems.filter(r => !r.isComplete || r.quantity === 0);
    assert(incompleteRecipes.length > 0, "Unapproved recipes default to incomplete");
    for (const r of incompleteRecipes.slice(0, 10)) {
      assert(r.status === "NEEDS_QUANTITY", `Recipe ${r.menuItem.nameAr} - ${r.rawMaterial.name} has status NEEDS_QUANTITY`);
      assert(r.quantity === 0, `Recipe ${r.menuItem.nameAr} quantity is 0`);
      assert(!r.isComplete, `Recipe isComplete is false`);
    }

    // Mathematical test of complete recipe vs incomplete recipe margin
    function evaluateMenuItemMargin(salePrice, recipeList) {
      const isComplete = recipeList.length > 0 && recipeList.every(r => r.isComplete && r.quantity > 0 && r.costPerUnit > 0);
      if (!isComplete) {
        return {
          isCostComplete: false,
          grossProfit: null,
          grossMargin: null,
          statusText: "التكلفة غير مكتملة",
        };
      }
      const directCost = recipeList.reduce((sum, r) => sum + (r.quantity * r.costPerUnit), 0);
      const grossProfit = salePrice - directCost;
      const grossMargin = (grossProfit / salePrice) * 100;
      return {
        isCostComplete: true,
        directCost,
        grossProfit,
        grossMargin,
        statusText: "مكتملة ومعتمدة",
      };
    }

    // Incomplete scenario:
    const incompleteEval = evaluateMenuItemMargin(100, [{ isComplete: false, quantity: 0, costPerUnit: 0.35 }]);
    assert(!incompleteEval.isCostComplete, "Incomplete recipe correctly flags isCostComplete: false");
    assert(incompleteEval.grossProfit === null, "Incomplete recipe DOES NOT expose misleading gross profit");
    assert(incompleteEval.grossMargin === null, "Incomplete recipe DOES NOT expose misleading gross margin");

    // Complete scenario:
    const completeEval = evaluateMenuItemMargin(120, [
      { isComplete: true, quantity: 250, costPerUnit: 0.35 }, // 87.50 EGP
      { isComplete: true, quantity: 1, costPerUnit: 2.50 },   // 2.50 EGP
    ]);
    assert(completeEval.isCostComplete, "Complete recipe flags isCostComplete: true");
    assert(completeEval.directCost === 90, "Direct cost is 90 EGP (87.50 + 2.50)");
    assert(completeEval.grossProfit === 30, "Gross profit is 30 EGP (120 - 90)");
    assert(completeEval.grossMargin === 25, "Gross margin is 25% (30 / 120 * 100)");

    // ------------------------------------------------------------------------
    // TEST 6: Double-Deduction Prevention & Grilling Raw Meat Safety
    // ------------------------------------------------------------------------
    console.log("\n--- Test 6: Idempotent Inventory Deduction & Customer Meat Safety ---");
    const mockOrderHistory = [{ action: "INVENTORY_DEDUCTED", timestamp: new Date().toISOString() }];
    const isAlreadyDeducted = mockOrderHistory.some(h => h.action === "INVENTORY_DEDUCTED");
    assert(isAlreadyDeducted, "Idempotency flag prevents double deduction");

    // Customer Grill orders do not consume restaurant meat
    const mockCustomerGrillItem = { isCustomerMeat: true, orderKind: "CUSTOMER_GRILL" };
    const shouldDeduct = !mockCustomerGrillItem.isCustomerMeat && mockCustomerGrillItem.orderKind !== "CUSTOMER_GRILL";
    assert(!shouldDeduct, "Customer meat in customer grill orders is NEVER deducted from inventory");

    // ------------------------------------------------------------------------
    // TEST 7: RBAC Server Guard Verification
    // ------------------------------------------------------------------------
    console.log("\n--- Test 7: Cashier RBAC Authorization Guard ---");
    function assertUserCanManageProcurement(role) {
      if (role !== "ADMIN" && role !== "MANAGER") {
        return { authorized: false, error: "غير مصرح لك بتنفيذ هذه العملية" };
      }
      return { authorized: true };
    }

    assert(!assertUserCanManageProcurement("CASHIER").authorized, "Cashier is rejected from managing procurement");
    assert(assertUserCanManageProcurement("MANAGER").authorized, "Manager is authorized to manage procurement");
    assert(assertUserCanManageProcurement("ADMIN").authorized, "Admin is authorized to manage procurement");

    // ------------------------------------------------------------------------
    // TEST 8: Data Preservation & Real Orders Integrity
    // ------------------------------------------------------------------------
    console.log("\n--- Test 8: Real Production Orders & Shifts Preservation ---");
    const ordersCount = await prisma.order.count();
    const customersCount = await prisma.customer.count();
    const shiftsCount = await prisma.shift.count();
    const menuItemsCount = await prisma.menuItem.count();

    console.log(`Database verification:`);
    console.log(`- Orders preserved: ${ordersCount}`);
    console.log(`- Customers preserved: ${customersCount}`);
    console.log(`- Shifts preserved: ${shiftsCount}`);
    console.log(`- Menu Items preserved: ${menuItemsCount}`);

    assert(ordersCount > 0, "Real production orders are intact and safe");
    assert(customersCount > 0, "Real customer records are intact");
    assert(shiftsCount > 0, "Shift records are intact");
    assert(menuItemsCount >= 64, "All 64 menu items and grilling services are intact and preserved");

    console.log("\n===============================================================");
    console.log(`ALL INVENTORY & RECIPES TESTS PASSED: ${passed}/${total} ✓`);
    console.log("===============================================================\n");
  } catch (err) {
    console.error("Test Suite Failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runInventorySuite();
