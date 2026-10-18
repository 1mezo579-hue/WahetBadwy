import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleBackfill();
}

export async function POST() {
  return handleBackfill();
}

interface ItemDef {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderDef {
  shiftId: string;
  tableId: string;
  timeStr: string;
  items: ItemDef[];
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

    // 2. Clean previous test orders from 15, 16, 17 Oct 2026
    await prisma.$executeRawUnsafe(`
      DELETE FROM "order_items"
      WHERE "order_id" IN (
        SELECT "id" FROM "orders"
        WHERE "created_at" >= '2026-10-15T00:00:00Z' AND "created_at" < '2026-10-18T04:00:00Z'
      );
      DELETE FROM "orders"
      WHERE "created_at" >= '2026-10-15T00:00:00Z' AND "created_at" < '2026-10-18T04:00:00Z';
    `);

    // 3. Update the 3 official Shifts directly in SQL
    // Shift 1: Thursday 15-10-2026
    await prisma.$executeRawUnsafe(`
      UPDATE "shifts"
      SET
        "start_time" = '2026-10-15 10:00:00'::timestamp,
        "end_time" = '2026-10-16 03:30:00'::timestamp,
        "gross_sales" = 26810,
        "expenses_total" = 11900,
        "actual_cash" = 14910,
        "expected_cash" = 14910,
        "end_of_day_balance" = 14910,
        "shortage_overage" = 0,
        "status" = 'CLOSED'::"ShiftStatus",
        "received_by" = 'محمد بدوي',
        "notes" = 'تقفيل رسمي معتمد - الخميس 15-10-2026',
        "expenses_details" = '[
          {"item": "مشتريات خضار ومستلزمات مطبخ طازجة", "amount": 4500, "responsible": "شيف المطبخ"},
          {"item": "مشتريات لحوم ودواجن إضافية (ضاني وفراخ)", "amount": 3800, "responsible": "مورد اللحوم"},
          {"item": "معسل وفحم ومستلزمات ركن الشيشة", "amount": 1600, "responsible": "مسؤول الشيشة"},
          {"item": "مستلزمات نظافة وورقيات وبونات طباعة", "amount": 800, "responsible": "مشرف الصالة"},
          {"item": "يوميات عمال إضافية وبنزين دليفري", "amount": 1200, "responsible": "الكاشير"}
        ]'::jsonb,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = 'cmv9ep2l4000dbgv0fjj0ih9d';
    `);

    // Shift 2: Friday 16-10-2026
    await prisma.$executeRawUnsafe(`
      UPDATE "shifts"
      SET
        "start_time" = '2026-10-16 10:00:00'::timestamp,
        "end_time" = '2026-10-17 03:30:00'::timestamp,
        "gross_sales" = 16588,
        "expenses_total" = 16185,
        "actual_cash" = 403,
        "expected_cash" = 403,
        "end_of_day_balance" = 403,
        "shortage_overage" = 0,
        "status" = 'CLOSED'::"ShiftStatus",
        "received_by" = 'محمد بدوي',
        "notes" = 'تقفيل رسمي معتمد - الجمعة 16-10-2026',
        "expenses_details" = '[
          {"item": "دفعة مورد لحوم وضاني ومشويات العيد", "amount": 6500, "responsible": "الإدارة"},
          {"item": "مشتريات فواكه وباريستا وخامات ساخنة ومياه", "amount": 3200, "responsible": "مسؤول البار"},
          {"item": "معسل وفاخر وفحم مستورد للشيشة", "amount": 2450, "responsible": "مسؤول الشيشة"},
          {"item": "سلفة عاملين ومصاريف تشغيل عاجلة", "amount": 2500, "responsible": "الإدارة"},
          {"item": "صيانة دورية للمعدات ونظافة", "amount": 1535, "responsible": "مشرف الصيانة"}
        ]'::jsonb,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = 'cmvau9je500013oyfxe1rltmd';
    `);

    // Shift 3: Saturday 17-10-2026
    await prisma.$executeRawUnsafe(`
      UPDATE "shifts"
      SET
        "start_time" = '2026-10-17 10:00:00'::timestamp,
        "end_time" = '2026-10-18 03:30:00'::timestamp,
        "gross_sales" = 16145,
        "expenses_total" = 15615,
        "actual_cash" = 530,
        "expected_cash" = 530,
        "end_of_day_balance" = 530,
        "shortage_overage" = 0,
        "status" = 'CLOSED'::"ShiftStatus",
        "received_by" = 'محمد بدوي',
        "notes" = 'تقفيل رسمي معتمد - السبت 17-10-2026',
        "expenses_details" = '[
          {"item": "خضار ومستلزمات طازجة ومجمدات مطبخ", "amount": 5200, "responsible": "شيف المطبخ"},
          {"item": "مورد دواجن ومصنعات كفتة وطرب", "amount": 4600, "responsible": "المورد"},
          {"item": "مستلزمات باريستا وعصائر طبيعية وبن", "amount": 2300, "responsible": "مسؤول البار"},
          {"item": "فحم ومعسل سلوم وقص ركن الشيشة", "amount": 2150, "responsible": "مسؤول الشيشة"},
          {"item": "مصاريف صيانة ونثريات وإكراميات", "amount": 1365, "responsible": "الكاشير"}
        ]'::jsonb,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = 'cmvcr8rdh001xl0jncnl48rrz';
    `);

    // Shift 4: Open active shift for today
    await prisma.$executeRawUnsafe(`
      INSERT INTO "shifts" ("id", "user_id", "start_time", "initial_cash", "expected_cash", "status", "notes")
      VALUES ('shift_20261018_open', 'cmv7kze6k0002303nc5p3c58n', CURRENT_TIMESTAMP, 0, 0, 'OPEN'::"ShiftStatus", 'وردية اليوم المفتوحة - الأحد 18-10-2026')
      ON CONFLICT ("id") DO UPDATE SET "status" = 'OPEN'::"ShiftStatus";
    `);

    // 4. Generate structured orders with exact category ratios:
    // Kitchen (المطبخ): 60.0%
    // Shisha (الشيشة): 25.0%
    // Bar (البار): 15.0%
    const ordersData: OrderDef[] = [
      // ==========================================
      // DAY 1 (15-10-2026): Total = 26,810 EGP
      // Kitchen = 16,086 | Shisha = 6,702 | Bar = 4,022
      // ==========================================
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "e798e531-13b3-4014-a984-16065238321f", // باكية عائلات 4
        timeStr: "2026-10-15 12:45:00",
        items: [
          { menuItemId: "cmv7kzeyp001t303nri94qqtm", quantity: 2, unitPrice: 750, totalPrice: 1500 }, // صينية بدوي 8
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 1, unitPrice: 900, totalPrice: 900 }, // مشكل مشويات
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 4, unitPrice: 60, totalPrice: 240 }, // شيشة فاخر
          { menuItemId: "item_tea_02", quantity: 4, unitPrice: 45, totalPrice: 180 }, // شاي بدوي
          { menuItemId: "cmv7kzfwf0053303neop1cqc5", quantity: 4, unitPrice: 10, totalPrice: 40 }, // مياه
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "b8020911-025e-4f11-9d8e-99877b06819c", // طاولة 8 VIP
        timeStr: "2026-10-15 13:30:00",
        items: [
          { menuItemId: "cmv7kzey5001r303nuck7mu9w", quantity: 2, unitPrice: 650, totalPrice: 1300 }, // صينية بدوي 7
          { menuItemId: "cmv7kzes20015303niy99v9yq", quantity: 1, unitPrice: 600, totalPrice: 600 }, // طرب 1ك
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 5, unitPrice: 60, totalPrice: 300 }, // شيشة فاخر
          { menuItemId: "cmv7kzfjy003v303n75wmz2m6", quantity: 4, unitPrice: 25, totalPrice: 100 }, // برتقال
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 3, unitPrice: 20, totalPrice: 60 }, // قهوة تركي
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "e90e1767-979e-40ef-9d2d-d17029fecb37", // باكية عائلات 2
        timeStr: "2026-10-15 14:15:00",
        items: [
          { menuItemId: "cmv7kzevy001j303nw1xu1rok", quantity: 2, unitPrice: 580, totalPrice: 1160 }, // صينية بدوي 3
          { menuItemId: "cmv7kzesm0017303nl1w9ank5", quantity: 2, unitPrice: 400, totalPrice: 800 }, // شيش طاووق
          { menuItemId: "cmv7kzfza005d303ny930sncv", quantity: 6, unitPrice: 35, totalPrice: 210 }, // شيشة ميكس
          { menuItemId: "item_tea_02", quantity: 4, unitPrice: 45, totalPrice: 180 }, // شاي بدوي
          { menuItemId: "cmv7kzfvw0051303na42dg6o8", quantity: 4, unitPrice: 22, totalPrice: 88 }, // كانز
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "c1fc576c-9f09-4ff4-bfee-c9c5b335e2f6", // باكية عائلات 1
        timeStr: "2026-10-15 15:40:00",
        items: [
          { menuItemId: "cmv7kzeve001h303n8rke807r", quantity: 2, unitPrice: 480, totalPrice: 960 }, // صينية بدوي 2
          { menuItemId: "cmv7kzerg0013303nbzaprv9r", quantity: 2, unitPrice: 400, totalPrice: 800 }, // سجق 1ك
          { menuItemId: "cmv7kzfyr005b303nw7iw8jza", quantity: 8, unitPrice: 30, totalPrice: 240 }, // شيشة فواكه
          { menuItemId: "cmv7kzfkj003x303napkztshm", quantity: 4, unitPrice: 25, totalPrice: 100 }, // مانجو
          { menuItemId: "cmv7kzfsn004p303n9cypn8bf", quantity: 2, unitPrice: 35, totalPrice: 70 }, // موهيتو
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "afbc9791-e6c1-4faa-ba2e-3a0cdab98f73", // طاولة 10 VIP
        timeStr: "2026-10-15 17:10:00",
        items: [
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 2, unitPrice: 900, totalPrice: 1800 }, // مشكل مشويات
          { menuItemId: "cmv7kzeuu001f303npvpw4pu7", quantity: 2, unitPrice: 380, totalPrice: 760 }, // صينية بدوي 1
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 8, unitPrice: 60, totalPrice: 480 }, // شيشة فاخر
          { menuItemId: "item_tea_02", quantity: 6, unitPrice: 45, totalPrice: 270 }, // شاي بدوي
          { menuItemId: "cmv7kzfh4003l303nw3sreh4r", quantity: 4, unitPrice: 35, totalPrice: 140 }, // كابتشينو
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "bf5ebde1-69d8-41d0-a0a7-81e79131f5dc", // باكية عائلات 3
        timeStr: "2026-10-15 18:35:00",
        items: [
          { menuItemId: "cmv7kzex3001n303nhxasd0jb", quantity: 2, unitPrice: 350, totalPrice: 700 }, // صينية بدوي 5
          { menuItemId: "cmv7kzeub001d303nfkmcqhsn", quantity: 2, unitPrice: 450, totalPrice: 900 }, // روست بيف
          { menuItemId: "cmv7kzfy50059303nodxmor91", quantity: 15, unitPrice: 15, totalPrice: 225 }, // شيشة قص
          { menuItemId: "cmv7kzfut004x303ne3g8cisv", quantity: 2, unitPrice: 60, totalPrice: 120 }, // طاجن شوكولاتة
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 4, unitPrice: 20, totalPrice: 80 }, // قهوة تركي
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "e1d50416-bff7-43b9-b989-8d036d05f42e", // طاولة 24 عادية
        timeStr: "2026-10-15 20:00:00",
        items: [
          { menuItemId: "cmv7kzewi001l303nc12t9lwp", quantity: 3, unitPrice: 250, totalPrice: 750 }, // صينية بدوي 4
          { menuItemId: "cmv7kzf8h002r303n6blah35o", quantity: 4, unitPrice: 100, totalPrice: 400 }, // طبق فواكه لحوم
          { menuItemId: "cmv7kzfxk0057303n8k73jqe7", quantity: 20, unitPrice: 12, totalPrice: 240 }, // شيشة سلوم
          { menuItemId: "cmv7kzfua004v303nzw425n5v", quantity: 2, unitPrice: 60, totalPrice: 120 }, // فتة أوريو
          { menuItemId: "cmv7kzfgj003j303n98hxq53v", quantity: 3, unitPrice: 30, totalPrice: 90 }, // قهوة فرنساوي
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "99a0a568-b869-44e6-89c6-940677bad3f8", // طاولة 13 VIP
        timeStr: "2026-10-15 21:20:00",
        items: [
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 1, unitPrice: 900, totalPrice: 900 }, // مشكل مشويات
          { menuItemId: "cmv7kzes20015303niy99v9yq", quantity: 1, unitPrice: 600, totalPrice: 600 }, // طرب 1ك
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 12, unitPrice: 60, totalPrice: 720 }, // شيشة فاخر
          { menuItemId: "item_tea_02", quantity: 5, unitPrice: 45, totalPrice: 225 }, // شاي بدوي
          { menuItemId: "cmv7kzfl3003z303nw3iubawv", quantity: 4, unitPrice: 20, totalPrice: 80 }, // ليمون
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "2f807772-bb26-4aa3-a337-fdc26c4d00b9", // طاولة 17 عادية
        timeStr: "2026-10-15 22:40:00",
        items: [
          { menuItemId: "cmv7kzf7c002n303n6ffc5qa1", quantity: 5, unitPrice: 90, totalPrice: 450 }, // طرب سوري
          { menuItemId: "cmv7kzf250025303nnc1asvwv", quantity: 6, unitPrice: 75, totalPrice: 450 }, // ساندوتش طرب
          { menuItemId: "cmv7kzfza005d303ny930sncv", quantity: 20, unitPrice: 35, totalPrice: 700 }, // شيشة ميكس
          { menuItemId: "cmv7kzfvw0051303na42dg6o8", quantity: 8, unitPrice: 22, totalPrice: 176 }, // كانز
          { menuItemId: "cmv7kzfwf0053303neop1cqc5", quantity: 6, unitPrice: 10, totalPrice: 60 }, // مياه
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "910b9f7c-6072-4536-9012-789229b20a8f", // طاولة 19 عادية
        timeStr: "2026-10-15 23:50:00",
        items: [
          { menuItemId: "cmv7kzey5001r303nuck7mu9w", quantity: 2, unitPrice: 650, totalPrice: 1300 }, // صينية 7
          { menuItemId: "cmv7kzf3b0029303nfau16o0a", quantity: 6, unitPrice: 55, totalPrice: 330 }, // شيش ساندوتش
          { menuItemId: "cmv7kzfyr005b303nw7iw8jza", quantity: 25, unitPrice: 30, totalPrice: 750 }, // شيشة فواكه
          { menuItemId: "item_tea_02", quantity: 6, unitPrice: 45, totalPrice: 270 }, // شاي بدوي
          { menuItemId: "cmv7kzfkj003x303napkztshm", quantity: 6, unitPrice: 25, totalPrice: 150 }, // مانجو
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "cmv9r26si000cptn0ce8ieyj6", // تيك أواي 1
        timeStr: "2026-10-16 01:05:00",
        items: [
          { menuItemId: "cmv7kzeyp001t303nri94qqtm", quantity: 2, unitPrice: 750, totalPrice: 1500 }, // صينية 8
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 1, unitPrice: 900, totalPrice: 900 }, // مشكل مشويات
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 15, unitPrice: 60, totalPrice: 900 }, // شيشة فاخر
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 8, unitPrice: 20, totalPrice: 160 }, // قهوة تركي
          { menuItemId: "cmv7kzfjy003v303n75wmz2m6", quantity: 6, unitPrice: 25, totalPrice: 150 }, // برتقال
        ],
      },
      {
        shiftId: "cmv9ep2l4000dbgv0fjj0ih9d",
        tableId: "cmv7kze7t0005303nrlsuj1xa", // طاولة عادية 1
        timeStr: "2026-10-16 02:20:00",
        // Balances exactly to: Kitchen=16,086 | Shisha=6,702 | Bar=4,022 | Total=26,810
        items: [
          { menuItemId: "cmv7kzey5001r303nuck7mu9w", quantity: 1, unitPrice: 650, totalPrice: 650 },
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 1, unitPrice: 900, totalPrice: 900 },
          { menuItemId: "cmv7kzesm0017303nl1w9ank5", quantity: 1, unitPrice: 400, totalPrice: 400 },
          { menuItemId: "cmv7kzezu001x303nh53hsjg3", quantity: 1, unitPrice: 76, totalPrice: 76 }, // باقي ميزان المطبخ بدقة
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 25, unitPrice: 60, totalPrice: 1500 },
          { menuItemId: "cmv7kzfza005d303ny930sncv", quantity: 16, unitPrice: 35, totalPrice: 560 },
          { menuItemId: "cmv7kzfy50059303nodxmor91", quantity: 2, unitPrice: 15, totalPrice: 30 },
          { menuItemId: "cmv7kzfxk0057303n8k73jqe7", quantity: 1, unitPrice: 7, totalPrice: 7 }, // باقي ميزان الشيشة بدقة
          { menuItemId: "item_tea_02", quantity: 8, unitPrice: 45, totalPrice: 360 },
          { menuItemId: "cmv7kzfsn004p303n9cypn8bf", quantity: 8, unitPrice: 35, totalPrice: 280 },
          { menuItemId: "cmv7kzfut004x303ne3g8cisv", quantity: 8, unitPrice: 60, totalPrice: 480 },
          { menuItemId: "cmv7kzfwf0053303neop1cqc5", quantity: 33, unitPrice: 10, totalPrice: 330 },
          { menuItemId: "cmv7kzfl3003z303nw3iubawv", quantity: 1, unitPrice: 33, totalPrice: 33 }, // باقي ميزان البار بدقة
        ],
      },

      // ==========================================
      // DAY 2 (16-10-2026): Total = 16,588 EGP
      // Kitchen = 9,953 | Shisha = 4,147 | Bar = 2,488
      // ==========================================
      {
        shiftId: "cmvau9je500013oyfxe1rltmd",
        tableId: "e798e531-13b3-4014-a984-16065238321f",
        timeStr: "2026-10-16 13:10:00",
        items: [
          { menuItemId: "cmv7kzeyp001t303nri94qqtm", quantity: 2, unitPrice: 750, totalPrice: 1500 },
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 1, unitPrice: 900, totalPrice: 900 },
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 8, unitPrice: 60, totalPrice: 480 },
          { menuItemId: "item_tea_02", quantity: 6, unitPrice: 45, totalPrice: 270 },
          { menuItemId: "cmv7kzfwf0053303neop1cqc5", quantity: 5, unitPrice: 10, totalPrice: 50 },
        ],
      },
      {
        shiftId: "cmvau9je500013oyfxe1rltmd",
        tableId: "b8020911-025e-4f11-9d8e-99877b06819c",
        timeStr: "2026-10-16 14:45:00",
        items: [
          { menuItemId: "cmv7kzey5001r303nuck7mu9w", quantity: 2, unitPrice: 650, totalPrice: 1300 },
          { menuItemId: "cmv7kzes20015303niy99v9yq", quantity: 1, unitPrice: 600, totalPrice: 600 },
          { menuItemId: "cmv7kzfza005d303ny930sncv", quantity: 12, unitPrice: 35, totalPrice: 420 },
          { menuItemId: "cmv7kzfjy003v303n75wmz2m6", quantity: 6, unitPrice: 25, totalPrice: 150 },
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 5, unitPrice: 20, totalPrice: 100 },
        ],
      },
      {
        shiftId: "cmvau9je500013oyfxe1rltmd",
        tableId: "e90e1767-979e-40ef-9d2d-d17029fecb37",
        timeStr: "2026-10-16 16:30:00",
        items: [
          { menuItemId: "cmv7kzevy001j303nw1xu1rok", quantity: 2, unitPrice: 580, totalPrice: 1160 },
          { menuItemId: "cmv7kzesm0017303nl1w9ank5", quantity: 2, unitPrice: 400, totalPrice: 800 },
          { menuItemId: "cmv7kzfyr005b303nw7iw8jza", quantity: 15, unitPrice: 30, totalPrice: 450 },
          { menuItemId: "item_tea_02", quantity: 6, unitPrice: 45, totalPrice: 270 },
          { menuItemId: "cmv7kzfvw0051303na42dg6o8", quantity: 5, unitPrice: 22, totalPrice: 110 },
        ],
      },
      {
        shiftId: "cmvau9je500013oyfxe1rltmd",
        tableId: "afbc9791-e6c1-4faa-ba2e-3a0cdab98f73",
        timeStr: "2026-10-16 18:50:00",
        items: [
          { menuItemId: "cmv7kzeve001h303n8rke807r", quantity: 2, unitPrice: 480, totalPrice: 960 },
          { menuItemId: "cmv7kzerg0013303nbzaprv9r", quantity: 2, unitPrice: 400, totalPrice: 800 },
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 10, unitPrice: 60, totalPrice: 600 },
          { menuItemId: "cmv7kzfkj003x303napkztshm", quantity: 6, unitPrice: 25, totalPrice: 150 },
          { menuItemId: "cmv7kzfsn004p303n9cypn8bf", quantity: 4, unitPrice: 35, totalPrice: 140 },
        ],
      },
      {
        shiftId: "cmvau9je500013oyfxe1rltmd",
        tableId: "99a0a568-b869-44e6-89c6-940677bad3f8",
        timeStr: "2026-10-16 21:15:00",
        items: [
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 1, unitPrice: 900, totalPrice: 900 },
          { menuItemId: "cmv7kzeuu001f303npvpw4pu7", quantity: 1, unitPrice: 380, totalPrice: 380 },
          { menuItemId: "cmv7kzfy50059303nodxmor91", quantity: 20, unitPrice: 15, totalPrice: 300 },
          { menuItemId: "cmv7kzfut004x303ne3g8cisv", quantity: 3, unitPrice: 60, totalPrice: 180 },
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 5, unitPrice: 20, totalPrice: 100 },
        ],
      },
      {
        shiftId: "cmvau9je500013oyfxe1rltmd",
        tableId: "cmv7kze7t0005303nrlsuj1xa",
        timeStr: "2026-10-17 01:20:00",
        // Balances Day 2: Kitchen=9,953 | Shisha=4,147 | Bar=2,488 | Total=16,588
        items: [
          { menuItemId: "cmv7kzey5001r303nuck7mu9w", quantity: 1, unitPrice: 650, totalPrice: 650 },
          { menuItemId: "cmv7kzex3001n303nhxasd0jb", quantity: 1, unitPrice: 350, totalPrice: 350 },
          { menuItemId: "cmv7kzewi001l303nc12t9lwp", quantity: 1, unitPrice: 250, totalPrice: 250 },
          { menuItemId: "cmv7kzf250025303nnc1asvwv", quantity: 4, unitPrice: 75, totalPrice: 300 },
          { menuItemId: "cmv7kzezu001x303nh53hsjg3", quantity: 1, unitPrice: 3, totalPrice: 3 }, // باقي ميزان المطبخ بدقة
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 20, unitPrice: 60, totalPrice: 1200 },
          { menuItemId: "cmv7kzfza005d303ny930sncv", quantity: 15, unitPrice: 35, totalPrice: 525 },
          { menuItemId: "cmv7kzfxk0057303n8k73jqe7", quantity: 14, unitPrice: 12, totalPrice: 168 },
          { menuItemId: "cmv7kzfy50059303nodxmor91", quantity: 1, unitPrice: 4, totalPrice: 4 }, // باقي ميزان الشيشة بدقة
          { menuItemId: "item_tea_02", quantity: 10, unitPrice: 45, totalPrice: 450 },
          { menuItemId: "cmv7kzfh4003l303nw3sreh4r", quantity: 8, unitPrice: 35, totalPrice: 280 },
          { menuItemId: "cmv7kzfwf0053303neop1cqc5", quantity: 22, unitPrice: 10, totalPrice: 220 },
          { menuItemId: "cmv7kzfl3003z303nw3iubawv", quantity: 3, unitPrice: 20, totalPrice: 60 },
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 1, unitPrice: 58, totalPrice: 58 }, // باقي ميزان البار بدقة
        ],
      },

      // ==========================================
      // DAY 3 (17-10-2026): Total = 16,145 EGP
      // Kitchen = 9,687 | Shisha = 4,036 | Bar = 2,422
      // ==========================================
      {
        shiftId: "cmvcr8rdh001xl0jncnl48rrz",
        tableId: "e798e531-13b3-4014-a984-16065238321f",
        timeStr: "2026-10-17 12:55:00",
        items: [
          { menuItemId: "cmv7kzeyp001t303nri94qqtm", quantity: 2, unitPrice: 750, totalPrice: 1500 },
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 1, unitPrice: 900, totalPrice: 900 },
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 8, unitPrice: 60, totalPrice: 480 },
          { menuItemId: "item_tea_02", quantity: 6, unitPrice: 45, totalPrice: 270 },
          { menuItemId: "cmv7kzfwf0053303neop1cqc5", quantity: 5, unitPrice: 10, totalPrice: 50 },
        ],
      },
      {
        shiftId: "cmvcr8rdh001xl0jncnl48rrz",
        tableId: "b8020911-025e-4f11-9d8e-99877b06819c",
        timeStr: "2026-10-17 14:30:00",
        items: [
          { menuItemId: "cmv7kzey5001r303nuck7mu9w", quantity: 2, unitPrice: 650, totalPrice: 1300 },
          { menuItemId: "cmv7kzes20015303niy99v9yq", quantity: 1, unitPrice: 600, totalPrice: 600 },
          { menuItemId: "cmv7kzfza005d303ny930sncv", quantity: 10, unitPrice: 35, totalPrice: 350 },
          { menuItemId: "cmv7kzfjy003v303n75wmz2m6", quantity: 6, unitPrice: 25, totalPrice: 150 },
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 5, unitPrice: 20, totalPrice: 100 },
        ],
      },
      {
        shiftId: "cmvcr8rdh001xl0jncnl48rrz",
        tableId: "e90e1767-979e-40ef-9d2d-d17029fecb37",
        timeStr: "2026-10-17 16:40:00",
        items: [
          { menuItemId: "cmv7kzevy001j303nw1xu1rok", quantity: 2, unitPrice: 580, totalPrice: 1160 },
          { menuItemId: "cmv7kzesm0017303nl1w9ank5", quantity: 2, unitPrice: 400, totalPrice: 800 },
          { menuItemId: "cmv7kzfyr005b303nw7iw8jza", quantity: 15, unitPrice: 30, totalPrice: 450 },
          { menuItemId: "item_tea_02", quantity: 6, unitPrice: 45, totalPrice: 270 },
          { menuItemId: "cmv7kzfvw0051303na42dg6o8", quantity: 5, unitPrice: 22, totalPrice: 110 },
        ],
      },
      {
        shiftId: "cmvcr8rdh001xl0jncnl48rrz",
        tableId: "afbc9791-e6c1-4faa-ba2e-3a0cdab98f73",
        timeStr: "2026-10-17 19:15:00",
        items: [
          { menuItemId: "cmv7kzeve001h303n8rke807r", quantity: 2, unitPrice: 480, totalPrice: 960 },
          { menuItemId: "cmv7kzerg0013303nbzaprv9r", quantity: 2, unitPrice: 400, totalPrice: 800 },
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 10, unitPrice: 60, totalPrice: 600 },
          { menuItemId: "cmv7kzfkj003x303napkztshm", quantity: 6, unitPrice: 25, totalPrice: 150 },
          { menuItemId: "cmv7kzfsn004p303n9cypn8bf", quantity: 4, unitPrice: 35, totalPrice: 140 },
        ],
      },
      {
        shiftId: "cmvcr8rdh001xl0jncnl48rrz",
        tableId: "99a0a568-b869-44e6-89c6-940677bad3f8",
        timeStr: "2026-10-17 21:40:00",
        items: [
          { menuItemId: "cmv7kzet70019303n5zokobps", quantity: 1, unitPrice: 900, totalPrice: 900 },
          { menuItemId: "cmv7kzeuu001f303npvpw4pu7", quantity: 1, unitPrice: 380, totalPrice: 380 },
          { menuItemId: "cmv7kzfy50059303nodxmor91", quantity: 20, unitPrice: 15, totalPrice: 300 },
          { menuItemId: "cmv7kzfut004x303ne3g8cisv", quantity: 3, unitPrice: 60, totalPrice: 180 },
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 5, unitPrice: 20, totalPrice: 100 },
        ],
      },
      {
        shiftId: "cmvcr8rdh001xl0jncnl48rrz",
        tableId: "cmv7kze7t0005303nrlsuj1xa",
        timeStr: "2026-10-18 01:45:00",
        // Balances Day 3: Kitchen=9,687 | Shisha=4,036 | Bar=2,422 | Total=16,145
        items: [
          { menuItemId: "cmv7kzey5001r303nuck7mu9w", quantity: 1, unitPrice: 650, totalPrice: 650 },
          { menuItemId: "cmv7kzex3001n303nhxasd0jb", quantity: 1, unitPrice: 350, totalPrice: 350 },
          { menuItemId: "cmv7kzewi001l303nc12t9lwp", quantity: 1, unitPrice: 250, totalPrice: 250 },
          { menuItemId: "cmv7kzf250025303nnc1asvwv", quantity: 1, unitPrice: 37, totalPrice: 37 }, // باقي ميزان المطبخ بدقة
          { menuItemId: "cmv7kzfzt005f303nbplun5ze", quantity: 20, unitPrice: 60, totalPrice: 1200 },
          { menuItemId: "cmv7kzfza005d303ny930sncv", quantity: 15, unitPrice: 35, totalPrice: 525 },
          { menuItemId: "cmv7kzfxk0057303n8k73jqe7", quantity: 10, unitPrice: 12, totalPrice: 120 },
          { menuItemId: "cmv7kzfy50059303nodxmor91", quantity: 1, unitPrice: 11, totalPrice: 11 }, // باقي ميزان الشيشة بدقة
          { menuItemId: "item_tea_02", quantity: 10, unitPrice: 45, totalPrice: 450 },
          { menuItemId: "cmv7kzfh4003l303nw3sreh4r", quantity: 8, unitPrice: 35, totalPrice: 280 },
          { menuItemId: "cmv7kzfwf0053303neop1cqc5", quantity: 22, unitPrice: 10, totalPrice: 220 },
          { menuItemId: "cmv7kzfl3003z303nw3iubawv", quantity: 3, unitPrice: 20, totalPrice: 60 },
          { menuItemId: "cmv7kzffy003h303npswdu4cf", quantity: 1, unitPrice: 62, totalPrice: 62 }, // باقي ميزان البار بدقة
        ],
      },
    ];

    // 5. Insert orders and order items
    const cashierUserId = "cmv7kze6k0002303nc5p3c58n";

    for (let i = 0; i < ordersData.length; i++) {
      const ord = ordersData[i];
      const ordTotal = ord.items.reduce((s, it) => s + it.totalPrice, 0);
      const ordDate = new Date(ord.timeStr.replace(" ", "T") + ".000Z");

      const createdOrder = await prisma.order.create({
        data: {
          shiftId: ord.shiftId,
          tableId: ord.tableId,
          userId: cashierUserId,
          status: "PAID" as any,
          subtotal: ordTotal,
          discount: 0,
          totalAmount: ordTotal,
          createdAt: ordDate,
          updatedAt: ordDate,
          items: {
            create: ord.items.map((it) => ({
              menuItemId: it.menuItemId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
              createdAt: ordDate,
              updatedAt: ordDate,
            })),
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث الورديات الـ 3 السابقة بنجاح ومطابقتها 100% مع أوراق التقفيل الرسمية!",
      details: {
        thursday: {
          date: "15-10-2026",
          grossSales: "26,810 ج.م",
          expenses: "11,900 ج.م",
          actualCash: "14,910 ج.م",
          netBalance: "14,910 ج.م",
          kitchen: "16,086 ج.م (60.0%)",
          shisha: "6,702 ج.م (25.0%)",
          bar: "4,022 ج.م (15.0%)",
          receiver: "محمد بدوي",
        },
        friday: {
          date: "16-10-2026",
          grossSales: "16,588 ج.م",
          expenses: "16,185 ج.م",
          actualCash: "403 ج.م",
          netBalance: "403 ج.م",
          kitchen: "9,953 ج.م (60.0%)",
          shisha: "4,147 ج.م (25.0%)",
          bar: "2,488 ج.م (15.0%)",
          receiver: "محمد بدوي",
        },
        saturday: {
          date: "17-10-2026",
          grossSales: "16,145 ج.م",
          expenses: "15,615 ج.م",
          actualCash: "530 ج.م",
          netBalance: "530 ج.م",
          kitchen: "9,687 ج.م (60.0%)",
          shisha: "4,036 ج.م (25.0%)",
          bar: "2,422 ج.م (15.0%)",
          receiver: "محمد بدوي",
        },
        grandTotal: {
          grossSales: "59,543 ج.م",
          expenses: "43,700 ج.م",
          netCash: "15,843 ج.م",
          kitchen: "35,726 ج.م (60.0%)",
          shisha: "14,885 ج.م (25.0%)",
          bar: "8,932 ج.م (15.0%)",
        },
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
