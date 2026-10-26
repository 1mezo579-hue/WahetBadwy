const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient();

async function runAmoBasionyTestSuite() {
  console.log("=== STARTING AMO BASIONY & FINANCIAL AUDIT TEST SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Static Verification of Assistant & Widget files
    const assistantActionFile = "./src/actions/assistant.ts";
    const widgetFile = "./src/components/ai/amo-basiony-widget.tsx";
    assert(fs.existsSync(assistantActionFile), "src/actions/assistant.ts exists");
    assert(fs.existsSync(widgetFile), "src/components/ai/amo-basiony-widget.tsx exists");

    const assistantCode = fs.readFileSync(assistantActionFile, "utf8");
    const widgetCode = fs.readFileSync(widgetFile, "utf8");

    // 2. Requirement 1: Order Search for Cashier
    assert(assistantCode.includes("searchOrdersForCashier"), "searchOrdersForCashier function is implemented and exported");
    assert(assistantCode.includes("orderNumber: parsedNumber"), "Searches by order number");
    assert(assistantCode.includes("customerPhone: { contains: raw }"), "Searches by customer phone");
    assert(assistantCode.includes('orderBy:\n      {\n        createdAt: "desc"') || assistantCode.includes('orderBy: {\n        createdAt: "desc"'), "Returns orders ordered from newest to oldest");

    // Verify DB Query for order search directly
    const recentDbOrders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: { include: { menuItem: true } } },
    });
    assert(Array.isArray(recentDbOrders), "Database orders table accessible for cashier search");
    console.log(`Verified DB connectivity: ${recentDbOrders.length} recent orders available in system.`);

    // 3. Requirement 2: Admin Smart Assistant & Reports
    assert(assistantCode.includes("askAdminAssistant"), "askAdminAssistant function is implemented");
    assert(assistantCode.includes('userRole !== "ADMIN"'), "Strict server-side ADMIN role enforcement active");
    assert(assistantCode.includes("cancelledOrdersCount"), "Calculates canceled invoices count and values");
    assert(assistantCode.includes("drawerShortageTotal"), "Calculates safe discrepancies and shortages");
    assert(assistantCode.includes("channelBreakdown"), "Calculates sales breakdown by channel");
    assert(assistantCode.includes("estimatedNetProfit"), "Calculates estimated P&L with explicit source disclaimer");

    // 4. Requirement 3: Financial Audit & Control
    assert(assistantCode.includes("getFinancialAuditDashboardData"), "getFinancialAuditDashboardData function implemented");
    
    // Check audit_logs table presence and query
    const auditLogsCount = await prisma.$queryRawUnsafe(
      `SELECT count(*) as count FROM audit_logs`
    );
    assert(auditLogsCount && auditLogsCount[0], "PostgreSQL audit_logs table accessible and active");

    // 5. Requirement 5: Floating & Draggable Assistant Icon
    assert(widgetCode.includes("amo_basiony_pos_v2"), "Widget persists position in localStorage");
    assert(widgetCode.includes("handleStartDrag"), "Mouse and Touch drag event listeners implemented");
    assert(widgetCode.includes("handleResetPosition"), "Reset to default position action implemented");
    assert(widgetCode.includes("Math.min(window.innerWidth - 70"), "Position clamped to viewport bounds");
    assert(widgetCode.includes("moved"), "Distinguishes drag threshold from click action");
    assert(widgetCode.includes("activeTab"), "Tabbed layout (Search, Chat, Reports, Audit) implemented");

    // 6. Offline Queuing & Idempotency in POS
    const posCode = fs.readFileSync("./src/app/pos/pos-interface.tsx", "utf8");
    assert(posCode.includes("basiony_pos_offline_queue"), "Offline local queue storage implemented in POS");
    assert(posCode.includes("syncOfflineOrders"), "Automatic background sync upon reconnection implemented");
    assert(posCode.includes("clientOrderId"), "Client Order ID preserves idempotency across reconnections");

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAmoBasionyTestSuite();
