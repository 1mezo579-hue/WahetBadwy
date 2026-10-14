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

export async function GET() {
  try {
    // 1. Seed Admin
    const hashedPassword = await bcrypt.hash("WahetBadawy@2026", 12);
    const admin = await prisma.user.upsert({
      where: { username: "admin" },
      update: { password: hashedPassword },
      create: {
        username: "admin",
        password: hashedPassword,
        name: "مدير النظام",
        role: Role.ADMIN,
        active: true,
      },
    });

    // 2. Seed 28 Dining Tables
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

    // 3. Equipment
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
        name: "ماكينة قهوة إسبريسو إيطالية (La Marzocco 2 Group)",
        type: EquipmentType.BARISTA,
        status: EquipmentStatus.OPERATIONAL,
        location: "ركن الباريستا والمشروبات",
        notes: "فحص ضغط البخار يومياً",
      },
      {
        name: "مطحنة بن احترافية (Fiorenzato F64)",
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

    // 4. Categories & Menu Items
    const catMandi = await prisma.category.upsert({
      where: { id: "cat_bedouin_01" },
      update: {},
      create: {
        id: "cat_bedouin_01",
        name: "Traditional Bedouin Dishes",
        nameAr: "المأكولات البدوية والمندي",
        description: "أشهى الأطباق التراثية البدوية على أصولها",
        order: 1,
      },
    });

    const catDrinks = await prisma.category.upsert({
      where: { id: "cat_barista_02" },
      update: {},
      create: {
        id: "cat_barista_02",
        name: "Hot & Cold Beverages",
        nameAr: "مشروبات وباريستا",
        description: "قهوة مختصة، شاي بدوي على الحطب، ومشروبات منعشة",
        order: 2,
      },
    });

    const catShisha = await prisma.category.upsert({
      where: { id: "cat_shisha_03" },
      update: {},
      create: {
        id: "cat_shisha_03",
        name: "Shisha & Tobacco",
        nameAr: "قسم الشيشة والمعسل",
        description: "شيشة فاخرة، معسل سلوم وتفاحتين على الفحم الطبيعي",
        order: 3,
      },
    });

    // Menu Items
    const existingMandi = await prisma.menuItem.findFirst({
      where: { nameAr: "وجبة مندي لحم ضأن ربع تيس" },
    });
    if (!existingMandi) {
      await prisma.menuItem.create({
        data: {
          name: "Mandi Lamb (1/4 Lamb Meal)",
          nameAr: "وجبة مندي لحم ضأن ربع تيس",
          description: "لحم ضأن بلدي مندي مدفون مع أرز بسمتي فاخر ومكسرات وسلطة دقوس",
          price: 380,
          categoryId: catMandi.id,
          active: true,
        },
      });
    }

    const existingTea = await prisma.menuItem.findFirst({
      where: { nameAr: "شاي بدوي بالحبق والميرمية على الجمر" },
    });
    if (!existingTea) {
      await prisma.menuItem.create({
        data: {
          name: "Bedouin Herbal Tea",
          nameAr: "شاي بدوي بالحبق والميرمية على الجمر",
          description: "شاي مخدر على الفحم بنكهة الأعشاب الصحراوية العطرية",
          price: 45,
          categoryId: catDrinks.id,
          active: true,
        },
      });
    }

    const existingLatte = await prisma.menuItem.findFirst({
      where: { nameAr: "كافيه لاتيه" },
    });
    if (!existingLatte) {
      await prisma.menuItem.create({
        data: {
          name: "Café Latte",
          nameAr: "كافيه لاتيه",
          description: "إسبريسو مع حليب طازج مبخر بطبقة كريمية ناعمة",
          price: 70,
          categoryId: catDrinks.id,
          active: true,
        },
      });
    }

    const existingShisha1 = await prisma.menuItem.findFirst({
      where: { nameAr: "شيشة تفاحتين فاخر" },
    });
    if (!existingShisha1) {
      await prisma.menuItem.create({
        data: {
          name: "Double Apple Shisha",
          nameAr: "شيشة تفاحتين فاخر",
          description: "تفاحتين نخلة فاخر على الفحم الطبيعي",
          price: 65,
          categoryId: catShisha.id,
          active: true,
        },
      });
    }

    const existingShisha2 = await prisma.menuItem.findFirst({
      where: { nameAr: "شيشة معسل سلوم بدوي" },
    });
    if (!existingShisha2) {
      await prisma.menuItem.create({
        data: {
          name: "Salloum Traditional Shisha",
          nameAr: "شيشة معسل سلوم بدوي",
          description: "معسل سلوم وقص أصلي على الحطب",
          price: 40,
          categoryId: catShisha.id,
          active: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "✅ تم تهيئة قاعدة البيانات بنجاح تام! يمكنك الآن تسجيل الدخول.",
      admin: admin.username,
      tablesCount: 28,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "فشلت تهيئة قاعدة البيانات",
      },
      { status: 500 }
    );
  }
}
