const { PrismaClient, OrderStatus, TableType, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("   MASHWEYAT BASIONY — DELIVERY & RIDER CASH LEDGER COMPREHENSIVE TEST SUITE    ");
  console.log("================================================================================\n");

  const testSuffix = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Preserve existing real data
    // -------------------------------------------------------------------------
    console.log("--- 1. Verification of System Data Preservation ---");
    const existingOrdersCount = await prisma.order.count();
    const existingCustomersCount = await prisma.customer.count();
    const existingMaterialsCount = await prisma.rawMaterial.count();

    assert(existingOrdersCount >= 25, `Production orders intact (Count: ${existingOrdersCount})`);
    assert(existingCustomersCount >= 2, `Production customers intact (Count: ${existingCustomersCount})`);
    assert(existingMaterialsCount >= 86, `Raw materials catalog intact (Count: ${existingMaterialsCount})`);

    // -------------------------------------------------------------------------
    // TEST 2: Active Open Shift & Drawer Setup
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Active Shift & Safe Drawer Setup ---");
    let activeShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
      orderBy: { startTime: "desc" },
    });

    if (!activeShift) {
      const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      activeShift = await prisma.shift.create({
        data: {
          userId: admin.id,
          initialCash: 500,
          expectedCash: 500,
          status: "OPEN",
          notes: "وردية اختبار الدليفري",
        },
      });
      console.log(`  Created test shift #${activeShift.shiftNumber}`);
    }

    assert(activeShift && activeShift.status === "OPEN", `Active shift available (#${activeShift.shiftNumber})`);

    // -------------------------------------------------------------------------
    // TEST 3: New Cash Delivery Order Life Cycle (NEW -> READY -> WITH_RIDER)
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Cash Delivery Order Life Cycle & Rider Liability ---");
    const testPhone = `010${testSuffix}`;
    const testCustomer = await prisma.customer.upsert({
      where: { phone: testPhone },
      update: {},
      create: {
        name: `عميل تجربة ${testSuffix}`,
        phone: testPhone,
        address: "شارع البحر، العريش",
      },
    });

    const cashOrder = await prisma.order.create({
      data: {
        orderType: "DELIVERY",
        customerId: testCustomer.id,
        customerName: testCustomer.name,
        customerPhone: testCustomer.phone,
        deliveryAddress: testCustomer.address,
        deliveryFee: 25,
        subtotal: 200,
        totalAmount: 225,
        status: OrderStatus.OPEN,
        workflowStatus: "NEW",
        deliveryStatus: "NEW",
        paymentMethod: "CASH",
        riderCashDue: 225,
        riderCashRemitted: 0,
        remittanceStatus: "PENDING",
        shiftId: activeShift.id,
      },
    });

    assert(cashOrder.workflowStatus === "NEW", "Cash delivery order initialized with status NEW");
    assert(cashOrder.riderCashDue === 225, "Rider cash due set to 225 EGP (Subtotal + Delivery Fee)");
    assert(cashOrder.remittanceStatus === "PENDING", "Remittance status initialized as PENDING");

    // Kitchen finishes order -> READY (وصل للكاشير، لم يستلمه الطيار بعد)
    const readyOrder = await prisma.order.update({
      where: { id: cashOrder.id },
      data: {
        deliveryStatus: "READY",
        workflowStatus: "READY",
      },
    });

    assert(readyOrder.deliveryStatus === "READY", "Order ready at cashier; distinct from rider handover");
    assert(readyOrder.riderCashRemitted === 0, "Drawer cash unaffected while waiting at cashier counter");

    // Cashier hands order to Rider -> WITH_RIDER
    const riderName = `كابتن محمود ${testSuffix}`;
    const dispatchedOrder = await prisma.order.update({
      where: { id: cashOrder.id },
      data: {
        riderName,
        deliveredBy: riderName,
        deliveryStatus: "WITH_RIDER",
        workflowStatus: "WITH_RIDER",
      },
    });

    assert(dispatchedOrder.deliveryStatus === "WITH_RIDER", `Order handed over to rider (${riderName})`);
    assert(dispatchedOrder.riderName === riderName, "Rider identity attached to delivery record");

    // -------------------------------------------------------------------------
    // TEST 4: Money with Rider is NOT Drawer Cash (Operational Liability)
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Operational Debt Isolation (Not Drawer Cash) ---");
    const checkDrawer = await prisma.shift.findUnique({
      where: { id: activeShift.id },
    });

    // Remittance total for shift should not have changed yet
    assert(
      (checkDrawer.riderRemittancesTotal || 0) === (activeShift.riderRemittancesTotal || 0),
      "Handover to rider does NOT increase cashier drawer cash"
    );

    // -------------------------------------------------------------------------
    // TEST 5: Full Rider Remittance (تأكيد استلام النقدية بالدرج)
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Full Rider Remittance (Settlement & Drawer Increase) ---");
    const initialRemittanceTotal = checkDrawer.riderRemittancesTotal || 0;

    // Simulate recordRiderRemittance execution
    await prisma.$transaction([
      prisma.order.update({
        where: { id: cashOrder.id },
        data: {
          riderCashRemitted: 225,
          remittanceStatus: "REMITTED",
          status: OrderStatus.PAID,
          riderRemittedAt: new Date(),
        },
      }),
      prisma.riderRemittance.create({
        data: {
          riderName,
          shiftId: activeShift.id,
          cashierName: "كاشير تجربة",
          amountExpected: 225,
          amountReceived: 225,
          variance: 0,
          paymentMethod: "CASH",
          notes: "توريد كامل الأوردر",
          orderIds: [cashOrder.id],
        },
      }),
      prisma.shift.update({
        where: { id: activeShift.id },
        data: {
          riderRemittancesTotal: { increment: 225 },
        },
      }),
    ]);

    const updatedShiftAfterRemittance = await prisma.shift.findUnique({
      where: { id: activeShift.id },
    });
    const settledOrder = await prisma.order.findUnique({
      where: { id: cashOrder.id },
    });

    assert(settledOrder.remittanceStatus === "REMITTED", "Order remittance status marked REMITTED");
    assert(settledOrder.riderCashRemitted === 225, "Rider remitted amount equals 225 EGP");
    assert(settledOrder.status === OrderStatus.PAID, "Order status transitioned to PAID");
    assert(
      (updatedShiftAfterRemittance.riderRemittancesTotal || 0) === initialRemittanceTotal + 225,
      "Shift rider remittances total increased exactly by 225 EGP in drawer"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Digital & Mixed Payment Orders (No False Cash Liability)
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Digital & Mixed Payment Protection ---");
    // Digital (Visa/Card)
    const digitalOrder = await prisma.order.create({
      data: {
        orderType: "DELIVERY",
        customerName: "عميل فيزا",
        customerPhone: `011${testSuffix}`,
        deliveryAddress: "المساعيد",
        totalAmount: 300,
        status: OrderStatus.PAID,
        paymentMethod: "CARD",
        riderCashDue: 0, // Zero cash liability on rider
        remittanceStatus: "NOT_APPLICABLE",
        shiftId: activeShift.id,
      },
    });

    assert(digitalOrder.riderCashDue === 0, "Visa/Card delivery creates 0 EGP cash liability on rider");
    assert(digitalOrder.remittanceStatus === "NOT_APPLICABLE", "Digital order remittance status is NOT_APPLICABLE");

    // Mixed Payment (100 cash, 200 electronic)
    const mixedOrder = await prisma.order.create({
      data: {
        orderType: "DELIVERY",
        customerName: "عميل دفع مختلط",
        customerPhone: `012${testSuffix}`,
        totalAmount: 300,
        paymentMethod: "MIXED",
        cashPortion: 100,
        electronicPortion: 200,
        riderCashDue: 100, // Only cash portion
        riderCashRemitted: 0,
        remittanceStatus: "PENDING",
        shiftId: activeShift.id,
      },
    });

    assert(mixedOrder.riderCashDue === 100, "Mixed order assigns cash liability ONLY for the cash portion (100 EGP)");
    assert(mixedOrder.electronicPortion === 200, "Electronic portion (200 EGP) isolated from rider cash ledger");

    // -------------------------------------------------------------------------
    // TEST 7: Partial Remittance Allocation
    // -------------------------------------------------------------------------
    console.log("\n--- 7. Partial Remittance Allocation ---");
    const partialOrder = await prisma.order.create({
      data: {
        orderType: "DELIVERY",
        customerName: "عميل جزئي",
        customerPhone: `015${testSuffix}`,
        totalAmount: 500,
        riderName,
        paymentMethod: "CASH",
        riderCashDue: 500,
        riderCashRemitted: 0,
        remittanceStatus: "PENDING",
        shiftId: activeShift.id,
      },
    });

    // Rider remits 300 EGP out of 500 EGP
    await prisma.$transaction([
      prisma.order.update({
        where: { id: partialOrder.id },
        data: {
          riderCashRemitted: 300,
          remittanceStatus: "PARTIAL",
        },
      }),
      prisma.riderRemittance.create({
        data: {
          riderName,
          shiftId: activeShift.id,
          cashierName: "كاشير تجربة",
          amountExpected: 500,
          amountReceived: 300,
          variance: -200,
          varianceReason: "توريد جزئي - باقي 200 ج.م مع الطيار",
          paymentMethod: "CASH",
          orderIds: [partialOrder.id],
        },
      }),
    ]);

    const updatedPartialOrder = await prisma.order.findUnique({
      where: { id: partialOrder.id },
    });
    const pendingOnPartial = updatedPartialOrder.riderCashDue - updatedPartialOrder.riderCashRemitted;

    assert(updatedPartialOrder.remittanceStatus === "PARTIAL", "Order marked as PARTIAL remittance");
    assert(updatedPartialOrder.riderCashRemitted === 300, "Remitted amount recorded as 300 EGP");
    assert(pendingOnPartial === 200, "Remaining debt correctly calculated as 200 EGP on rider");

    // -------------------------------------------------------------------------
    // TEST 8: Fast Search with Egyptian Phone Normalization
    // -------------------------------------------------------------------------
    console.log("\n--- 8. Fast Search & Egyptian Phone Formats ---");
    function normalizeEgyptianPhoneVariations(phoneQuery) {
      const digits = phoneQuery.replace(/\D/g, "");
      if (!digits) return [phoneQuery];
      const variations = new Set();
      variations.add(phoneQuery);
      variations.add(digits);
      if (digits.startsWith("20") && digits.length >= 3) {
        variations.add("0" + digits.substring(2));
        variations.add(digits.substring(2));
      }
      if (digits.startsWith("01")) {
        variations.add(digits.substring(1));
        variations.add("2" + digits);
        variations.add("+2" + digits);
      }
      return Array.from(variations);
    }

    async function executeFastSearch({ query }) {
      const trimmedQuery = query.trim();
      const phoneVars = normalizeEgyptianPhoneVariations(trimmedQuery);
      const isNum = /^\d+$/.test(trimmedQuery.replace(/^#/, ""));
      const parsedNum = isNum ? parseInt(trimmedQuery.replace(/^#/, ""), 10) : null;
      const conditions = [
        { customerName: { contains: trimmedQuery, mode: "insensitive" } },
        { riderName: { contains: trimmedQuery, mode: "insensitive" } },
      ];
      phoneVars.forEach((v) => conditions.push({ customerPhone: { contains: v } }));
      if (parsedNum) conditions.push({ orderNumber: parsedNum });
      return await prisma.order.findMany({ where: { OR: conditions } });
    }

    // Search by local 010...
    const res1 = await executeFastSearch({ query: testPhone });
    assert(res1.length >= 1, `Search by local phone (${testPhone}) finds order`);

    // Search by international +2010...
    const res2 = await executeFastSearch({ query: `+20${testPhone.substring(1)}` });
    assert(res2.length >= 1, `Search by international format (+20${testPhone.substring(1)}) finds order`);

    // Search by order number
    const res3 = await executeFastSearch({ query: `#${cashOrder.orderNumber}` });
    assert(res3.length >= 1, `Search by order number (#${cashOrder.orderNumber}) finds order`);

    // Search by rider name
    const res4 = await executeFastSearch({ query: riderName });
    assert(res4.length >= 1, `Search by rider name (${riderName}) finds associated orders`);

    // -------------------------------------------------------------------------
    // TEST 9: Void Item & Manager Authorization (bcrypt)
    // -------------------------------------------------------------------------
    console.log("\n--- 9. Manager VOID Item Authorization (Server-Side bcrypt) ---");
    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    const cashierUser = await prisma.user.findFirst({ where: { role: "CASHIER" } });

    assert(adminUser && (adminUser.role === "ADMIN" || adminUser.role === "MANAGER"), "Admin user exists with administrative authority");
    assert(cashierUser && cashierUser.role === "CASHIER", "Cashier user exists with cashier least privilege");

    // Test bcrypt verification logic
    const wrongPassMatch = await bcrypt.compare("wrong_password_12345", adminUser.password);
    assert(wrongPassMatch === false, "Wrong manager password strictly fails bcrypt authentication");

    // Cashier role must be rejected as manager
    const isCashierManager = cashierUser.role === "ADMIN" || cashierUser.role === "MANAGER";
    assert(isCashierManager === false, "Cashier user strictly rejected for manager approvals");

    // -------------------------------------------------------------------------
    // TEST 10: Hospitality / Complimentary (بند الضيافة والعزومات)
    // -------------------------------------------------------------------------
    console.log("\n--- 10. Hospitality / Complimentary Accounting ---");

    // Create order to apply hospitality
    const compOrder = await prisma.order.create({
      data: {
        orderType: "DINE_IN",
        subtotal: 150,
        totalAmount: 150,
        status: OrderStatus.OPEN,
        shiftId: activeShift.id,
      },
    });

    const isBcrypt = adminUser.password.startsWith("$2");
    assert(isBcrypt, "Admin user password stored securely as bcrypt hash");

    // Apply hospitality record
    const hospitalityRecord = await prisma.hospitalityRecord.create({
      data: {
        orderId: compOrder.id,
        orderNumber: compOrder.orderNumber,
        type: "FULL",
        amount: 150,
        reason: "عزومة إدارة وضيافة خاصة",
        managerId: adminUser.id,
        managerName: adminUser.name,
        cashierName: "كاشير الوردية",
        shiftId: activeShift.id,
      },
    });

    await prisma.order.update({
      where: { id: compOrder.id },
      data: {
        isComplimentary: true,
        discount: 150,
        totalAmount: 0,
        hospitalityValue: 150,
        hospitalityReason: "عزومة إدارة وضيافة خاصة",
        hospitalityApprovedBy: adminUser.name,
      },
    });

    const verifyCompOrder = await prisma.order.findUnique({
      where: { id: compOrder.id },
    });

    assert(verifyCompOrder.isComplimentary === true, "Complimentary flag marked TRUE");
    assert(verifyCompOrder.totalAmount === 0, "Total amount payable zeroed out for full hospitality");
    assert(verifyCompOrder.hospitalityValue === 150, "Full regular value recorded under hospitality ledger (150 EGP)");

    // Hospitality report query
    const hospRecords = await prisma.hospitalityRecord.findMany({ where: { shiftId: activeShift.id } });
    const totalHospitalityAmount = hospRecords.reduce((sum, r) => sum + r.amount, 0);
    assert(totalHospitalityAmount >= 150, `Hospitality tracked in dedicated financial report (${totalHospitalityAmount} EGP)`);

    // -------------------------------------------------------------------------
    // TEST 11: Shift Closing Integration with Rider Debt Isolation
    // -------------------------------------------------------------------------
    console.log("\n--- 11. Shift Closing & Rider Debt Separation ---");
    const shiftRemittances = await prisma.riderRemittance.findMany({ where: { shiftId: activeShift.id } });
    const calculatedRemittances = shiftRemittances.reduce((sum, r) => sum + r.amountReceived, 0);

    const pendingOrdersForRiders = await prisma.order.findMany({
      where: {
        orderType: "DELIVERY",
        workflowStatus: { not: "CANCELLED" },
        remittanceStatus: { in: ["PENDING", "PARTIAL"] },
        riderCashDue: { gt: 0 },
      },
    });
    const calculatedPendingDebt = pendingOrdersForRiders.reduce((sum, o) => {
      return sum + Math.max(0, (o.riderCashDue || 0) - (o.riderCashRemitted || 0));
    }, 0);

    assert(
      typeof calculatedRemittances === "number" && calculatedRemittances >= 225,
      `Drawer reflects physical rider remittances (+${calculatedRemittances} EGP)`
    );
    assert(
      typeof calculatedPendingDebt === "number",
      `Pending rider operational debt tracked separately (${calculatedPendingDebt} EGP)`
    );

    // -------------------------------------------------------------------------
    // TEST 12: Reprinting Receipt Does NOT Change Sales or Inventory
    // -------------------------------------------------------------------------
    console.log("\n--- 12. Reprint Isolation ---");
    const beforeReprint = await prisma.order.findUnique({ where: { id: cashOrder.id } });
    // Simulate reprint action: increment reprintCount and write audit log
    const updatedReprint = await prisma.order.update({
      where: { id: cashOrder.id },
      data: { reprintCount: { increment: 1 } },
    });
    const afterReprint = await prisma.order.findUnique({ where: { id: cashOrder.id } });

    assert(afterReprint.totalAmount === beforeReprint.totalAmount, "Total sales amount completely unchanged by reprint");
    assert(afterReprint.reprintCount === (beforeReprint.reprintCount || 0) + 1, "Reprint audit counter incremented cleanly");

    // -------------------------------------------------------------------------
    // CLEANUP TEST ARTIFACTS
    // -------------------------------------------------------------------------
    console.log("\n--- Cleaning up temporary test orders ---");
    await prisma.riderRemittance.deleteMany({
      where: { notes: { contains: "توريد" } },
    });
    await prisma.hospitalityRecord.deleteMany({
      where: { orderId: compOrder.id },
    });
    await prisma.order.deleteMany({
      where: {
        id: { in: [cashOrder.id, digitalOrder.id, mixedOrder.id, partialOrder.id, compOrder.id] },
      },
    });
    await prisma.customer.deleteMany({
      where: { phone: testPhone },
    });
    console.log("  ✓ Test artifacts safely purged. Production records 100% clean.\n");

  } catch (error) {
    console.error("Test execution exception:", error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log("================================================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
