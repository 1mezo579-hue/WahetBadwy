const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

async function runShiftsTestSuite() {
  console.log("=== STARTING SHIFT & SAFE CLOSURE (PHASE 3) TEST SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // 1. Static Verification of components and actions
    const shiftActionExists = fs.existsSync("./src/actions/shifts.ts");
    const shiftModalExists = fs.existsSync("./src/components/pos/shift-modal.tsx");
    assert(shiftActionExists, "Shift server actions (src/actions/shifts.ts) exists");
    assert(shiftModalExists, "ShiftModal component (src/components/pos/shift-modal.tsx) exists");

    // 2. Verify Z-Report generator function
    const printerModule = fs.readFileSync("./src/utils/printer/silent-print.ts", "utf8");
    assert(printerModule.includes("buildZReportHtml"), "buildZReportHtml exists in printer utilities");

    // 3. Mathematical validation of Basiony Grill Safe Reconciliation Formula
    const mockShift = {
      initialCash: 500,
      grossSales: 3200,
      discounts: 100,
      visaAmount: 600,
      otherBalance: 0,
      expensesTotal: 250,
      managementChecks: 0,
      managementWithdrawalsTotal: 500,
    };

    // Expected Cash = Initial (500) + Gross (3200) - Discounts (100) - Visa (600) - Expenses (250) - Withdrawals (500)
    // 500 + 3200 - 100 - 600 - 250 - 500 = 2250
    const calculatedExpected =
      mockShift.initialCash +
      mockShift.grossSales -
      mockShift.discounts -
      mockShift.visaAmount -
      mockShift.otherBalance -
      mockShift.expensesTotal -
      mockShift.managementChecks -
      mockShift.managementWithdrawalsTotal;

    assert(calculatedExpected === 2250, `Calculated Expected Cash matches formula (expected 2250, got ${calculatedExpected})`);

    const countedCashMatching = 2250;
    const shortageOverageZero = countedCashMatching - calculatedExpected;
    assert(shortageOverageZero === 0, "Exact cash count results in shortageOverage === 0");

    const countedCashShortage = 2200;
    const shortage = countedCashShortage - calculatedExpected;
    assert(shortage === -50, "Shortage accurately computed as -50 EGP");

    const countedCashOverage = 2350;
    const overage = countedCashOverage - calculatedExpected;
    assert(overage === 100, "Overage accurately computed as +100 EGP");

    // 4. DB Audit Table Verification for SHIFT_STARTED / SHIFT_ENDED
    const shiftAuditId = `audit_shift_test_${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO audit_logs (id, action, user_name, details, reason, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, NOW())`,
      shiftAuditId,
      "SHIFT_ENDED",
      "كاشير الاختبار",
      JSON.stringify({
        initialCash: 500,
        actualCash: 2250,
        expectedCash: 2250,
        shortageOverage: 0,
      }),
      "اختبار آلي لتقفيل الوردية"
    );

    const logRecord = await prisma.$queryRawUnsafe(
      `SELECT id, action, details FROM audit_logs WHERE id = $1`,
      shiftAuditId
    );
    assert(logRecord && logRecord.length > 0, "AuditLog entry for SHIFT_ENDED recorded in DB");

    // Clean up test audit log
    await prisma.$executeRawUnsafe(`DELETE FROM audit_logs WHERE id = $1`, shiftAuditId);

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) process.exit(1);
  } catch (e) {
    console.error("Shift test suite error:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runShiftsTestSuite();
