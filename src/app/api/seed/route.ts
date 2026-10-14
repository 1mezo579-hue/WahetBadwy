import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  Role,
  TableType,
  TableStatus,
  EquipmentType,
  EquipmentStatus,
  UnitType,
} from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST() {
  return GET();
}

export async function GET() {
  try {
    // 0. Database Migrations (Sprint 5 & Delivery/Takeaway/Customers)
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    } catch (e) {
      console.warn("ShiftStatus enum note:", e);
    }

    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
    } catch (e) {
      console.warn("OrderType enum note:", e);
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "shifts" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "shift_number" SERIAL NOT NULL,
          "user_id" TEXT NOT NULL,
          "start_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "end_time" TIMESTAMP(3),
          "initial_cash" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "expected_cash" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "actual_cash" DOUBLE PRECISION,
          "shortage_overage" DOUBLE PRECISION,
          "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
          "notes" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      console.warn("shifts table creation note:", e);
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "customers" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "phone" TEXT NOT NULL UNIQUE,
          "address" TEXT,
          "notes" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        step: "customers table creation",
        error: e?.message || String(e),
      }, { status: 500 });
    }

    const alterStatements = [
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shift_id" TEXT REFERENCES "shifts"("id") ON UPDATE CASCADE;`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_type" "OrderType" NOT NULL DEFAULT 'DINE_IN';`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" TEXT REFERENCES "customers"("id") ON UPDATE CASCADE;`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_name" TEXT;`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_phone" TEXT;`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_address" TEXT;`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_fee" DOUBLE PRECISION NOT NULL DEFAULT 0;`,
      `ALTER TABLE "orders" ALTER COLUMN "table_id" DROP NOT NULL;`,
    ];

    for (const stmt of alterStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (alterErr) {
        console.warn("Alter statement note:", alterErr);
      }
    }

    // 1. Seed Users (Admin, Manager, Cashier 1, Cashier 2)
    const defaultPass = await bcrypt.hash("WahetBadawy@2026", 12);
    const cashierPass = await bcrypt.hash("123456", 12);

    const admin = await prisma.user.upsert({
      where: { username: "admin" },
      update: { password: defaultPass, role: Role.ADMIN },
      create: {
        username: "admin",
        password: defaultPass,
        name: "مدير عام المنظومة",
        role: Role.ADMIN,
        active: true,
      },
    });

    await prisma.user.upsert({
      where: { username: "manager" },
      update: { password: defaultPass, role: Role.MANAGER },
      create: {
        username: "manager",
        password: defaultPass,
        name: "مدير الصالة والتشغيل",
        role: Role.MANAGER,
        active: true,
      },
    });

    await prisma.user.upsert({
      where: { username: "cashier1" },
      update: { password: cashierPass, role: Role.CASHIER },
      create: {
        username: "cashier1",
        password: cashierPass,
        name: "كاشير وردية الصباح",
        role: Role.CASHIER,
        active: true,
      },
    });

    await prisma.user.upsert({
      where: { username: "cashier2" },
      update: { password: cashierPass, role: Role.CASHIER },
      create: {
        username: "cashier2",
        password: cashierPass,
        name: "كاشير وردية المساء",
        role: Role.CASHIER,
        active: true,
      },
    });

    // 2. Seed 28 Dining Tables + Dedicated Delivery & Takeaway Virtual Tables
    await prisma.diningTable.upsert({
      where: { name: "طلبات الدليفري (توصيل)" },
      update: {},
      create: {
        name: "طلبات الدليفري (توصيل)",
        number: 999,
        type: TableType.REGULAR,
        status: TableStatus.AVAILABLE,
        capacity: 99,
      },
    });

    await prisma.diningTable.upsert({
      where: { name: "طلبات التيك أواي (سفري)" },
      update: {},
      create: {
        name: "طلبات التيك أواي (سفري)",
        number: 998,
        type: TableType.REGULAR,
        status: TableStatus.AVAILABLE,
        capacity: 99,
      },
    });

    for (let i = 1; i <= 6; i++) {
      await prisma.diningTable.upsert({
        where: { name: `باكية عائلية ${i}` },
        update: {},
        create: {
          name: `باكية عائلية ${i}`,
          number: 100 + i,
          type: TableType.FAMILY_BOOTH,
          status: TableStatus.AVAILABLE,
          capacity: 8,
        },
      });
    }

    for (let i = 1; i <= 8; i++) {
      await prisma.diningTable.upsert({
        where: { name: `طاولة VIP ${i}` },
        update: {},
        create: {
          name: `طاولة VIP ${i}`,
          number: 200 + i,
          type: TableType.VIP,
          status: TableStatus.AVAILABLE,
          capacity: 6,
        },
      });
    }

    for (let i = 1; i <= 12; i++) {
      await prisma.diningTable.upsert({
        where: { name: `طاولة عادية ${i}` },
        update: {},
        create: {
          name: `طاولة عادية ${i}`,
          number: 300 + i,
          type: TableType.REGULAR,
          status: TableStatus.AVAILABLE,
          capacity: 4,
        },
      });
    }

    await prisma.diningTable.upsert({
      where: { name: "طاولة المالك (Owner Table)" },
      update: {},
      create: {
        name: "طاولة المالك (Owner Table)",
        number: 1,
        type: TableType.OWNER,
        status: TableStatus.AVAILABLE,
        capacity: 10,
      },
    });

    await prisma.diningTable.upsert({
      where: { name: "طاولة المدير (Manager Table)" },
      update: {},
      create: {
        name: "طاولة المدير (Manager Table)",
        number: 2,
        type: TableType.MANAGER,
        status: TableStatus.AVAILABLE,
        capacity: 6,
      },
    });

    // 3. Seed Equipment
    const equipmentData = [
      {
        name: "فرن مندي وحفرة تسوية برميلية",
        type: EquipmentType.KITCHEN,
        status: EquipmentStatus.OPERATIONAL,
        location: "المطبخ الرئيسي - قسم المشويات",
        notes: "صيانة أسبوعية للعوازل الحرارية",
      },
      {
        name: "شواية فحم حجري استانلس 2 متر",
        type: EquipmentType.KITCHEN,
        status: EquipmentStatus.OPERATIONAL,
        location: "المطبخ الرئيسي - قسم الفحم",
        notes: "حالة ممتازة",
      },
      {
        name: "ماكينة قهوة إسبريسو إيطالية (La Marzocco)",
        type: EquipmentType.BARISTA,
        status: EquipmentStatus.OPERATIONAL,
        location: "ركن الباريستا والمشروبات",
        notes: "فحص ضغط البخار يومياً",
      },
      {
        name: "مطحنة بن احترافية (Fiorenzato)",
        type: EquipmentType.BARISTA,
        status: EquipmentStatus.OPERATIONAL,
        location: "ركن الباريستا والمشروبات",
        notes: "معايرة درجة الطحن صباح كل وردية",
      },
    ];

    for (const eq of equipmentData) {
      const existing = await prisma.equipment.findFirst({ where: { name: eq.name } });
      if (!existing) {
        await prisma.equipment.create({ data: eq });
      }
    }

    // 4. Seed Categories matching the exact official Menu of "واحة بدوي"
    const categoriesSeed = [
      {
        id: "cat_grills_01",
        name: "Grills per KG",
        nameAr: "المشويات (بالكيلو)",
        description: "مشويات على الفحم الطبيعي طازجة يومياً",
        order: 1,
      },
      {
        id: "cat_trays_02",
        name: "Bedouin Trays",
        nameAr: "صواني بدوي",
        description: "جميع الصواني تقدم مع أرز + سلطات + عيش + مخلل",
        order: 2,
      },
      {
        id: "cat_sandwiches_03",
        name: "Charcoal Sandwiches",
        nameAr: "الساندوتشات (على الفحم)",
        description: "على الفحم (عيش بلدي أو فرنساوي)",
        order: 3,
      },
      {
        id: "cat_syrian_04",
        name: "Syrian Sandwiches",
        nameAr: "ساندوتشات سوري",
        description: "ساندوتشات سوري فاخرة بالعيش السوري المقرمش",
        order: 4,
      },
      {
        id: "cat_delicacies_05",
        name: "Meat Delicacies",
        nameAr: "حلويات اللحوم (السقط)",
        description: "حلويات لحوم بلدي طازجة أطباق وساندوتشات",
        order: 5,
      },
      {
        id: "cat_hot_drinks_06",
        name: "Hot Drinks",
        nameAr: "مشروبات ساخنة",
        description: "شاي زردة على الحطب ومشروبات عشبية ساخنة",
        order: 6,
      },
      {
        id: "cat_coffee_07",
        name: "Coffee & Barista",
        nameAr: "قهوة وباريستا",
        description: "قهوة تركي وفرنساوي وكابتشينو ولاتيه",
        order: 7,
      },
      {
        id: "cat_juices_08",
        name: "Fresh Juices & Smoothies",
        nameAr: "عصائر طبيعية وميلك شيك",
        description: "عصائر فريش، سموذي، وميلك شيك وأطباق فاكهة",
        order: 8,
      },
      {
        id: "cat_desserts_09",
        name: "Desserts & Cold Drinks",
        nameAr: "حلويات وموهيتو وغازيات",
        description: "موهيتو منعش، طواجن شوكولاتة، ومشروبات باردة",
        order: 9,
      },
      {
        id: "cat_shisha_10",
        name: "Shisha Corner",
        nameAr: "ركن الشيشة",
        description: "سلوم، قص، فواكه، وشيشة فاخر على الفحم",
        order: 10,
      },
    ];

    for (const cat of categoriesSeed) {
      await prisma.category.upsert({
        where: { id: cat.id },
        update: { nameAr: cat.nameAr, name: cat.name, description: cat.description, order: cat.order },
        create: cat,
      });
    }

    // 5. Seed Official Menu Items from the Menu Image
    const menuItemsSeed = [
      // المشويات (بالكيلو)
      { name: "Grilled Kofta 1KG", nameAr: "كفتة مشوية (ك)", price: 400, categoryId: "cat_grills_01", desc: "كفتة بلدي مشوية على الفحم" },
      { name: "Grilled Sausage 1KG", nameAr: "سجق مشوي (ك)", price: 400, categoryId: "cat_grills_01", desc: "سجق بلدي متبل على الفحم" },
      { name: "Grilled Tarb 1KG", nameAr: "طرب مشوي (ك)", price: 600, categoryId: "cat_grills_01", desc: "طرب بلدي مشوي على الفحم" },
      { name: "Shish Tawook 1KG", nameAr: "شيش طاووق (ك)", price: 400, categoryId: "cat_grills_01", desc: "شيش طاووق دجاج متبل على الفحم" },
      { name: "Mixed Grills 1KG", nameAr: "مشكل مشويات (ك)", price: 400, categoryId: "cat_grills_01", desc: "مشكل كفتة وسجق وشيش مشوي" },
      { name: "Panee 1KG", nameAr: "بانية (ك)", price: 400, categoryId: "cat_grills_01", desc: "صدور دجاج بانيه متبل ومقرمش" },
      { name: "Roast Beef 1KG", nameAr: "روز بيف (ك)", price: 450, categoryId: "cat_grills_01", desc: "روز بيف فاخر مشوي" },

      // صواني بدوي (مع أرز + سلطات + عيش + مخلل)
      { name: "Bedouin Tray 1", nameAr: "صينية بدوي 1", price: 380, categoryId: "cat_trays_02", desc: "ربع كفتة + ربع سجق + ربع شيش + طحينة + أرز وعيش ومخلل" },
      { name: "Bedouin Tray 2", nameAr: "صينية بدوي 2", price: 480, categoryId: "cat_trays_02", desc: "ربع كفتة + ربع سجق + ربع شيش + ربع فلتو + أرز وعيش ومخلل" },
      { name: "Bedouin Tray 3", nameAr: "صينية بدوي 3", price: 580, categoryId: "cat_trays_02", desc: "ربع كفتة + ربع سجق + ربع شيش + ربع فلتو + فرد حمام" },
      { name: "Bedouin Tray 4", nameAr: "صينية بدوي 4", price: 250, categoryId: "cat_trays_02", desc: "نصف مشكل من اللحوم المشوية + أرز وسلطات" },
      { name: "Bedouin Tray 5", nameAr: "صينية بدوي 5", price: 350, categoryId: "cat_trays_02", desc: "نصف مشكل + فرد حمام + أرز وسلطات وعيش" },
      { name: "Bedouin Tray 6", nameAr: "صينية بدوي 6", price: 360, categoryId: "cat_trays_02", desc: "نصف مشكل + نصف فرخة مشوية + أرز وسلطات وعيش" },
      { name: "Bedouin Tray 7", nameAr: "صينية بدوي 7", price: 650, categoryId: "cat_trays_02", desc: "كيلو مشكل + فرخة مشوية كاملة + أرز وسلطات" },
      { name: "Bedouin Tray 8", nameAr: "صينية بدوي 8", price: 750, categoryId: "cat_trays_02", desc: "كيلو مشكل + فرخة مشوية + فرد حمام + أرز وسلطات" },

      // الساندوتشات (على الفحم)
      { name: "Kofta Sandwich Small", nameAr: "ساندوتش كفتة صغير", price: 30, categoryId: "cat_sandwiches_03", desc: "كفتة على الفحم عيش بلدي أو فرنساوي" },
      { name: "Kofta Sandwich Large", nameAr: "ساندوتش كفتة كبير", price: 45, categoryId: "cat_sandwiches_03", desc: "كفتة على الفحم عيش بلدي أو فرنساوي كبير" },
      { name: "Sausage Sandwich Small", nameAr: "ساندوتش سجق صغير", price: 30, categoryId: "cat_sandwiches_03", desc: "سجق مشوي على الفحم صغير" },
      { name: "Sausage Sandwich Large", nameAr: "ساندوتش سجق كبير", price: 45, categoryId: "cat_sandwiches_03", desc: "سجق مشوي على الفحم كبير" },
      { name: "Tarb Sandwich Small", nameAr: "ساندوتش طرب صغير", price: 60, categoryId: "cat_sandwiches_03", desc: "طرب بلدي مشوي صغير" },
      { name: "Tarb Sandwich Large", nameAr: "ساندوتش طرب كبير", price: 75, categoryId: "cat_sandwiches_03", desc: "طرب بلدي مشوي كبير" },
      { name: "Shish Sandwich Small", nameAr: "ساندوتش شيش صغير", price: 45, categoryId: "cat_sandwiches_03", desc: "شيش طاووق على الفحم صغير" },
      { name: "Shish Sandwich Large", nameAr: "ساندوتش شيش كبير", price: 55, categoryId: "cat_sandwiches_03", desc: "شيش طاووق على الفحم كبير" },
      { name: "Palestinian Musakhan", nameAr: "مسخن فلسطيني", price: 65, categoryId: "cat_sandwiches_03", desc: "مسخن فلسطيني فاخر مميز" },
      { name: "Liver Sandwich Small", nameAr: "ساندوتش كبدة صغير", price: 15, categoryId: "cat_sandwiches_03", desc: "كبدة متبلة اسكندراني صغير" },
      { name: "Liver Sandwich Large", nameAr: "ساندوتش كبدة كبير", price: 20, categoryId: "cat_sandwiches_03", desc: "كبدة متبلة اسكندراني كبير" },

      // ساندوتشات سوري
      { name: "Syrian Kofta", nameAr: "كفتة سوري", price: 60, categoryId: "cat_syrian_04", desc: "كفتة على الفحم بالعيش السوري والثومية" },
      { name: "Syrian Sausage", nameAr: "سجق سوري", price: 60, categoryId: "cat_syrian_04", desc: "سجق متبل بالعيش السوري والمخلل" },
      { name: "Syrian Shish", nameAr: "شيش سوري", price: 60, categoryId: "cat_syrian_04", desc: "شيش طاووق بالعيش السوري والثومية" },
      { name: "Syrian Tarb", nameAr: "طرب سوري", price: 90, categoryId: "cat_syrian_04", desc: "طرب بلدي بالعيش السوري المقرمش" },

      // حلويات اللحوم (السقط)
      { name: "Delicacies Plate Small", nameAr: "طبق سقط صغير", price: 60, categoryId: "cat_delicacies_05", desc: "حلويات لحوم وسقط طبق صغير" },
      { name: "Delicacies Plate Large", nameAr: "طبق سقط كبير", price: 100, categoryId: "cat_delicacies_05", desc: "حلويات لحوم وسقط طبق كبير" },
      { name: "Delicacies Sandwich Small", nameAr: "ساندوتش سقط صغير", price: 25, categoryId: "cat_delicacies_05", desc: "ساندوتش حلويات لحوم وسقط صغير" },
      { name: "Delicacies Sandwich Large", nameAr: "ساندوتش سقط كبير", price: 50, categoryId: "cat_delicacies_05", desc: "ساندوتش حلويات لحوم وسقط كبير" },

      // مشروبات ساخنة
      { name: "Tea", nameAr: "شاي", price: 15, categoryId: "cat_hot_drinks_06", desc: "شاي أسود مظبوط" },
      { name: "Zarda Tea", nameAr: "شاي زردة", price: 15, categoryId: "cat_hot_drinks_06", desc: "شاي زردة بدوي على الفحم" },
      { name: "Flavored Tea", nameAr: "شاي نكهات", price: 22, categoryId: "cat_hot_drinks_06", desc: "شاي بنكهات متنوعة (خوخ/توت/نعناع)" },
      { name: "Milk Tea", nameAr: "شاي بالحليب", price: 25, categoryId: "cat_hot_drinks_06", desc: "شاي بالحليب الطازج" },
      { name: "Green Tea", nameAr: "شاي أخضر", price: 20, categoryId: "cat_hot_drinks_06", desc: "شاي أخضر نقي" },
      { name: "Karkadeh Anise", nameAr: "كركديه + ينسون", price: 20, categoryId: "cat_hot_drinks_06", desc: "مزيج كركديه ساخن مع ينسون" },
      { name: "Karkadeh Ginger", nameAr: "كركديه + زنجبيل", price: 20, categoryId: "cat_hot_drinks_06", desc: "كركديه مع زنجبيل طبيعي" },
      { name: "Herbal Drink", nameAr: "أعشاب", price: 25, categoryId: "cat_hot_drinks_06", desc: "تشكيلة أعشاب صحراوية مهدئة" },
      { name: "Cinnamon Ginger", nameAr: "قرفة + زنجبيل", price: 25, categoryId: "cat_hot_drinks_06", desc: "مشروب قرفة وزنجبيل حار" },
      { name: "Cinnamon Ginger Milk", nameAr: "قرفة + زنجبيل بالحليب", price: 35, categoryId: "cat_hot_drinks_06", desc: "قرفة وزنجبيل مغلية بالحليب" },

      // قهوة
      { name: "Turkish Coffee", nameAr: "قهوة تركي", price: 20, categoryId: "cat_coffee_07", desc: "قهوة تركي ممتازة بالوش" },
      { name: "French Coffee", nameAr: "قهوة فرنساوي", price: 30, categoryId: "cat_coffee_07", desc: "قهوة بالحليب والكريمة الفرنساوية" },
      { name: "Cappuccino", nameAr: "كابتشينو", price: 35, categoryId: "cat_coffee_07", desc: "كابتشينو إيطالي برغوة غنية" },
      { name: "Clitchino", nameAr: "كليتشينو", price: 35, categoryId: "cat_coffee_07", desc: "مشروب كليتشينو المميز" },
      { name: "Latte", nameAr: "لاتيه", price: 35, categoryId: "cat_coffee_07", desc: "كافيه لاتيه ناعم بالحليب المبخر" },
      { name: "Mocha", nameAr: "موكا", price: 40, categoryId: "cat_coffee_07", desc: "موكا شيكولاتة مع إسبريسو وحليب" },
      { name: "Nescafe", nameAr: "نسكافيه", price: 35, categoryId: "cat_coffee_07", desc: "نسكافيه جولد بحليب كامل الدسم" },

      // عصائر طبيعية وميلك شيك
      { name: "Fresh Orange", nameAr: "برتقال فريش", price: 25, categoryId: "cat_juices_08", desc: "عصير برتقال طبيعي معصور طازج" },
      { name: "Fresh Mango", nameAr: "مانجو فريش", price: 25, categoryId: "cat_juices_08", desc: "عصير مانجو طبيعي مثلج" },
      { name: "Fresh Lemon", nameAr: "ليمون فريش", price: 25, categoryId: "cat_juices_08", desc: "عصير ليمون منعش بالنعناع" },
      { name: "Fresh Guava", nameAr: "جوافة فريش", price: 15, categoryId: "cat_juices_08", desc: "عصير جوافة طبيعي" },
      { name: "Prickly Pear", nameAr: "تين شوكي", price: 20, categoryId: "cat_juices_08", desc: "عصير تين شوكي طبيعي منعش" },
      { name: "Prickly Pear Large", nameAr: "تين شوكي كبير", price: 50, categoryId: "cat_juices_08", desc: "كأس تين شوكي كبير مميز" },
      { name: "Kiwi Juice", nameAr: "كيوي فريش", price: 60, categoryId: "cat_juices_08", desc: "عصير كيوي طبيعي مركز" },
      { name: "Avocado Juice", nameAr: "أفوكادو بالعسل", price: 60, categoryId: "cat_juices_08", desc: "أفوكادو طبيعي مع عسل ومكسرات" },
      { name: "Strawberry Juice", nameAr: "فراولة فريش", price: 30, categoryId: "cat_juices_08", desc: "عصير فراولة طبيعي طازج" },
      { name: "Mango Smoothie", nameAr: "سموذي (مانجو)", price: 50, categoryId: "cat_juices_08", desc: "سموذي مانجو مثلج منعش" },
      { name: "Mixed Smoothie", nameAr: "سموذي (موز/فراولة/مشكل/أوريو)", price: 40, categoryId: "cat_juices_08", desc: "سموذي بنكهات منعشة ومثلجة" },
      { name: "Milkshake", nameAr: "ميلك شيك (فانيليا/شوكولاتة/مانجو/أوريو)", price: 40, categoryId: "cat_juices_08", desc: "ميلك شيك كريمي مثلج مع صوصات" },
      { name: "Fruit Salad Small", nameAr: "طبق فاكهة صغير", price: 60, categoryId: "cat_juices_08", desc: "تشكيلة فواكه طازجة مقطعة صغير" },
      { name: "Fruit Salad Medium", nameAr: "طبق فاكهة وسط", price: 100, categoryId: "cat_juices_08", desc: "تشكيلة فواكه طازجة وسط" },
      { name: "Fruit Salad Large", nameAr: "طبق فاكهة كبير", price: 120, categoryId: "cat_juices_08", desc: "تشكيلة فواكه طازجة طبق فاخر كبير" },

      // حلويات وموهيتو ومشروبات غازية
      { name: "Classic Mojito", nameAr: "موهيتو كلاسيك", price: 35, categoryId: "cat_desserts_09", desc: "موهيتو ليمون ونعناع وصودا منعشة" },
      { name: "Sauces Mojito", nameAr: "موهيتو صوصات", price: 40, categoryId: "cat_desserts_09", desc: "موهيتو نكهات وصوصات توت وفراولة" },
      { name: "Fattet Oreeyat", nameAr: "فتة أوريات", price: 40, categoryId: "cat_desserts_09", desc: "فتة أوريات بالحليب والكريمة" },
      { name: "Fattet Oreo", nameAr: "فتة أوريو", price: 60, categoryId: "cat_desserts_09", desc: "فتة بسكويت أوريو بالشوكولاتة والنوتيلا" },
      { name: "Chocolate Tagine", nameAr: "طواجن شوكولاتة", price: 60, categoryId: "cat_desserts_09", desc: "طاجن شوكولاتة ساخن ونوتيلا غنية" },
      { name: "Fruit Salad Bowl", nameAr: "فروت سلاد", price: 50, categoryId: "cat_desserts_09", desc: "سلطة فواكه بالعصير والآيس كريم" },
      { name: "Soft Drinks", nameAr: "بيبسي / كولا / سبرايت / فانتا", price: 22, categoryId: "cat_desserts_09", desc: "مشروبات غازية كانز 330 مل" },
      { name: "Small Mineral Water", nameAr: "مياه معدنية صغيرة", price: 10, categoryId: "cat_desserts_09", desc: "زجاجة مياه معدنية طبيعية 600 مل" },
      { name: "Red Bull", nameAr: "ريد بول", price: 65, categoryId: "cat_desserts_09", desc: "مشروب طاقة ريد بول أصلي" },

      // ركن الشيشة
      { name: "Salloum Shisha", nameAr: "شيشة سلوم", price: 12, categoryId: "cat_shisha_10", desc: "معسل سلوم شعبي على الفحم" },
      { name: "Qass Shisha", nameAr: "شيشة قص", price: 15, categoryId: "cat_shisha_10", desc: "معسل قص أصلي على الحجر" },
      { name: "Fruit Shisha", nameAr: "شيشة فواكه (تفاحتين/عنب)", price: 30, categoryId: "cat_shisha_10", desc: "معسل فواكه نخلة فاخر" },
      { name: "Mixed Fruit Shisha", nameAr: "شيشة فواكه ميكس", price: 35, categoryId: "cat_shisha_10", desc: "خلطة فواكه ميكس مع نعناع ولبان" },
      { name: "Luxury Shisha", nameAr: "شيشة فاخر ممتازة", price: 60, categoryId: "cat_shisha_10", desc: "شيشة فاخر خلطة خاصة واحة بدوي" },
    ];

    for (const item of menuItemsSeed) {
      const existing = await prisma.menuItem.findFirst({
        where: { nameAr: item.nameAr },
      });
      if (existing) {
        await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            price: item.price,
            description: item.desc,
            categoryId: item.categoryId,
            active: true,
          },
        });
      } else {
        await prisma.menuItem.create({
          data: {
            name: item.name,
            nameAr: item.nameAr,
            price: item.price,
            description: item.desc,
            categoryId: item.categoryId,
            active: true,
          },
        });
      }
    }

    // 6. Seed Demo Customers for Delivery & Takeaway
    const sampleCustomers = [
      {
        name: "الحاج إبراهيم البدوي",
        phone: "01012345678",
        address: "عبد القادر - خلف جامع السلام - فيلا البدوي",
        notes: "عميل دائم - يفضل اللحوم المشوية نصف سوا",
      },
      {
        name: "المهندس شريف منصور",
        phone: "01234567890",
        address: "المستعمرة - بجوار سنترال عبد القادر - عمارة 4",
        notes: "دليفري مستمر وقت الغداء",
      },
      {
        name: "كابتن أحمد عبد الله",
        phone: "01558962994",
        address: "منطقة عبد القادر - طريق الإسكندرية الصحراوي",
        notes: "هاتف واحة بدوي المعتمد",
      },
    ];

    for (const c of sampleCustomers) {
      await prisma.customer.upsert({
        where: { phone: c.phone },
        update: { name: c.name, address: c.address, notes: c.notes },
        create: c,
      });
    }

    return NextResponse.json({
      success: true,
      message: "✅ تم تحديث المنيو واللوجو والهوية والعملاء والمستخدمين بنجاح تام!",
      admin: admin.username,
      totalCategories: categoriesSeed.length,
      totalMenuItems: menuItemsSeed.length,
      tablesCount: 30, // 28 dining + 2 takeaway/delivery
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "فشلت تهيئة قاعدة البيانات",
      },
      { status: 500 }
    );
  }
}
