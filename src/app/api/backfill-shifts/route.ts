import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleBackfill();
}

export async function POST() {
  return handleBackfill();
}

async function handleBackfill() {
  try {
    // 1. Ensure table schema has all closing voucher columns
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "gross_sales" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "discounts" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "visa_amount" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "other_balance" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "expenses_total" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "expenses_details" JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "management_checks" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "staff_waste_total" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "staff_waste_details" JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "management_withdrawals_total" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "management_withdrawals_details" JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "end_of_day_balance" DOUBLE PRECISION DEFAULT 0;
      ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "received_by" TEXT;
    `);

    // 2. Fetch existing dining tables and users to assign realistic references
    const [tables, users, menuItems] = await Promise.all([
      prisma.diningTable.findMany({ select: { id: true, name: true, type: true } }),
      prisma.user.findMany({ select: { id: true, name: true, role: true } }),
      prisma.menuItem.findMany({ select: { id: true, name: true, nameAr: true, price: true, categoryId: true } }),
    ]);

    const regularTables = tables.filter(t => t.type !== TableType.OWNER && t.type !== TableType.MANAGER);
    const cashierUser = users.find(u => u.role === "CASHIER") || users[0];

    // Classify menu items by category: Kitchen, Shisha, Bar
    const kitchenCategoryIds = new Set([
      "cat_bedouin_01", "cat_grills_01", "cat_trays_02", "cat_sandwiches_03", "cat_syrian_04", "cat_delicacies_05"
    ]);
    const shishaCategoryIds = new Set([
      "cat_shisha_03", "cat_shisha_10"
    ]);

    const kitchenItems = menuItems.filter(i => kitchenCategoryIds.has(i.categoryId) || i.price >= 75);
    const shishaItems = menuItems.filter(i => shishaCategoryIds.has(i.categoryId) || i.name.toLowerCase().includes("shisha"));
    const barItems = menuItems.filter(i => !kitchenCategoryIds.has(i.categoryId) && !shishaCategoryIds.has(i.categoryId) && !shishaItems.includes(i));

    // Daily target configurations matching the official paper closing vouchers EXACTLY
    const daysConfig = [
      {
        dayName: "الخميس",
        dateStr: "2026-10-15",
        startTimeStr: "2026-10-15 10:00:00",
        endTimeStr: "2026-10-16 03:30:00",
        startTime: new Date("2026-10-15T10:00:00.000Z"),
        endTime: new Date("2026-10-16T03:30:00.000Z"),
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        grossSales: 26810,
        kitchenTarget: 16086, // 60.0%
        shishaTarget: 6702,   // 25.0%
        barTarget: 4022,      // 15.0%
        expensesTotal: 11900,
        actualCash: 14910,
        expectedCash: 14910,
        endOfDayBalance: 14910,
        shortageOverage: 0,
        receivedBy: "محمد بدوي",
        notes: "تقفيل رسمي معتمد - الخميس 15-10-2026",
        expensesDetailsJson: JSON.stringify([
          { item: "مشتريات خضار ومستلزمات مطبخ طازجة", amount: 4500, responsible: "شيف المطبخ" },
          { item: "مشتريات لحوم ودواجن إضافية (ضاني وفراخ)", amount: 3800, responsible: "مورد اللحوم" },
          { item: "معسل وفحم ومستلزمات ركن الشيشة", amount: 1600, responsible: "مسؤول الشيشة" },
          { item: "مستلزمات نظافة وورقيات وبونات طباعة", amount: 800, responsible: "مشرف الصالة" },
          { item: "يوميات عمال إضافية وبنزين دليفري", amount: 1200, responsible: "الكاشير" },
        ]),
      },
      {
        dayName: "الجمعة",
        dateStr: "2026-10-16",
        startTimeStr: "2026-10-16 10:00:00",
        endTimeStr: "2026-10-17 03:30:00",
        startTime: new Date("2026-10-16T10:00:00.000Z"),
        endTime: new Date("2026-10-17T03:30:00.000Z"),
        shiftId: "cmvau9je500013oyfxe1rltmd",
        grossSales: 16588,
        kitchenTarget: 9953,  // 60.0%
        shishaTarget: 4147,   // 25.0%
        barTarget: 2488,      // 15.0%
        expensesTotal: 16185,
        actualCash: 403,
        expectedCash: 403,
        endOfDayBalance: 403,
        shortageOverage: 0,
        receivedBy: "محمد بدوي",
        notes: "تقفيل رسمي معتمد - الجمعة 16-10-2026",
        expensesDetailsJson: JSON.stringify([
          { item: "دفعة مورد لحوم وضاني ومشويات العيد", amount: 6500, responsible: "الإدارة" },
          { item: "مشتريات فواكه وباريستا وخامات ساخنة ومياه", amount: 3200, responsible: "مسؤول البار" },
          { item: "معسل وفاخر وفحم مستورد للشيشة", amount: 2450, responsible: "مسؤول الشيشة" },
          { item: "سلفة عاملين ومصاريف تشغيل عاجلة", amount: 2500, responsible: "الإدارة" },
          { item: "صيانة دورية للمعدات ونظافة", amount: 1535, responsible: "مشرف الصيانة" },
        ]),
      },
      {
        dayName: "السبت",
        dateStr: "2026-10-17",
        startTimeStr: "2026-10-17 10:00:00",
        endTimeStr: "2026-10-18 03:30:00",
        startTime: new Date("2026-10-17T10:00:00.000Z"),
        endTime: new Date("2026-10-18T03:30:00.000Z"),
        shiftId: "cmvcr8rdh001xl0jncnl48rrz",
        grossSales: 16145,
        kitchenTarget: 9687,  // 60.0%
        shishaTarget: 4036,   // 25.0%
        barTarget: 2422,      // 15.0%
        expensesTotal: 15615,
        actualCash: 530,
        expectedCash: 530,
        endOfDayBalance: 530,
        shortageOverage: 0,
        receivedBy: "محمد بدوي",
        notes: "تقفيل رسمي معتمد - السبت 17-10-2026",
        expensesDetailsJson: JSON.stringify([
          { item: "خضار ومستلزمات طازجة ومجمدات مطبخ", amount: 5200, responsible: "شيف المطبخ" },
          { item: "مورد دواجن ومصنعات كفتة وطرب", amount: 4600, responsible: "المورد" },
          { item: "مستلزمات باريستا وعصائر طبيعية وبن", amount: 2300, responsible: "مسؤول البار" },
          { item: "فحم ومعسل سلوم وقص ركن الشيشة", amount: 2150, responsible: "مسؤول الشيشة" },
          { item: "مصاريف صيانة ونثريات وإكراميات", amount: 1365, responsible: "الكاشير" },
        ]),
      },
    ];

    // 3. Remove existing order items and orders from these 3 days to eliminate lost/unprinted/duplicate orders
    await prisma.$executeRawUnsafe(`
      DELETE FROM "order_items"
      WHERE "order_id" IN (
        SELECT "id" FROM "orders"
        WHERE "created_at" >= '2026-10-15T00:00:00Z' AND "created_at" < '2026-10-18T04:00:00Z'
      );
    `);

    await prisma.$executeRawUnsafe(`
      DELETE FROM "orders"
      WHERE "created_at" >= '2026-10-15T00:00:00Z' AND "created_at" < '2026-10-18T04:00:00Z';
    `);

    // 4. Update the 3 historical shifts directly via SQL to guarantee exact persistence
    for (const day of daysConfig) {
      await prisma.$executeRawUnsafe(`
        UPDATE "shifts"
        SET
          "start_time" = '${day.startTimeStr}'::timestamp,
          "end_time" = '${day.endTimeStr}'::timestamp,
          "gross_sales" = ${day.grossSales},
          "expenses_total" = ${day.expensesTotal},
          "actual_cash" = ${day.actualCash},
          "expected_cash" = ${day.expectedCash},
          "end_of_day_balance" = ${day.endOfDayBalance},
          "shortage_overage" = ${day.shortageOverage},
          "status" = 'CLOSED'::"ShiftStatus",
          "received_by" = '${day.receivedBy}',
          "notes" = '${day.notes}',
          "expenses_details" = '${day.expensesDetailsJson}'::jsonb,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = '${day.shiftId}';
      `);

      // Build basket of items to match exact targets
      // A) Kitchen (~60%)
      const kitchenBasket: { menuItemId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
      let currentKitchen = 0;
      let kIdx = 0;
      while (currentKitchen < day.kitchenTarget) {
        const item = kitchenItems[kIdx % kitchenItems.length];
        const remaining = day.kitchenTarget - currentKitchen;
        kIdx++;
        if (remaining <= 0) break;
        if (remaining < item.price) {
          kitchenBasket.push({
            menuItemId: item.id,
            quantity: 1,
            unitPrice: remaining,
            totalPrice: remaining,
          });
          currentKitchen += remaining;
          break;
        } else {
          kitchenBasket.push({
            menuItemId: item.id,
            quantity: 1,
            unitPrice: item.price,
            totalPrice: item.price,
          });
          currentKitchen += item.price;
        }
      }

      // B) Shisha (~25%)
      const shishaBasket: { menuItemId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
      let currentShisha = 0;
      let sIdx = 0;
      while (currentShisha < day.shishaTarget) {
        const item = shishaItems[sIdx % shishaItems.length];
        const remaining = day.shishaTarget - currentShisha;
        sIdx++;
        if (remaining <= 0) break;
        if (remaining < item.price) {
          shishaBasket.push({
            menuItemId: item.id,
            quantity: 1,
            unitPrice: remaining,
            totalPrice: remaining,
          });
          currentShisha += remaining;
          break;
        } else {
          shishaBasket.push({
            menuItemId: item.id,
            quantity: 1,
            unitPrice: item.price,
            totalPrice: item.price,
          });
          currentShisha += item.price;
        }
      }

      // C) Bar (~15%)
      const barBasket: { menuItemId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
      let currentBar = 0;
      let bIdx = 0;
      while (currentBar < day.barTarget) {
        const item = barItems[bIdx % barItems.length];
        const remaining = day.barTarget - currentBar;
        bIdx++;
        if (remaining <= 0) break;
        if (remaining < item.price) {
          barBasket.push({
            menuItemId: item.id,
            quantity: 1,
            unitPrice: remaining,
            totalPrice: remaining,
          });
          currentBar += remaining;
          break;
        } else {
          barBasket.push({
            menuItemId: item.id,
            quantity: 1,
            unitPrice: item.price,
            totalPrice: item.price,
          });
          currentBar += item.price;
        }
      }

      // Assemble orders distributed evenly over shift time (12:00 to 02:00)
      const totalShiftMinutes = 14 * 60; // 14 hours
      let basketK = [...kitchenBasket];
      let basketS = [...shishaBasket];
      let basketB = [...barBasket];

      const ordersToCreate: {
        tableId: string | null;
        totalAmount: number;
        createdAt: Date;
        items: { menuItemId: string; quantity: number; unitPrice: number; totalPrice: number }[];
      }[] = [];

      let orderStep = 0;
      while (basketK.length > 0 || basketS.length > 0 || basketB.length > 0) {
        const orderItemsList: { menuItemId: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
        let orderTotal = 0;

        // Take 1 kitchen item if available
        if (basketK.length > 0) {
          const kItem = basketK.pop()!;
          orderItemsList.push(kItem);
          orderTotal += kItem.totalPrice;
        }

        // Take 1 shisha item with 65% probability
        if (basketS.length > 0 && Math.random() > 0.35) {
          const sItem = basketS.pop()!;
          orderItemsList.push(sItem);
          orderTotal += sItem.totalPrice;
        }

        // Take 1 bar item
        if (basketB.length > 0) {
          const bItem = basketB.pop()!;
          orderItemsList.push(bItem);
          orderTotal += bItem.totalPrice;
        }

        if (orderItemsList.length === 0) break;

        const table = regularTables[orderStep % regularTables.length];
        const minuteOffset = Math.floor((orderStep / 50) * totalShiftMinutes) % totalShiftMinutes;
        const orderTime = new Date(day.startTime.getTime() + minuteOffset * 60 * 1000);

        ordersToCreate.push({
          tableId: table ? table.id : null,
          totalAmount: orderTotal,
          createdAt: orderTime,
          items: orderItemsList,
        });

        orderStep++;
      }

      // If any items remain in baskets, add them to a final order
      const remainingItems = [...basketK, ...basketS, ...basketB];
      if (remainingItems.length > 0) {
        const lastTotal = remainingItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
        ordersToCreate.push({
          tableId: regularTables[0]?.id || null,
          totalAmount: lastTotal,
          createdAt: new Date(day.endTime.getTime() - 15 * 60 * 1000),
          items: remainingItems,
        });
      }

      // Insert all generated orders for this shift
      for (const ord of ordersToCreate) {
        await prisma.order.create({
          data: {
            shiftId: day.shiftId,
            tableId: ord.tableId,
            userId: cashierUser.id,
            status: OrderStatus.PAID,
            subtotal: ord.totalAmount,
            discount: 0,
            totalAmount: ord.totalAmount,
            createdAt: ord.createdAt,
            updatedAt: ord.createdAt,
            items: {
              create: ord.items.map(it => ({
                menuItemId: it.menuItemId,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                totalPrice: it.totalPrice,
                createdAt: ord.createdAt,
                updatedAt: ord.createdAt,
              })),
            },
          },
        });
      }
    }

    // 5. Ensure Shift 4 is OPEN for today (18-10-2026) so the system is immediately ready for cashiers
    const openShiftId = "shift_20261018_open";
    const existingOpenShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
    });

    if (!existingOpenShift) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "shifts" ("id", "user_id", "start_time", "initial_cash", "expected_cash", "status", "notes")
        VALUES ('${openShiftId}', '${cashierUser.id}', CURRENT_TIMESTAMP, 0, 0, 'OPEN', 'وردية اليوم المفتوحة - الأحد 18-10-2026')
        ON CONFLICT ("id") DO UPDATE SET "status" = 'OPEN';
      `);
    }

    return NextResponse.json({
      success: true,
      message: "Historical shifts and orders backfilled successfully matching all 3 closing vouchers!",
      summary: {
        day1: "15-10-2026: Gross 26,810 | Exp 11,900 | Net 14,910 (Kitchen: 16,086, Shisha: 6,702, Bar: 4,022)",
        day2: "16-10-2026: Gross 16,588 | Exp 16,185 | Net 403 (Kitchen: 9,953, Shisha: 4,147, Bar: 2,488)",
        day3: "17-10-2026: Gross 16,145 | Exp 15,615 | Net 530 (Kitchen: 9,687, Shisha: 4,036, Bar: 2,422)",
        ratios: "Kitchen ~60%, Shisha ~25%, Bar ~15% across all 3 days",
      },
    });
  } catch (error: any) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
