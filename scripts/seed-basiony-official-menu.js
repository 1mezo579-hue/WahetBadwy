const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const OFFICIAL_CATEGORIES = [
  {
    id: "cat_grills_01",
    name: "Grills",
    nameAr: "المشويات",
    description: "مشويات على الفحم البلدي - تباع بالوزن النيء (ربع / نصف / إلا ربع / كيلو)",
    order: 1,
  },
  {
    id: "cat_sandwiches_charcoal_02",
    name: "Charcoal Sandwiches",
    nameAr: "ساندوتشات على الفحم",
    description: "طعم الفحم الأصلي ريحة تفتح النفس",
    order: 2,
  },
  {
    id: "cat_sandwiches_french_03",
    name: "French Sandwiches",
    nameAr: "الساندوتشات الفرنساوي",
    description: "ساندوتشات مشويات في خبز فرنساوي فاخر",
    order: 3,
  },
  {
    id: "cat_special_trays_04",
    name: "Basiony Special Trays",
    nameAr: "صواني بسيوني الخاصة",
    description: "صواني المشويات الفاخرة مع الأرز والسلطات",
    order: 4,
  },
  {
    id: "cat_family_trays_05",
    name: "Family Trays",
    nameAr: "صواني العيلة",
    description: "صواني ولائم عائلية متكاملة تكفي كل العيلة",
    order: 5,
  },
  {
    id: "cat_labor_meals_06",
    name: "Labor Meals",
    nameAr: "وجبات العمالة",
    description: "جميع وجبات العمالة معها طبق رز هدية ★",
    order: 6,
  },
  {
    id: "cat_offal_07",
    name: "Offal & Delicacies",
    nameAr: "حلويات اللحمة (السقط)",
    description: "ساندوتشات وأطباق ممبار، كرشة، كوارع، ومشكل سقط",
    order: 7,
  },
  {
    id: "cat_offers_08",
    name: "Special Offers",
    nameAr: "العروض الحصرية",
    description: "عروض وتوفير مشويات بسيوني الحصرية",
    order: 8,
  },
  {
    id: "cat_sides_drinks_09",
    name: "Sides & Drinks",
    nameAr: "الإضافات والمشروبات",
    description: "أرز، سلطات، عيش، مخلل، ومشروبات باردة",
    order: 9,
  },
];

const OFFICIAL_MENU_ITEMS = [
  // 1. المشويات (بيع بالوزن النيء بالكيلو)
  {
    name: "Kofta Grilled",
    nameAr: "كفتة مشوية",
    price: 400,
    categoryId: "cat_grills_01",
    description: "كفتة بلدي مشوية على الفحم - تباع بالوزن النيء: ربع 100 ج / نصف 200 ج / كيلو 400 ج",
  },
  {
    name: "Sausage Grilled",
    nameAr: "سجق مشوي",
    price: 400,
    categoryId: "cat_grills_01",
    description: "سجق بلدي متبل على الفحم - تباع بالوزن النيء: ربع 100 ج / نصف 200 ج / كيلو 400 ج",
  },
  {
    name: "Tarb Grilled",
    nameAr: "طرب مشوي",
    price: 500,
    categoryId: "cat_grills_01",
    description: "طرب بلدي فاخر على الفحم - تباع بالوزن النيء: ربع 125 ج / نصف 250 ج / كيلو 500 ج",
  },
  {
    name: "Shish Tawook Grilled",
    nameAr: "شيش طاووق",
    price: 400,
    categoryId: "cat_grills_01",
    description: "شيش طاووق دجاج على الفحم - تباع بالوزن النيء: ربع 100 ج / نصف 200 ج / كيلو 400 ج",
  },
  {
    name: "Mixed Grills",
    nameAr: "مشكل مشويات",
    price: 400,
    categoryId: "cat_grills_01",
    description: "مشكل مشويات بلدي على الفحم - تباع بالوزن النيء: ربع 100 ج / نصف 200 ج / كيلو 400 ج",
  },

  // 2. ساندوتشات على الفحم
  {
    name: "Kofta Charcoal Sandwich",
    nameAr: "كفتة على الفحم",
    price: 30,
    categoryId: "cat_sandwiches_charcoal_02",
    description: "ساندوتش كفتة مشوية على الفحم بلدي",
  },
  {
    name: "Sausage Charcoal Sandwich",
    nameAr: "سجق على الفحم",
    price: 35,
    categoryId: "cat_sandwiches_charcoal_02",
    description: "ساندوتش سجق مشوي على الفحم",
  },
  {
    name: "Tarb Charcoal Sandwich",
    nameAr: "طرب على الفحم",
    price: 40,
    categoryId: "cat_sandwiches_charcoal_02",
    description: "ساندوتش طرب بلدي فاخر على الفحم",
  },
  {
    name: "Shish Tawook Charcoal Sandwich",
    nameAr: "شيش طاووق على الفحم",
    price: 35,
    categoryId: "cat_sandwiches_charcoal_02",
    description: "ساندوتش شيش طاووق على الفحم",
  },
  {
    name: "Mix Grills Charcoal Sandwich",
    nameAr: "ميكس مشويات",
    price: 45,
    categoryId: "cat_sandwiches_charcoal_02",
    description: "ساندوتش ميكس مشويات على الفحم",
  },

  // 3. الساندوتشات الفرنساوي
  {
    name: "French Kofta",
    nameAr: "فرنساوي كفتة",
    price: 45,
    categoryId: "cat_sandwiches_french_03",
    description: "كفتة مشوية في خبز فرنساوي فاخر",
  },
  {
    name: "French Sausage",
    nameAr: "فرنساوي سجق",
    price: 50,
    categoryId: "cat_sandwiches_french_03",
    description: "سجق مشوي في خبز فرنساوي فاخر",
  },
  {
    name: "French Tarb",
    nameAr: "فرنساوي طرب",
    price: 55,
    categoryId: "cat_sandwiches_french_03",
    description: "طرب بلدي مشوي في خبز فرنساوي فاخر",
  },
  {
    name: "French Shish",
    nameAr: "فرنساوي شيش",
    price: 50,
    categoryId: "cat_sandwiches_french_03",
    description: "شيش طاووق في خبز فرنساوي فاخر",
  },
  {
    name: "French Mix Basiony",
    nameAr: "فرنساوي ميكس بسيوني",
    price: 65,
    categoryId: "cat_sandwiches_french_03",
    description: "ميكس مشويات بسيوني المميز في خبز فرنساوي",
  },

  // 4. صواني بسيوني الخاصة
  {
    name: "Fahmet Basiony Tray",
    nameAr: "صينية فحمة بسيوني",
    price: 179,
    categoryId: "cat_special_trays_04",
    description: "ربع كيلو مشكل + رز + سلطات + طحينة",
  },
  {
    name: "High Mood Tray",
    nameAr: "صينية الكيف العالي",
    price: 269,
    categoryId: "cat_special_trays_04",
    description: "نصف كيلو مشكل + رز + سلطات + طحينة",
  },
  {
    name: "Knockout Punch Tray",
    nameAr: "صينية الضربة القاضية",
    price: 239,
    categoryId: "cat_special_trays_04",
    description: "ربع كفتة + ربع سجق + طرب + رز + سلطات",
  },
  {
    name: "Kings Tray",
    nameAr: "صينية الملوك",
    price: 299,
    categoryId: "cat_special_trays_04",
    description: "نصف كيلو مشكل + بطاطس + رز + سلطات",
  },
  {
    name: "Al-Wagsh Tray",
    nameAr: "صينية الوجش",
    price: 549,
    categoryId: "cat_special_trays_04",
    description: "كيلو مشكل مشويات + رز عائلي + سلطات",
  },
  {
    name: "Sultan Tray",
    nameAr: "صينية السلطان",
    price: 749,
    categoryId: "cat_special_trays_04",
    description: "كيلو مشكل + فرخة + رز عائلي + سلطات",
  },

  // 5. صواني العيلة
  {
    name: "Lemet Basiony Tray",
    nameAr: "صينية لمة بسيوني",
    price: 399,
    categoryId: "cat_family_trays_05",
    description: "فرخة كاملة + نصف كيلو كفتة + رز كبير + سلطات",
  },
  {
    name: "Big House Tray",
    nameAr: "صينية البيت الكبير",
    price: 499,
    categoryId: "cat_family_trays_05",
    description: "فرخة كاملة + نصف كيلو مشكل + رز كبير + سلطات",
  },
  {
    name: "The Feast Tray",
    nameAr: "صينية العزومة",
    price: 999,
    categoryId: "cat_family_trays_05",
    description: "فرختين + كيلو مشكل + رز عائلي + سلطات",
  },

  // 6. وجبات العمالة (معها طبق رز هدية)
  {
    name: "Sanaiay Meal",
    nameAr: "وجبة الصنايعي",
    price: 99,
    categoryId: "cat_labor_meals_06",
    description: "ربع كيلو كفتة + عيش + سلطة + رز هدية",
  },
  {
    name: "Shabaan Meal",
    nameAr: "وجبة الشبعان",
    price: 99,
    categoryId: "cat_labor_meals_06",
    description: "ربع كيلو سجق + عيش + سلطة + رز هدية",
  },
  {
    name: "Warsha Meal",
    nameAr: "وجبة الورشة",
    price: 119,
    categoryId: "cat_labor_meals_06",
    description: "نصف فرخة + عيش + طحينة + رز هدية",
  },
  {
    name: "Mualemeen Meal",
    nameAr: "وجبة المعلمين",
    price: 119,
    categoryId: "cat_labor_meals_06",
    description: "ربع كيلو مشكل + عيش + سلطة + رز هدية",
  },
  {
    name: "Quarter Chicken Meal",
    nameAr: "وجبة ربع الفرخة",
    price: 79,
    categoryId: "cat_labor_meals_06",
    description: "ربع فرخة + عيش + طحينة + رز هدية",
  },

  // 7. حلويات اللحمة (السقط)
  // ساندوتشات السقط
  {
    name: "Mombar Sandwich Small",
    nameAr: "ساندوتش ممبار (صغير)",
    price: 20,
    categoryId: "cat_offal_07",
    description: "ساندوتش ممبار بلدي صغير",
  },
  {
    name: "Mombar Sandwich Large",
    nameAr: "ساندوتش ممبار (كبير)",
    price: 40,
    categoryId: "cat_offal_07",
    description: "ساندوتش ممبار بلدي كبير",
  },
  {
    name: "Kersha Sandwich Small",
    nameAr: "ساندوتش كرشة (صغير)",
    price: 20,
    categoryId: "cat_offal_07",
    description: "ساندوتش كرشة متبلة صغير",
  },
  {
    name: "Kersha Sandwich Large",
    nameAr: "ساندوتش كرشة (كبير)",
    price: 40,
    categoryId: "cat_offal_07",
    description: "ساندوتش كرشة متبلة كبير",
  },
  {
    name: "Kawaer Sandwich Small",
    nameAr: "ساندوتش كوارع (صغير)",
    price: 25,
    categoryId: "cat_offal_07",
    description: "ساندوتش كوارع بلدي مخلية صغير",
  },
  {
    name: "Kawaer Sandwich Large",
    nameAr: "ساندوتش كوارع (كبير)",
    price: 50,
    categoryId: "cat_offal_07",
    description: "ساندوتش كوارع بلدي مخلية كبير",
  },
  {
    name: "Meshakel Saqat Sandwich Small",
    nameAr: "ساندوتش مشكل سقط (صغير)",
    price: 30,
    categoryId: "cat_offal_07",
    description: "ساندوتش مشكل حلويات لحمة صغير",
  },
  {
    name: "Meshakel Saqat Sandwich Large",
    nameAr: "ساندوتش مشكل سقط (كبير)",
    price: 55,
    categoryId: "cat_offal_07",
    description: "ساندوتش مشكل حلويات لحمة كبير",
  },
  // أطباق السقط
  {
    name: "Mombar Plate Small",
    nameAr: "طبق ممبار (صغير)",
    price: 50,
    categoryId: "cat_offal_07",
    description: "طبق ممبار بلدي صغير",
  },
  {
    name: "Mombar Plate Large",
    nameAr: "طبق ممبار (كبير)",
    price: 90,
    categoryId: "cat_offal_07",
    description: "طبق ممبار بلدي كبير",
  },
  {
    name: "Kersha Plate Small",
    nameAr: "طبق كرشة (صغير)",
    price: 50,
    categoryId: "cat_offal_07",
    description: "طبق كرشة متبلة صغير",
  },
  {
    name: "Kersha Plate Large",
    nameAr: "طبق كرشة (كبير)",
    price: 90,
    categoryId: "cat_offal_07",
    description: "طبق كرشة متبلة كبير",
  },
  {
    name: "Meshakel Saqat Plate Small",
    nameAr: "طبق مشكل سقط (صغير)",
    price: 60,
    categoryId: "cat_offal_07",
    description: "طبق مشكل سقط وحلويات لحمة صغير",
  },
  {
    name: "Meshakel Saqat Plate Large",
    nameAr: "طبق مشكل سقط (كبير)",
    price: 120,
    categoryId: "cat_offal_07",
    description: "طبق مشكل سقط وحلويات لحمة كبير",
  },
  {
    name: "Mombar & Kersha Plate Small",
    nameAr: "طبق ممبار وكرشة (صغير)",
    price: 55,
    categoryId: "cat_offal_07",
    description: "طبق مشكل ممبار وكرشة صغير",
  },
  {
    name: "Mombar & Kersha Plate Large",
    nameAr: "طبق ممبار وكرشة (كبير)",
    price: 110,
    categoryId: "cat_offal_07",
    description: "طبق مشكل ممبار وكرشة كبير",
  },

  // 8. العروض الحصرية
  {
    name: "El-Keif Offer",
    nameAr: "عرض الكيف",
    price: 200,
    categoryId: "cat_offers_08",
    description: "نصف كيلو كفتة + 2 سلطة طحينة هدية",
  },
  {
    name: "El-Habayeb Offer",
    nameAr: "عرض الحبايب",
    price: 400,
    categoryId: "cat_offers_08",
    description: "كيلو مشكل مشويات + 2 رز + 2 طحينة هدية",
  },
  {
    name: "Family Offer",
    nameAr: "عرض العيلة",
    price: 379,
    categoryId: "cat_offers_08",
    description: "فرخة كاملة + نصف كيلو كفتة + رز عائلي + سلطات",
  },
  {
    name: "Friday Offer",
    nameAr: "عرض الجمعة",
    price: 449,
    categoryId: "cat_offers_08",
    description: "كيلو كفتة + 4 أرز + سلطة كبيرة",
  },
  {
    name: "Golden Basiony Offer",
    nameAr: "عرض بسيوني الذهبي",
    price: 499,
    categoryId: "cat_offers_08",
    description: "2 فرخة مشوية + رز عائلي + سلطات",
  },
  {
    name: "Sahra Offer",
    nameAr: "عرض السهرة",
    price: 150,
    categoryId: "cat_offers_08",
    description: "5 ساندوتشات على الفحم + زجاجة بيبسي 1.5 لتر هدية",
  },

  // 9. الإضافات والمشروبات
  {
    name: "Rice With Nuts Small",
    nameAr: "طبق أرز بالخلطة",
    price: 25,
    categoryId: "cat_sides_drinks_09",
    description: "طبق أرز مبهر فاخر بالخلطة",
  },
  {
    name: "Family Rice",
    nameAr: "طبق أرز عائلي كبير",
    price: 45,
    categoryId: "cat_sides_drinks_09",
    description: "سرفيس أرز عائلي كبير",
  },
  {
    name: "Green Salad",
    nameAr: "سلطة خضراء",
    price: 10,
    categoryId: "cat_sides_drinks_09",
    description: "سلطة بلدي خضراء طازجة",
  },
  {
    name: "Tahina Salad",
    nameAr: "سلطة طحينة",
    price: 10,
    categoryId: "cat_sides_drinks_09",
    description: "طحينة بيضاء خام متبلة بالليمون والكمون",
  },
  {
    name: "Pickles",
    nameAr: "مخلل مشكل",
    price: 10,
    categoryId: "cat_sides_drinks_09",
    description: "مخلل بلدي مشكل مقرمش",
  },
  {
    name: "Baladi Bread Pack",
    nameAr: "عيش بلدي (5 رغيف)",
    price: 10,
    categoryId: "cat_sides_drinks_09",
    description: "عيش بلدي طازج مخبوز 5 أرغفة",
  },
  {
    name: "Can Soda",
    nameAr: "كانز بيبسي / ميرندا / سفن",
    price: 20,
    categoryId: "cat_sides_drinks_09",
    description: "مشروب غازي كانز مثلج 330 مل",
  },
  {
    name: "Pepsi 1.5L",
    nameAr: "زجاجة بيبسي 1.5 لتر",
    price: 35,
    categoryId: "cat_sides_drinks_09",
    description: "زجاجة بيبسي عائلية 1.5 لتر",
  },
  {
    name: "Mineral Water Small",
    nameAr: "مياه معدنية صغيرة",
    price: 10,
    categoryId: "cat_sides_drinks_09",
    description: "مياه طبيعية نقية 600 مل",
  },
  {
    name: "Mineral Water Large",
    nameAr: "مياه معدنية كبيرة",
    price: 18,
    categoryId: "cat_sides_drinks_09",
    description: "مياه طبيعية نقية 1.5 لتر",
  },
];

async function seedBasionyOfficialMenu() {
  console.log('=== STARTING OFFICIAL BASIONY MENU SEEDING ===');

  // 1. Backup old catalog
  const oldCategories = await prisma.category.findMany({ include: { items: true } });
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(
    path.join(backupDir, 'catalog-backup-pre-basiony.json'),
    JSON.stringify(oldCategories, null, 2)
  );
  console.log(`[Backup] Saved ${oldCategories.length} old categories to backup file.`);

  // 2. Mark any existing legacy items as inactive to keep historical order data intact
  if (oldCategories.length > 0) {
    await prisma.menuItem.updateMany({ data: { active: false } });
    console.log('[Cleanup] Marked legacy items as inactive.');
  }

  // 3. Insert or Update Official Categories
  for (const cat of OFFICIAL_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        nameAr: cat.nameAr,
        description: cat.description,
        order: cat.order,
      },
      create: {
        id: cat.id,
        name: cat.name,
        nameAr: cat.nameAr,
        description: cat.description,
        order: cat.order,
      },
    });
    console.log(`[Category] Upserted: ${cat.nameAr} (${cat.id})`);
  }

  // 4. Insert or Update Official Menu Items
  let insertedCount = 0;
  for (const item of OFFICIAL_MENU_ITEMS) {
    const existing = await prisma.menuItem.findFirst({
      where: { nameAr: item.nameAr, categoryId: item.categoryId },
    });

    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          price: item.price,
          description: item.description,
          active: true,
        },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          name: item.name,
          nameAr: item.nameAr,
          price: item.price,
          description: item.description,
          categoryId: item.categoryId,
          active: true,
        },
      });
    }
    insertedCount++;
  }

  console.log(`[Items] Successfully seeded ${insertedCount} official menu items.`);

  // 5. Verification
  const totalCats = await prisma.category.count();
  const totalActiveItems = await prisma.menuItem.count({ where: { active: true } });

  console.log('\n=== VERIFICATION RESULTS ===');
  console.log(`Total Categories: ${totalCats}`);
  console.log(`Total Active Menu Items: ${totalActiveItems}`);
  console.log('=============================\n');
}

seedBasionyOfficialMenu()
  .catch((e) => {
    console.error('Fatal error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
