import { prisma } from "@/lib/prisma";

export interface ExpenseCategoryItem {
  id: string;
  nameAr: string;
  group: string;
  groupAr: string;
  active: boolean;
  keywords: string[];
  defaultPaymentMethod?: "CASH" | "VISA" | "TRANSFER";
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryItem[] = [
  // 1. المرتبات ومستحقات العاملين
  { id: "sal-basic", nameAr: "المرتبات الأساسية", group: "SALARIES", groupAr: "المرتبات والأجور", active: true, keywords: ["مرتب", "مرتبات", "رواتب", "راتب"] },
  { id: "sal-overtime", nameAr: "إضافي ساعات العمل", group: "SALARIES", groupAr: "المرتبات والأجور", active: true, keywords: ["إضافي", "اوفر تايم", "ساعات إضافية"] },
  { id: "sal-advances", nameAr: "سلف الموظفين", group: "SALARIES", groupAr: "المرتبات والأجور", active: true, keywords: ["سلفة", "سلف", "سلفيات", "سلفة عامل"] },
  { id: "sal-bonus", nameAr: "المكافآت والحوافز", group: "SALARIES", groupAr: "المرتبات والأجور", active: true, keywords: ["مكافأة", "حافز", "مكافآت", "بونص"] },
  { id: "sal-meals", nameAr: "وجبات العاملين والمشروبات", group: "SALARIES", groupAr: "المرتبات والأجور", active: true, keywords: ["وجبة عامل", "وجبات", "أكل العمال", "فطار العمال"] },
  { id: "sal-housing", nameAr: "سكن العاملين وإقامته", group: "SALARIES", groupAr: "المرتبات والأجور", active: true, keywords: ["سكن", "إيجار سكن", "كهرباء سكن"] },

  // 2. اللحوم والفراخ وخامات المطبخ
  { id: "food-meat", nameAr: "اللحوم البلدي والكباب", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["لحمة", "لحم", "كباب", "لحمة مفرومة", "ريش", "ضاني", "بتلو", "عجالي"] },
  { id: "food-poultry", nameAr: "الفراخ والطيور والشيش", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["فراخ", "دجاج", "شيش", "صدور", "وراك", "دواجن"] },
  { id: "food-kofta-sojouk", nameAr: "الكفتة والسجق والطرب", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["كفتة", "سجق", "طرب", "مفروم كفتة"] },
  { id: "food-veg-fruits", nameAr: "الخضار والفاكهة والسلطات", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["خضار", "طماطم", "بصل", "خيار", "ليمون", "بقدونس", "سلطة", "فاكهة"] },
  { id: "food-rice-pasta", nameAr: "الأرز والمكرونة والحبوب", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["أرز", "رز", "مكرونة", "شعرية", "بسمتي"] },
  { id: "food-oil-ghee", nameAr: "الزيوت والسمن والمسلى", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["زيت", "سمنة", "زبدة", "مسلى"] },
  { id: "food-spices", nameAr: "التوابل والبهارات والتتبيلات", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["بهارات", "توابل", "فلفل أسود", "كمون", "تتبيلة", "خلطة"] },
  { id: "food-flour-bread", nameAr: "الدقيق والعيش والمخبوزات", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["دقيق", "عيش", "خبز", "فينو", "ردة"] },
  { id: "food-dairy", nameAr: "الألبان والجبن والبيض", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["لبن", "حليب", "جبنة", "موتزاريلا", "بيض", "زبادي"] },
  { id: "food-legumes", nameAr: "البقوليات والنشويات", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["فول", "عدس", "حمص", "فاصوليا", "لوبيا"] },
  { id: "food-sauces", nameAr: "الصلصات والطحينة والمخللات", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["طحينة", "صلصة", "كاتشب", "مايونيز", "مخلل", "طرشي"] },
  { id: "food-charcoal", nameAr: "فحم الشوي وتجهيزات الشواية", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["فحم", "فحم شوي", "شوال فحم", "مولع"] },
  { id: "food-misc", nameAr: "خامات وتوابع مطبخ متنوعة", group: "FOOD_RAW", groupAr: "اللحوم وخامات المطبخ", active: true, keywords: ["خامات مطبخ", "خل", "ملح", "سكر", "شاي", "قهوة"] },

  // 3. التعبئة والتغليف والتقديم
  { id: "pkg-boxes", nameAr: "علب السفري والفويل والوجبات", group: "PACKAGING", groupAr: "التعبئة والتغليف", active: true, keywords: ["علب", "علبة سفري", "فويل", "أطباق فوم", "علب وجبات"] },
  { id: "pkg-bags", nameAr: "الأكياس والشنط البلاستيك والورق", group: "PACKAGING", groupAr: "التعبئة والتغليف", active: true, keywords: ["أكياس", "شنط", "شنطة", "كيس", "أكياس مطبوعة"] },
  { id: "pkg-plates-cups", nameAr: "الأطباق والأكواب والملاعق", group: "PACKAGING", groupAr: "التعبئة والتغليف", active: true, keywords: ["أكواب", "كوبايات", "معالق", "شوك", "سكاكين", "أطباق بلاستيك"] },
  { id: "pkg-tissues", nameAr: "المناديل ومفارش السفرة والتقديم", group: "PACKAGING", groupAr: "التعبئة والتغليف", active: true, keywords: ["مناديل", "مفرش", "مفارش", "رول سفرة"] },

  // 4. المرافق والفواتير
  { id: "util-electric", nameAr: "فاتورة الكهرباء وشحن العداد", group: "UTILITIES", groupAr: "المرافق والفواتير", active: true, keywords: ["كهرباء", "كارت كهرباء", "شحن العداد", "فاتورة كهرباء"] },
  { id: "util-water", nameAr: "فاتورة المياه", group: "UTILITIES", groupAr: "المرافق والفواتير", active: true, keywords: ["مياه", "فاتورة مياه", "عداد مياه"] },
  { id: "util-gas", nameAr: "الغاز الطبيعي وأنابيب البوتاجاز", group: "UTILITIES", groupAr: "المرافق والفواتير", active: true, keywords: ["غاز", "أنبوبة", "أنابيب", "فاتورة غاز"] },
  { id: "util-internet-phone", nameAr: "الإنترنت والتليفون الأرضي والموبايل", group: "UTILITIES", groupAr: "المرافق والفواتير", active: true, keywords: ["نت", "إنترنت", "راوتر", "تليفون", "باقة", "موبايل"] },
  { id: "util-subs", nameAr: "الاشتراكات والخدمات الرقمية", group: "UTILITIES", groupAr: "المرافق والفواتير", active: true, keywords: ["اشتراك", "سيرفر", "سوفت وير", "اشتراكات"] },

  // 5. النظافة والصيانة
  { id: "maint-cleaners", nameAr: "المنظفات والمطهرات والكلور", group: "MAINTENANCE", groupAr: "النظافة والصيانة", active: true, keywords: ["منظف", "منظفات", "مطهر", "مطهرات", "كلور", "صابون", "سلك", "فيري"] },
  { id: "maint-pest", nameAr: "مكافحة الحشرات ورش الصحة", group: "MAINTENANCE", groupAr: "النظافة والصيانة", active: true, keywords: ["رش", "حشرات", "مكافحة حشرات", "مبيد"] },
  { id: "maint-grill-hood", nameAr: "صيانة الجريل والشفاط والمدخنة", group: "MAINTENANCE", groupAr: "النظافة والصيانة", active: true, keywords: ["صيانة جريل", "شفاط", "مدخنة", "شواية", "سحب"] },
  { id: "maint-refrig-ac", nameAr: "صيانة الثلاجات والتبريد والتكييف", group: "MAINTENANCE", groupAr: "النظافة والصيانة", active: true, keywords: ["تكييف", "ثلاجة", "فريزر", "تبريد", "شحن فريون"] },
  { id: "maint-plumbing-elec", nameAr: "صيانة السباكة والكهرباء العامة", group: "MAINTENANCE", groupAr: "النظافة والصيانة", active: true, keywords: ["سباكة", "سباك", "كهربائي", "صيانة كهرباء", "لمبات", "أسلاك"] },

  // 6. النقل واللوجستيات
  { id: "log-delivery-fuel", nameAr: "وقود وبنزين دراجات التوصيل", group: "LOGISTICS", groupAr: "النقل واللوجستيات", active: true, keywords: ["بنزين", "وقود", "سولار", "بنزين مكن"] },
  { id: "log-courier-exp", nameAr: "مصاريف طياري التوصيل والمشاوير", group: "LOGISTICS", groupAr: "النقل واللوجستيات", active: true, keywords: ["طيار", "طيارين", "دليفري", "مشوار", "أجرة", "مواصلات"] },
  { id: "log-cargo", nameAr: "نقل ونولون مشتريات الخامات", group: "LOGISTICS", groupAr: "النقل واللوجستيات", active: true, keywords: ["نولون", "عربية نقل", "كارته", "شيال", "نقل مشتريات"] },

  // 7. الإيجار والمصروفات الإدارية
  { id: "adm-rent", nameAr: "إيجار المطعم والمحل", group: "ADMIN", groupAr: "الإيجار والإداريات", active: true, keywords: ["إيجار", "ايجار", "إيجار المحل"] },
  { id: "adm-stationery", nameAr: "الأدوات المكتبية وبكر الفواتير والطباعة", group: "ADMIN", groupAr: "الإيجار والإداريات", active: true, keywords: ["بكر", "بكر ورق", "أقلام", "دفاتر", "ورق كاشير"] },
  { id: "adm-fees", nameAr: "أتعاب المحاسب والضرائب والتراخيص والرسوم", group: "ADMIN", groupAr: "الإيجار والإداريات", active: true, keywords: ["محاسب", "ضرائب", "تأمينات", "تراخيص", "حي", "شهادة صحية"] },

  // 8. التسويق والدعاية والضيافة
  { id: "mkt-ads", nameAr: "الإعلانات والممول والتسويق", group: "MARKETING", groupAr: "التسويق والدعاية", active: true, keywords: ["إعلان", "اعلانات", "ممول", "سوشيال", "فيسبوك"] },
  { id: "mkt-signs", nameAr: "التصميم والتصوير واليافطات والمطبوعات", group: "MARKETING", groupAr: "التسويق والدعاية", active: true, keywords: ["تصوير", "بانر", "يافطة", "منيو ورقي", "فلاير", "تصميم"] },
  { id: "mkt-hospitality", nameAr: "ضيافة الزوار والعلاقات العامة", group: "MARKETING", groupAr: "التسويق والدعاية", active: true, keywords: ["ضيافة", "شاي ضيافة", "استضافة", "عصير ضيوف"] },

  // 9. الأصول والمعدات والتجهيزات
  { id: "asset-kitchen", nameAr: "معدات المطبخ وأدوات الشوي", group: "ASSETS", groupAr: "الأصول والتجهيزات", active: true, keywords: ["سيخ", "أسياخ", "سكاكين شيف", "حلة", "معدة", "عدة شوي"] },
  { id: "asset-furniture", nameAr: "الأثاث والطاولات والكراسي", group: "ASSETS", groupAr: "الأصول والتجهيزات", active: true, keywords: ["كرسي", "ترابيزة", "طاولة", "كنبة"] },
  { id: "asset-pos-printers", nameAr: "أجهزة الكاشير والطابعات والشبكات", group: "ASSETS", groupAr: "الأصول والتجهيزات", active: true, keywords: ["طابعة", "طابعة كاشير", "درج نقدية", "شاشة", "كمبيوتر"] },

  // 10. العمليات المالية والطارئة
  { id: "fin-bank-fees", nameAr: "عمولات ماكينات الفيزا والبنك", group: "FINANCIAL", groupAr: "المالية والطارئة", active: true, keywords: ["عمولة فيزا", "عمولة بنك", "رسوم تحويل", "مصاريف بنكية"] },
  { id: "fin-emergency", nameAr: "مصروفات طارئة وتصليحات عاجلة", group: "FINANCIAL", groupAr: "المالية والطارئة", active: true, keywords: ["طارئ", "مصروف طارئ", "حاجة عاجلة", "عطل"] },
  { id: "fin-other", nameAr: "مصروفات أخرى متنوعة", group: "FINANCIAL", groupAr: "المالية والطارئة", active: true, keywords: ["أخرى", "متنوع", "نثريات"] },
];

const CONFIG_CAT_KEY = "EXPENSE_CATEGORIES_DIRECTORY_V1";

export async function getExpenseCategories(): Promise<ExpenseCategoryItem[]> {
  try {
    const record = await prisma.equipment.findFirst({
      where: { name: CONFIG_CAT_KEY },
    });

    if (record && record.notes) {
      const parsed = JSON.parse(record.notes);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading expense categories from DB:", err);
  }
  return DEFAULT_EXPENSE_CATEGORIES;
}

export async function saveExpenseCategories(categories: ExpenseCategoryItem[]): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(categories);
    const existing = await prisma.equipment.findFirst({
      where: { name: CONFIG_CAT_KEY },
    });

    if (existing) {
      await prisma.equipment.update({
        where: { id: existing.id },
        data: { notes: jsonStr, updatedAt: new Date() },
      });
    } else {
      await prisma.equipment.create({
        data: {
          name: CONFIG_CAT_KEY,
          type: "CONFIG",
          status: "OPERATIONAL",
          quantity: 1,
          notes: jsonStr,
        },
      });
    }
    return true;
  } catch (err) {
    console.error("Error saving expense categories:", err);
    return false;
  }
}

/**
 * Intelligent Matcher for Egyptian Conversational Arabic
 * e.g. "منظفات", "لحمة", "بنزين", "كهرباء", "أكياس", "سلفة"
 */
export function matchExpenseCategory(text: string, categories: ExpenseCategoryItem[]): ExpenseCategoryItem | null {
  const clean = (text || "").trim().toLowerCase();
  if (!clean) return null;

  // 1. Direct match on keywords
  for (const cat of categories) {
    if (!cat.active) continue;
    for (const kw of cat.keywords) {
      if (clean.includes(kw.toLowerCase())) {
        return cat;
      }
    }
  }

  // 2. Fallback: match on category name
  for (const cat of categories) {
    if (!cat.active) continue;
    if (clean.includes(cat.nameAr.toLowerCase())) {
      return cat;
    }
  }

  return null;
}
