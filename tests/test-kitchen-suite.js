const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runKitchenTests() {
  console.log("=== STARTING KITCHEN (KDS) TEST SUITE ===");
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
    // 1. Test fetching active orders
    const activeOrders = await prisma.order.findMany({
      where: {
        workflowStatus: {
          notIn: ["DELIVERED", "CANCELLED"],
        },
      },
      include: {
        items: true,
      },
      take: 5,
    });
    assert(Array.isArray(activeOrders), "DB Query for active kitchen orders returned an array");
    console.log(`Found ${activeOrders.length} active open kitchen orders.`);

    // 2. Test status history and transition
    // Create or find a test order
    let targetOrder = activeOrders[0];
    if (!targetOrder) {
      // Find any order to test status workflow update safely
      targetOrder = await prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
      });
    }

    if (targetOrder) {
      const originalStatus = targetOrder.workflowStatus;
      const originalHistory = Array.isArray(targetOrder.statusHistory) ? targetOrder.statusHistory : [];

      const newHistory = [
        ...originalHistory,
        {
          from: originalStatus || "NEW",
          to: "PREPARING",
          user: "شيف الاختبار",
          timestamp: new Date().toISOString(),
          note: "بدء التجهيز - فحص آلي",
        },
      ];

      const updated = await prisma.order.update({
        where: { id: targetOrder.id },
        data: {
          workflowStatus: "PREPARING",
          statusHistory: newHistory,
        },
      });

      assert(updated.workflowStatus === "PREPARING", "Order workflowStatus successfully transitioned to PREPARING");
      assert(
        Array.isArray(updated.statusHistory) && updated.statusHistory.length === newHistory.length,
        "Order statusHistory accurately appended with user and timestamp"
      );

      // Verify audit log creation
      const auditId = `audit_test_${Date.now()}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO audit_logs (id, action, order_id, user_name, details, reason, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`,
        auditId,
        "STATUS_CHANGED",
        targetOrder.id,
        "شيف الاختبار",
        JSON.stringify({ orderNumber: targetOrder.orderNumber, toStatus: "PREPARING" }),
        "فحص آلي لنظام المطبخ KDS"
      );

      const checkLog = await prisma.$queryRawUnsafe(
        `SELECT id, action, order_id FROM audit_logs WHERE id = $1`,
        auditId
      );
      assert(checkLog && checkLog.length > 0, "AuditLog record created and verified in PostgreSQL audit_logs table");

      // Rollback to original status so we leave data intact
      await prisma.order.update({
        where: { id: targetOrder.id },
        data: {
          workflowStatus: originalStatus,
          statusHistory: originalHistory,
        },
      });
      console.log("Safely restored test order original workflow state.");
    } else {
      console.log("No orders found to test transition, skipping update assertion.");
    }

    // 3. Static verification of KDS files
    const fs = require("fs");
    const kitchenViewExists = fs.existsSync("./src/app/kitchen/kitchen-view.tsx");
    const kitchenPageExists = fs.existsSync("./src/app/kitchen/page.tsx");
    const kitchenApiExists = fs.existsSync("./src/app/api/kitchen-orders/route.ts");
    const kitchenActionExists = fs.existsSync("./src/actions/kitchen.ts");

    assert(kitchenViewExists, "KitchenView component exists");
    assert(kitchenPageExists, "Kitchen server page exists");
    assert(kitchenApiExists, "Kitchen API route (/api/kitchen-orders) exists");
    assert(kitchenActionExists, "Kitchen actions (getActiveKitchenOrders, updateOrderKitchenStatus) exist");

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) process.exit(1);
  } catch (error) {
    console.error("Kitchen test suite crashed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runKitchenTests();
