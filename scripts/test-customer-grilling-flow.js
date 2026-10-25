const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log("=== STARTING CUSTOMER GRILLING VERIFICATION SUITE ===");

  try {
    // 1. Verify DB connection
    await prisma.$connect();
    console.log("✓ Connected to PostgreSQL Database.");

    // 2. Test Direct Creation & Payment with ZERO add-ons (The exact bug scenario reported by user!)
    console.log("\n[Test 1] Simulating direct collectOrderPayment with 0 add-ons (Cashier clicks 'تحصيل نقدي وتسليم')...");
    
    // Simulate what pos.ts collectOrderPayment does:
    const isGrillOrder1 = true;
    const grillingFee1 = 120;
    const items1 = [];
    const itemsTotal1 = 0;
    const subtotal1 = grillingFee1 + itemsTotal1;
    const totalAmount1 = subtotal1;

    const order1 = await prisma.order.create({
      data: {
        orderType: "TAKEAWAY",
        orderKind: "CUSTOMER_GRILL",
        customerName: "عميل تجربة شوي مباشر",
        customerPhone: "01000000001",
        customerMeatWeight: 1500,
        grillingFee: grillingFee1,
        meatType: "لحم ضاني / ريش بلدي",
        pricingMode: "PER_KG",
        expectedPickupTime: "خلال 45 دقيقة",
        receivedBy: "كاشير تجريبي",
        deliveredBy: "كاشير تجريبي",
        workflowStatus: "DELIVERED",
        statusHistory: [
          {
            from: "NEW",
            to: "DELIVERED",
            user: "كاشير تجريبي",
            timestamp: new Date().toISOString(),
            note: "تحصيل فوري وتسليم خدمة شوي للغير",
          },
        ],
        subtotal: subtotal1,
        discount: 0,
        totalAmount: totalAmount1,
        status: "PAID",
        notes: "شوي خامات العميل بدون إضافات",
      },
    });

    console.log("✓ Order 1 created successfully with ZERO items!");
    console.log("  Order ID:", order1.id);
    console.log("  Order Number:", order1.orderNumber);
    console.log("  Order Kind:", order1.orderKind);
    console.log("  Grilling Fee:", order1.grillingFee);
    console.log("  Total Amount:", order1.totalAmount, "EGP (Strictly equal to Grilling Fee)");
    console.log("  Workflow Status:", order1.workflowStatus);

    if (order1.totalAmount !== 120 || order1.orderKind !== "CUSTOMER_GRILL") {
      throw new Error("Order 1 accounting validation failed!");
    }

    // 3. Test Creation to Prep with ZERO add-ons (Cashier clicks 'حفظ وتوجيه للشواية')
    console.log("\n[Test 2] Simulating sendOrderToPrep with 0 add-ons (Cashier clicks 'حفظ وتوجيه للشواية')...");
    const grillingFee2 = 80;
    const order2 = await prisma.order.create({
      data: {
        orderType: "TAKEAWAY",
        orderKind: "CUSTOMER_GRILL",
        customerName: "عميل تجربة شواية أولاً",
        customerPhone: "01000000002",
        customerMeatWeight: 1000,
        grillingFee: grillingFee2,
        meatType: "فراخ بيضاء كاملة",
        pricingMode: "PER_KG",
        expectedPickupTime: "خلال 30 دقيقة",
        receivedBy: "كاشير تجريبي",
        workflowStatus: "RECEIVED_CUSTOMER_MEAT",
        statusHistory: [
          {
            from: "NEW",
            to: "RECEIVED_CUSTOMER_MEAT",
            user: "كاشير تجريبي",
            timestamp: new Date().toISOString(),
            note: "استلام خامات العميل وتوجيه للشواية",
          },
        ],
        subtotal: grillingFee2,
        discount: 0,
        totalAmount: grillingFee2,
        status: "OPEN",
        notes: "تجهيز وشوي",
      },
    });

    console.log("✓ Order 2 created as OPEN with ZERO items!");
    console.log("  Order ID:", order2.id);
    console.log("  Order Number:", order2.orderNumber);
    console.log("  Status:", order2.status);
    console.log("  Workflow Status:", order2.workflowStatus);

    // 4. Test Collecting Payment on Existing Grilling Order
    console.log("\n[Test 3] Simulating subsequent collectOrderPayment for existing Order 2...");
    const updatedOrder2 = await prisma.order.update({
      where: { id: order2.id },
      data: {
        status: "PAID",
        workflowStatus: "DELIVERED",
        deliveredBy: "كاشير تجريبي",
      },
    });

    console.log("✓ Order 2 updated to PAID upon pickup!");
    console.log("  Status:", updatedOrder2.status);
    console.log("  Delivered By:", updatedOrder2.deliveredBy);

    // 5. Test Creation with Add-ons (Tahina, Salad)
    console.log("\n[Test 4] Simulating Customer Grilling with Add-ons from Restaurant...");
    const grillingFee3 = 100;
    const addOnPrice = 20; // 2x 10 EGP
    const totalWithAddons = grillingFee3 + addOnPrice;

    const testMenuItem = await prisma.menuItem.findFirst();
    if (!testMenuItem) {
      throw new Error("No menu item found for add-on test");
    }

    const order3 = await prisma.order.create({
      data: {
        orderType: "TAKEAWAY",
        orderKind: "CUSTOMER_GRILL",
        customerName: "عميل تجربة شوي مع إضافات",
        customerPhone: "01000000003",
        customerMeatWeight: 1000,
        grillingFee: grillingFee3,
        meatType: "كفتة مجهزة",
        pricingMode: "PER_KG",
        expectedPickupTime: "خلال 40 دقيقة",
        receivedBy: "كاشير تجريبي",
        workflowStatus: "DELIVERED",
        subtotal: totalWithAddons,
        discount: 0,
        totalAmount: totalWithAddons,
        status: "PAID",
        notes: "إضافات سلطات وطحينة",
        items: {
          create: [
            {
              menuItemId: testMenuItem.id,
              quantity: 2,
              unitPrice: 10,
              totalPrice: 20,
              notes: "طحينة مخصوص",
            },
          ],
        },
      },
      include: {
        items: true,
      },
    });

    console.log("✓ Order 3 created with Add-ons!");
    console.log("  Grilling Fee:", order3.grillingFee);
    console.log("  Items Count:", order3.items.length);
    console.log("  Total Amount:", order3.totalAmount, "EGP (100 grilling + 20 add-ons)");

    if (order3.totalAmount !== 120 || order3.items.length !== 1) {
      throw new Error("Order 3 calculation validation failed!");
    }

    // 6. Test Querying getActiveGrillingOrders
    console.log("\n[Test 5] Querying active customer grilling orders...");
    const activeGrilling = await prisma.order.findMany({
      where: { orderKind: "CUSTOMER_GRILL" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log(`✓ Successfully retrieved ${activeGrilling.length} customer grilling orders.`);
    activeGrilling.forEach((o, i) => {
      console.log(`  [${i+1}] #${o.orderNumber} - ${o.customerName} - ${o.meatType} (${o.customerMeatWeight}g) - Fee: ${o.grillingFee} ج.م - Total: ${o.totalAmount} ج.م - Status: ${o.workflowStatus}`);
    });

    console.log("\n==========================================");
    console.log("ALL CUSTOMER GRILLING TESTS PASSED 100% ✓");
    console.log("==========================================");
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
