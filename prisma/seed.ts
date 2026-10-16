import {
  PrismaClient,
  Role,
  TableType,
  TableStatus,
  EquipmentStatus,
  UnitType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const EquipmentType = {
  KITCHEN: "KITCHEN",
  BARISTA: "BARISTA",
  SHISHA: "SHISHA",
  HALL: "HALL",
  BATHROOM: "BATHROOM",
} as const;

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Sprint 2 database seed...");

  // 1. Seed Default Admin
  const hashedPassword = await bcrypt.hash("WahetBadawy@2026", 12);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
      name: "مدير النظام",
      role: Role.ADMIN,
      active: true,
    },
  });
  console.log(`✅ Admin user seeded: ${admin.username}`);

  // 2. Seed Dining Tables (Exactly as specified in Sprint 2)
  console.log("🪑 Seeding Dining Tables...");

  // - 6 "Family Booths" (باكيات عائلات)
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

  // - 8 "VIP Tables" (طاولات VIP)
  for (let i = 1; i <= 8; i++) {
    await prisma.diningTable.upsert({
      where: { name: `طاولة VIP ${i}` },
      update: { capacity: 4 },
      create: {
        name: `طاولة VIP ${i}`,
        number: 200 + i,
        type: TableType.VIP,
        status: TableStatus.AVAILABLE,
        capacity: 4,
      },
    });
  }

  // - 12 "Regular Tables" (طاولات عادية)
  for (let i = 1; i <= 12; i++) {
    await prisma.diningTable.upsert({
      where: { name: `طاولة عادية ${i}` },
      update: { capacity: 4 },
      create: {
        name: `طاولة عادية ${i}`,
        number: 300 + i,
        type: TableType.REGULAR,
        status: TableStatus.AVAILABLE,
        capacity: 4,
      },
    });
  }

  // - 1 "Owner Table"
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

  // - 1 "Manager Table"
  await prisma.diningTable.upsert({
    where: { name: "طاولة المدير (Manager Table)" },
    update: { capacity: 4 },
    create: {
      name: "طاولة المدير (Manager Table)",
      number: 2,
      type: TableType.MANAGER,
      status: TableStatus.AVAILABLE,
      capacity: 4,
    },
  });

  // - Fast Takeaway Virtual Table
  await prisma.diningTable.upsert({
    where: { name: "تيك أواي فوري مباشر (بدون طاولة)" },
    update: {},
    create: {
      name: "تيك أواي فوري مباشر (بدون طاولة)",
      number: 997,
      type: TableType.REGULAR,
      status: TableStatus.AVAILABLE,
      capacity: 99,
    },
  });

  // - 10 Dedicated Takeaway Phone Tables (طلبات التليفون واستلام التيك أواي)
  for (let i = 1; i <= 10; i++) {
    await prisma.diningTable.upsert({
      where: { name: `تيك أواي تليفون ${i}` },
      update: {
        number: 500 + i,
        capacity: 1,
      },
      create: {
        name: `تيك أواي تليفون ${i}`,
        number: 500 + i,
        type: TableType.REGULAR,
        status: TableStatus.AVAILABLE,
        capacity: 1,
      },
    });
  }

  console.log("✅ All dining tables and 10 takeaway phone tables seeded successfully");

  // 3. Seed Equipment (Kitchen & Barista)
  console.log("🍳 Seeding Equipment...");
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
      name: "قلاية بطاطس ومقرمشات مزدوجة",
      type: EquipmentType.KITCHEN,
      status: EquipmentStatus.OPERATIONAL,
      location: "المطبخ السريع",
      notes: "تغيير زيت دوري",
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
    {
      name: "خلاط عصائر وميلك شيك عالي السرعة (Vitamix)",
      type: EquipmentType.BARISTA,
      status: EquipmentStatus.MAINTENANCE,
      location: "ركن العصائر الطازجة",
      notes: "في انتظار شفرة بديلة",
    },
    // ركن الشيشة
    {
      name: "ولاعة فحم وهيتر كهربائي سريع (Charcoal Burner)",
      type: EquipmentType.SHISHA,
      status: EquipmentStatus.OPERATIONAL,
      location: "ركن الشيشة والخدمة الخارجية",
      notes: "فحص الأسلاك وتغيير الشمعات الحرارية دورياً",
    },
    {
      name: "منقل فحم نحاسي بدوي مزخرف وملاقط أمان",
      type: EquipmentType.SHISHA,
      status: EquipmentStatus.OPERATIONAL,
      location: "ركن الشيشة",
      notes: "تنظيف الرماد يومياً بعد نهاية الوردية",
    },
    {
      name: "طاولة تحضير ورص وتعبئة المعسل استانلس",
      type: EquipmentType.SHISHA,
      status: EquipmentStatus.OPERATIONAL,
      location: "ركن الشيشة الداخلي",
      notes: "تجهيز خراطيم طبية ومستلزمات ذات استخدام واحد",
    },
    {
      name: "جهاز تعقيم فواحات وخراطيم الشيشة بالبخار",
      type: EquipmentType.SHISHA,
      status: EquipmentStatus.OPERATIONAL,
      location: "ركن الشيشة",
      notes: "تعقيم فوري بعد كل استخدام",
    },
    // ركن الصالة
    {
      name: "شاشات عرض ذكية 65 بوصة للمباريات (Samsung 4K)",
      type: EquipmentType.HALL,
      status: EquipmentStatus.OPERATIONAL,
      location: "الصالة الرئيسية وطاولات الـ VIP",
      notes: "مربوطة بريسيفرات البث الرياضي والصوتي",
    },
    {
      name: "نظام صوتي ومكبرات ساوند سيستم محيطية (Yamaha)",
      type: EquipmentType.HALL,
      status: EquipmentStatus.OPERATIONAL,
      location: "توزيع في كامل الصالة والباكيات",
      notes: "صوت نقي متوازن مع لوحة تحكم مركزية",
    },
    {
      name: "تكييفات كونسيلد وتبريد وتدفئة 5 حصان للصالة",
      type: EquipmentType.HALL,
      status: EquipmentStatus.OPERATIONAL,
      location: "صالة الطعام المغلقة",
      notes: "تنظيف الفلاتر أسبوعياً لضمان برودة ممتازة",
    },
    {
      name: "مراوح رذاذ مائية للترطيب وتلطيف الجو",
      type: EquipmentType.HALL,
      status: EquipmentStatus.OPERATIONAL,
      location: "الصالة المفتوحة والباكيات العائلية",
      notes: "فحص طلمبات المياه وفتحات الرذاذ",
    },
    // معدات الحمام
    {
      name: "مجفف أيدي أوتوماتيكي هوائي سريع (High-Speed Dryer)",
      type: EquipmentType.BATHROOM,
      status: EquipmentStatus.OPERATIONAL,
      location: "دورات مياه الرجال والسيدات",
      notes: "حساس سنسور سريع عالي الكفاءة",
    },
    {
      name: "موزعات صابون رغوي إلكترونية سنسور",
      type: EquipmentType.BATHROOM,
      status: EquipmentStatus.OPERATIONAL,
      location: "أحواض مغاسل دورات المياه",
      notes: "تعبئة الصابون المعقم وفحص البطاريات أسبوعياً",
    },
    {
      name: "شفاطات تهوية توربينية طاردة للروائح",
      type: EquipmentType.BATHROOM,
      status: EquipmentStatus.OPERATIONAL,
      location: "دورات المياه الرئيسية",
      notes: "تعمل باستمرار طوال فترة فتح المطعم",
    },
    {
      name: "سخان مياه فوري كهربائي أوتوماتيك",
      type: EquipmentType.BATHROOM,
      status: EquipmentStatus.OPERATIONAL,
      location: "شبكة مياه دورات المياه والمغاسل",
      notes: "ضبط درجة الحرارة على المستوى الآمن",
    },
  ];

  for (const eq of equipmentData) {
    const existing = await prisma.equipment.findFirst({ where: { name: eq.name } });
    if (!existing) {
      await prisma.equipment.create({ data: eq });
    }
  }
  console.log("✅ Equipment seeded successfully");

  // 4. Seed Raw Materials
  console.log("🥩 Seeding Raw Materials...");
  const rawMaterialsData = [
    { name: "لحم ضأن بلدي طازج", unit: UnitType.KG, costPerUnit: 420, currentStock: 85, minStockLevel: 25 },
    { name: "أرز بسمتي هندي سيلا ذهبي", unit: UnitType.KG, costPerUnit: 90, currentStock: 150, minStockLevel: 40 },
    { name: "بهارات كبسة ومندي بدوية خاصة", unit: UnitType.KG, costPerUnit: 250, currentStock: 18, minStockLevel: 5 },
    { name: "بن إسبريسو برازيلي محمص", unit: UnitType.KG, costPerUnit: 480, currentStock: 30, minStockLevel: 10 },
    { name: "حليب طازج كامل الدسم", unit: UnitType.LITER, costPerUnit: 45, currentStock: 60, minStockLevel: 20 },
    { name: "سمن بلدي طبيعي", unit: UnitType.KG, costPerUnit: 350, currentStock: 25, minStockLevel: 8 },
    { name: "مكسرات مشكلة (لوز وكاجو وصنوبر)", unit: UnitType.KG, costPerUnit: 650, currentStock: 12, minStockLevel: 4 },
  ];

  const createdMaterials: Record<string, string> = {};
  for (const rm of rawMaterialsData) {
    const existing = await prisma.rawMaterial.findFirst({ where: { name: rm.name } });
    if (existing) {
      createdMaterials[rm.name] = existing.id;
    } else {
      const created = await prisma.rawMaterial.create({ data: rm });
      createdMaterials[rm.name] = created.id;
    }
  }
  console.log("✅ Raw materials seeded successfully");

  // 5. Seed Categories & Menu Items & Recipes
  console.log("🍽️ Seeding Categories & Menu Items...");
  const categoriesData = [
    {
      name: "Traditional Bedouin Dishes",
      nameAr: "المأكولات البدوية والمندي",
      description: "أشهى الأطباق التراثية البدوية على أصولها",
      order: 1,
      items: [
        {
          name: "Mandi Lamb (1/4 Lamb Meal)",
          nameAr: "وجبة مندي لحم ضأن ربع تيس",
          description: "لحم ضأن بلدي مندي مدفون مع أرز بسمتي فاخر ومكسرات وسلطة دقوس",
          price: 380,
          recipe: [
            { materialName: "لحم ضأن بلدي طازج", quantity: 0.45, unit: UnitType.KG },
            { materialName: "أرز بسمتي هندي سيلا ذهبي", quantity: 0.25, unit: UnitType.KG },
            { materialName: "سمن بلدي طبيعي", quantity: 0.03, unit: UnitType.KG },
            { materialName: "بهارات كبسة ومندي بدوية خاصة", quantity: 0.02, unit: UnitType.KG },
            { materialName: "مكسرات مشكلة (لوز وكاجو وصنوبر)", quantity: 0.03, unit: UnitType.KG },
          ],
        },
        {
          name: "Kabsa Lamb",
          nameAr: "كبسة لحم بالخلطة البدوية",
          description: "أرز كبسة غني بالنكهات والبهارات مع قطع لحم ضأن طرية",
          price: 290,
          recipe: [
            { materialName: "لحم ضأن بلدي طازج", quantity: 0.35, unit: UnitType.KG },
            { materialName: "أرز بسمتي هندي سيلا ذهبي", quantity: 0.25, unit: UnitType.KG },
            { materialName: "بهارات كبسة ومندي بدوية خاصة", quantity: 0.025, unit: UnitType.KG },
          ],
        },
      ],
    },
    {
      name: "Hot & Cold Beverages",
      nameAr: "مشروبات وباريستا",
      description: "قهوة مختصة، شاي بدوي على الحطب، ومشروبات منعشة",
      order: 2,
      items: [
        {
          name: "Bedouin Herbal Tea",
          nameAr: "شاي بدوي بالحبق والميرمية على الجمر",
          description: "شاي مخدر على الفحم بنكهة الأعشاب الصحراوية العطرية",
          price: 45,
          recipe: [],
        },
        {
          name: "Double Espresso",
          nameAr: "إسبريسو دبل",
          description: "مستخلص حبوب بن برازيلي بنكهة غنية وقوام متوازن",
          price: 55,
          recipe: [
            { materialName: "بن إسبريسو برازيلي محمص", quantity: 0.018, unit: UnitType.KG },
          ],
        },
        {
          name: "Café Latte",
          nameAr: "كافيه لاتيه",
          description: "إسبريسو مع حليب طازج مبخر بطبقة كريمية ناعمة",
          price: 70,
          recipe: [
            { materialName: "بن إسبريسو برازيلي محمص", quantity: 0.018, unit: UnitType.KG },
            { materialName: "حليب طازج كامل الدسم", quantity: 0.22, unit: UnitType.LITER },
          ],
        },
      ],
    },
    {
      name: "Shisha & Tobacco",
      nameAr: "قسم الشيشة والمعسل",
      description: "شيشة فاخرة، معسل سلوم وتفاحتين على الفحم الطبيعي",
      order: 3,
      items: [
        {
          name: "Double Apple Shisha",
          nameAr: "شيشة تفاحتين فاخر",
          description: "تفاحتين نخلة فاخر على الفحم الطبيعي",
          price: 65,
          recipe: [],
        },
        {
          name: "Salloum Traditional Shisha",
          nameAr: "شيشة معسل سلوم بدوي",
          description: "معسل سلوم وقص أصلي على الحطب",
          price: 40,
          recipe: [],
        },
      ],
    },
  ];

  for (const catData of categoriesData) {
    let cat = await prisma.category.findFirst({ where: { nameAr: catData.nameAr } });
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          name: catData.name,
          nameAr: catData.nameAr,
          description: catData.description,
          order: catData.order,
        },
      });
    }

    for (const itemData of catData.items) {
      let menuItem = await prisma.menuItem.findFirst({
        where: { nameAr: itemData.nameAr, categoryId: cat.id },
      });

      if (!menuItem) {
        menuItem = await prisma.menuItem.create({
          data: {
            name: itemData.name,
            nameAr: itemData.nameAr,
            description: itemData.description,
            price: itemData.price,
            categoryId: cat.id,
            active: true,
          },
        });

        // Add recipe items
        for (const r of itemData.recipe) {
          const materialId = createdMaterials[r.materialName];
          if (materialId) {
            await prisma.recipeItem.create({
              data: {
                menuItemId: menuItem.id,
                rawMaterialId: materialId,
                quantity: r.quantity,
                unit: r.unit,
              },
            });
          }
        }
      }
    }
  }

  console.log("✅ Categories, Menu items, and Recipes seeded successfully");
  console.log("🎉 Sprint 2 database seed completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
