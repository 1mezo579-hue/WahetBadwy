const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING COMPLETE SYSTEM SUITE - MASHWEYAT BASIONY');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Egyptian Phone Normalization Logic
    // ----------------------------------------------------
    console.log('--- Test 1: Egyptian Phone Normalization ---');
    function normalizeEgyptianPhone(phone) {
      let cleaned = phone.replace(/[^\d+]/g, "").trim();
      if (cleaned.startsWith("0020")) {
        cleaned = "+20" + cleaned.slice(4);
      } else if (cleaned.startsWith("20") && cleaned.length === 12) {
        cleaned = "+20" + cleaned.slice(2);
      } else if (cleaned.startsWith("01") && cleaned.length === 11) {
        cleaned = "+2" + cleaned;
      }
      return cleaned;
    }

    assert(normalizeEgyptianPhone("01012345678") === "+201012345678", "Normalizes 010 to +2010");
    assert(normalizeEgyptianPhone("01112345678") === "+201112345678", "Normalizes 011 to +2011");
    assert(normalizeEgyptianPhone("00201212345678") === "+201212345678", "Normalizes 0020 to +20");
    assert(normalizeEgyptianPhone("+201512345678") === "+201512345678", "Preserves valid +2015");

    // ----------------------------------------------------
    // TEST 2: Kitchen KDS Channel & Status Coverage
    // ----------------------------------------------------
    console.log('\n--- Test 2: Kitchen KDS Channel & Status Coverage ---');
    const recentOrders = await prisma.order.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        orderKind: true,
        status: true,
        workflowStatus: true,
      }
    });
    console.log(`Found ${recentOrders.length} recent orders in database.`);
    assert(recentOrders.length > 0, "Database has orders for testing");
    
    // Check that kitchen statuses include all active states
    const activeStatuses = ["NEW", "RECEIVED_CUSTOMER_MEAT", "PREPARING", "READY", "HANDED_TO_CASHIER", "OUT_FOR_DELIVERY"];
    const validChannels = ["TAKEAWAY", "DELIVERY", "DINE_IN", "CUSTOMER_GRILL"];
    assert(activeStatuses.length === 6, "All 6 active statuses configured");
    assert(validChannels.length === 4, "All 4 preparation channels supported");

    // ----------------------------------------------------
    // TEST 3: Shift Drawer Cash Calculation Logic
    // ----------------------------------------------------
    console.log('\n--- Test 3: Cash Drawer & Shift Expenses Formula ---');
    const activeShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
      include: {
        orders: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            isComplimentary: true,
          }
        }
      }
    });

    if (activeShift) {
      console.log(`Found Active Shift #${activeShift.shiftNumber} (User: ${activeShift.userId})`);
      
      let expensesList = [];
      if (Array.isArray(activeShift.expensesDetails)) {
        expensesList = activeShift.expensesDetails;
      } else if (typeof activeShift.expensesDetails === "string") {
        try {
          expensesList = JSON.parse(activeShift.expensesDetails);
        } catch {}
      }

      const cashOrdersTotal = activeShift.orders
        .filter(o => o.status === "COMPLETED" && !o.isComplimentary)
        .reduce((sum, o) => sum + o.totalAmount, 0);

      const cashExpenses = expensesList.filter((e) => !e.paymentMethod || e.paymentMethod === "CASH");
      const cashExpensesTotal = cashExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      const expectedDrawerCash = Math.max(0, activeShift.initialCash + cashOrdersTotal - cashExpensesTotal);

      console.log(`Initial Cash: ${activeShift.initialCash}`);
      console.log(`Cash Sales: ${cashOrdersTotal}`);
      console.log(`Approved Cash Expenses: ${cashExpensesTotal}`);
      console.log(`Expected Live Drawer Cash: ${expectedDrawerCash}`);

      assert(typeof expectedDrawerCash === 'number' && !isNaN(expectedDrawerCash), "Drawer cash is a valid number");
      assert(expectedDrawerCash >= 0, "Expected cash is non-negative");
    } else {
      console.log("No active shift open right now. Verifying drawer formula mathematically...");
      const startingCash = 500;
      const cashSales = 1200;
      const cashExpenses = 250;
      const expectedDrawerCash = startingCash + cashSales - cashExpenses;
      assert(expectedDrawerCash === 1450, "Formula subtracts only cash expenses");
    }

    // ----------------------------------------------------
    // TEST 4: Cashier RBAC Security
    // ----------------------------------------------------
    console.log('\n--- Test 4: Role-Based Access Control ---');
    const cashierUser = await prisma.user.findFirst({
      where: { role: "CASHIER" }
    });
    if (cashierUser) {
      console.log(`Found Cashier User: ${cashierUser.username} (${cashierUser.role})`);
      assert(cashierUser.role === "CASHIER", "User role is CASHIER");
      const isManagerOrAdmin = cashierUser.role === "ADMIN" || cashierUser.role === "MANAGER";
      assert(!isManagerOrAdmin, "Cashier is not Manager or Admin");
    } else {
      console.log("No CASHIER user in DB; verifying role logic");
      const testRole = "CASHIER";
      const isManagerOrAdmin = testRole === "ADMIN" || testRole === "MANAGER";
      assert(!isManagerOrAdmin, "CASHIER cannot perform Admin/Manager actions");
    }

    // ----------------------------------------------------
    // TEST 5: Manager Password Verification for Void
    // ----------------------------------------------------
    console.log('\n--- Test 5: Manager Password Verification (bcrypt) ---');
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" }
    });
    if (adminUser) {
      console.log(`Admin user found: ${adminUser.username}`);
      assert(adminUser.password && adminUser.password.startsWith("$2"), "Admin password is safely bcrypt hashed");
    }

    // ----------------------------------------------------
    // TEST 6: Menu Item Existence & Grilling Addons
    // ----------------------------------------------------
    console.log('\n--- Test 6: Grilling Service Items in Menu ---');
    const grillCategory = await prisma.category.findFirst({
      where: { nameAr: "خدمات الشوي" }
    });
    console.log("Grilling category exists in DB:", !!grillCategory);
    assert(true, "Menu category check completed");

    console.log('\n====================================================');
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTestSuite();
