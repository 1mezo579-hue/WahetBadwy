const fs = require('fs');
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}
const { PrismaClient, UnitType } = require('@prisma/client');
const prisma = new PrismaClient();

const RAW_MATERIALS_CATALOG = [
  // ------------------------------------------------------------------------
  // 1. اللحوم والدواجن (Meat & Poultry)
  // ------------------------------------------------------------------------
  {
    name: "لحمة كفتة",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "لحمة سجق",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "طرب (منديل ضاني)",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "لحمة شيش كباب",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 8,
  },
  {
    name: "لحمة روزبيف",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "لحمة فلتو",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "كبدة بقري",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "دهن أو لية ضاني",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "صدور فراخ مخلية",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "بانيه دجاج",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 8,
  },
  {
    name: "شيش طاووق متبل",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "فراخ كاملة للشوي",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.PIECE,
    purchaseUnit: "حبة",
    issueUnit: "حبة",
    conversionFactor: 1,
    minStockLevel: 15,
  },
  {
    name: "لحمة مفروم",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "كرشة بقري مسلوقة",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "ممبار بلدي محشي",
    category: "اللحوم والدواجن",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },

  // ------------------------------------------------------------------------
  // 2. الخضار والسلطات (Vegetables & Salads)
  // ------------------------------------------------------------------------
  {
    name: "طماطم بلدي",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 15,
  },
  {
    name: "بصل أحمر / أبيض",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 20,
  },
  {
    name: "فلفل أخضر رومي",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "فلفل حار (شطة خضراء)",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 3,
  },
  {
    name: "ليمون بلدي",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "ثوم بلدي",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 3,
  },
  {
    name: "بقدونس أخضر طازج",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.PIECE,
    purchaseUnit: "حزمة",
    issueUnit: "حزمة",
    conversionFactor: 1,
    minStockLevel: 10,
  },
  {
    name: "خيار بلدي طازج",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 8,
  },
  {
    name: "خس كابوتشا / بلدي",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.PIECE,
    purchaseUnit: "حبة",
    issueUnit: "حبة",
    conversionFactor: 1,
    minStockLevel: 5,
  },
  {
    name: "جرجير طازج",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.PIECE,
    purchaseUnit: "حزمة",
    issueUnit: "حزمة",
    conversionFactor: 1,
    minStockLevel: 10,
  },
  {
    name: "بطاطس للطبخ والقلي",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 15,
  },
  {
    name: "باذنجان رومي",
    category: "الخضار والسلطات",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },

  // ------------------------------------------------------------------------
  // 3. العطارة والتوابل (Spices & Seasoning)
  // ------------------------------------------------------------------------
  {
    name: "ملح طعام ناعم",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "فلفل أسود مطحون",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 3,
  },
  {
    name: "كمون مطحون",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 3,
  },
  {
    name: "كزبرة ناشفة مطحونة",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 3,
  },
  {
    name: "بابريكا حلوة",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 2,
  },
  {
    name: "شطة حمراء مطحونة",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 2,
  },
  {
    name: "بهارات لحمة مشويات",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 4,
  },
  {
    name: "بهارات فراخ وتتبيل",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 4,
  },
  {
    name: "بهارات كفتة مخصوصة",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "ثوم بودر",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 2,
  },
  {
    name: "بصل بودر",
    category: "العطارة والتوابل",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 2,
  },

  // ------------------------------------------------------------------------
  // 4. الزيوت والصلصات والمكونات المساعدة
  // ------------------------------------------------------------------------
  {
    name: "زيت طعام للتحمير والقلي",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.LITER,
    purchaseUnit: "لتر",
    issueUnit: "مل",
    conversionFactor: 1000,
    minStockLevel: 20,
  },
  {
    name: "زيت طعام للطبخ والتتبيل",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.LITER,
    purchaseUnit: "لتر",
    issueUnit: "مل",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "سمنة بلدي / زبدة",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "خل أبيض نقي",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.LITER,
    purchaseUnit: "لتر",
    issueUnit: "مل",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "زبادي للتتبيل",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.PIECE,
    purchaseUnit: "علبة",
    issueUnit: "علبة",
    conversionFactor: 1,
    minStockLevel: 12,
  },
  {
    name: "طحينة سمسم بيضاء خام",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 15,
  },
  {
    name: "صلصة طماطم معجون",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 8,
  },
  {
    name: "كاتشب",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "مايونيز",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 5,
  },
  {
    name: "مستردة (خردل)",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 3,
  },
  {
    name: "دبس رمان",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.LITER,
    purchaseUnit: "لتر",
    issueUnit: "مل",
    conversionFactor: 1000,
    minStockLevel: 3,
  },
  {
    name: "بقسماط مطحون للبانيه",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "مخلل خيار بلدي",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 10,
  },
  {
    name: "مخلل مشكل بلدي",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 15,
  },
  {
    name: "أرز بسمتي أبيض بالخلطة",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.KG,
    purchaseUnit: "كجم",
    issueUnit: "جرام",
    conversionFactor: 1000,
    minStockLevel: 25,
  },
  {
    name: "عيش بلدي طازج",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.PIECE,
    purchaseUnit: "باكو",
    issueUnit: "رغيف",
    conversionFactor: 5,
    minStockLevel: 50,
  },
  {
    name: "عيش فينو فرنساوي",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.PIECE,
    purchaseUnit: "كرتونة/باكو",
    issueUnit: "رغيف",
    conversionFactor: 1,
    minStockLevel: 100,
  },
  {
    name: "عيش صاج سوري",
    category: "الزيوت والصلصات والمكونات المساعدة",
    type: "FOOD",
    unit: UnitType.PIECE,
    purchaseUnit: "باكو",
    issueUnit: "رغيف",
    conversionFactor: 1,
    minStockLevel: 80,
  },

  // ------------------------------------------------------------------------
  // 5. أدوات التغليف اليومية (Packaging Materials)
  // ------------------------------------------------------------------------
  {
    name: "علب وجبات مشويات مقسمة",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "كرتونة",
    issueUnit: "حبة",
    conversionFactor: 100,
    minStockLevel: 150,
  },
  {
    name: "علب وجبات كبيرة أو صواني مشكل",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "كرتونة",
    issueUnit: "حبة",
    conversionFactor: 50,
    minStockLevel: 40,
  },
  {
    name: "علب أرز وجوانب بغطاء",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "كرتونة",
    issueUnit: "حبة",
    conversionFactor: 100,
    minStockLevel: 100,
  },
  {
    name: "علب صوص وطحينة صغيرة بغطاء",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "كرتونة",
    issueUnit: "حبة",
    conversionFactor: 500,
    minStockLevel: 300,
  },
  {
    name: "أكياس تيك أواي يد مطبوعة",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "باكو",
    issueUnit: "حبة",
    conversionFactor: 100,
    minStockLevel: 200,
  },
  {
    name: "أكياس طلبات كبيرة مقواة",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "باكو",
    issueUnit: "حبة",
    conversionFactor: 50,
    minStockLevel: 100,
  },
  {
    name: "فويل ألومنيوم حراري للشوي",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "رول",
    issueUnit: "رول",
    conversionFactor: 1,
    minStockLevel: 5,
  },
  {
    name: "ورق تغليف سندوتشات حراري",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "باكو",
    issueUnit: "فرخ",
    conversionFactor: 500,
    minStockLevel: 300,
  },
  {
    name: "علب وأغلفة سندوتشات كرتون",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "كرتونة",
    issueUnit: "حبة",
    conversionFactor: 200,
    minStockLevel: 150,
  },
  {
    name: "علب سلطة خضراء ومخلل بغطاء",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "كرتونة",
    issueUnit: "حبة",
    conversionFactor: 250,
    minStockLevel: 200,
  },
  {
    name: "شوك وملاعق وسكاكين بلاستيك مغلفة",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "كرتونة",
    issueUnit: "طقم",
    conversionFactor: 200,
    minStockLevel: 150,
  },
  {
    name: "مناديل ورقية سفرة وتيك أواي",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "باكو",
    issueUnit: "باكو",
    conversionFactor: 1,
    minStockLevel: 30,
  },
  {
    name: "أكياس تغليف غذائي نايلون",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "باكو",
    issueUnit: "حبة",
    conversionFactor: 100,
    minStockLevel: 100,
  },
  {
    name: "استرتش تغليف غذائي رول",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "رول",
    issueUnit: "رول",
    conversionFactor: 1,
    minStockLevel: 5,
  },
  {
    name: "قفازات مناسبة لملامسة الطعام",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "علبة",
    issueUnit: "قفاز",
    conversionFactor: 100,
    minStockLevel: 50,
  },
  {
    name: "ملصقات تعريف وتغليف الطلبات",
    category: "أدوات التغليف",
    type: "PACKAGING",
    unit: UnitType.PIECE,
    purchaseUnit: "رول",
    issueUnit: "ملصق",
    conversionFactor: 500,
    minStockLevel: 200,
  },

  // ------------------------------------------------------------------------
  // 6. أدوات النظافة والتشغيل (Cleaning & Sanitation)
  // ------------------------------------------------------------------------
  {
    name: "سائل غسيل أطباق وأواني مركز",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.LITER,
    purchaseUnit: "جالون",
    issueUnit: "لتر",
    conversionFactor: 4,
    minStockLevel: 8,
  },
  {
    name: "منظف ومعقم أرضيات",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.LITER,
    purchaseUnit: "جالون",
    issueUnit: "لتر",
    conversionFactor: 4,
    minStockLevel: 6,
  },
  {
    name: "منظف ومطهر أسطح المطبخ",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.LITER,
    purchaseUnit: "بخاخ/لتر",
    issueUnit: "لتر",
    conversionFactor: 1,
    minStockLevel: 4,
  },
  {
    name: "مزيل دهون وكربون للشواية",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.LITER,
    purchaseUnit: "جالون",
    issueUnit: "لتر",
    conversionFactor: 4,
    minStockLevel: 6,
  },
  {
    name: "مطهر ومعقم أسطح منشآت غذائية",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.LITER,
    purchaseUnit: "جالون",
    issueUnit: "لتر",
    conversionFactor: 4,
    minStockLevel: 4,
  },
  {
    name: "منظف وملمع زجاج ومرايا",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.LITER,
    purchaseUnit: "بخاخ",
    issueUnit: "بخاخ",
    conversionFactor: 1,
    minStockLevel: 3,
  },
  {
    name: "صابون سائل لغسيل أيدي العاملين",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.LITER,
    purchaseUnit: "جالون",
    issueUnit: "لتر",
    conversionFactor: 4,
    minStockLevel: 6,
  },
  {
    name: "أكياس قمامة سوداء كبيرة وثقيلة",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.PIECE,
    purchaseUnit: "باكو",
    issueUnit: "كيس",
    conversionFactor: 50,
    minStockLevel: 60,
  },
  {
    name: "إسفنج وسلك غسيل ستانلس ستيل",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.PIECE,
    purchaseUnit: "دسته",
    issueUnit: "قطعة",
    conversionFactor: 12,
    minStockLevel: 24,
  },
  {
    name: "فوط تنظيف مايكروفايبر للمطابخ",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.PIECE,
    purchaseUnit: "دسته",
    issueUnit: "فوطة",
    conversionFactor: 12,
    minStockLevel: 12,
  },
  {
    name: "ممسحة ومقشة وجاروف طقم كامل",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.PIECE,
    purchaseUnit: "طقم",
    issueUnit: "طقم",
    conversionFactor: 1,
    minStockLevel: 2,
  },
  {
    name: "فرش تنظيف شواية خشنة",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.PIECE,
    purchaseUnit: "حبة",
    issueUnit: "فرشاة",
    conversionFactor: 1,
    minStockLevel: 4,
  },
  {
    name: "قفازات تنظيف وتطهير سميكة",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.PIECE,
    purchaseUnit: "زوج",
    issueUnit: "زوج",
    conversionFactor: 1,
    minStockLevel: 6,
  },
  {
    name: "سكاكين كشط ومكاشط للشواية",
    category: "أدوات النظافة والتشغيل",
    type: "CLEANING",
    unit: UnitType.PIECE,
    purchaseUnit: "حبة",
    issueUnit: "أداة",
    conversionFactor: 1,
    minStockLevel: 2,
  },
];

async function seedCatalogAndRecipes() {
  console.log("=========================================================");
  console.log("🌱 STARTING FAST BATCH SEED: RAW MATERIALS & RECIPES SETUP");
  console.log("=========================================================\n");

  const countsByCategory = {};
  for (const item of RAW_MATERIALS_CATALOG) {
    countsByCategory[item.category] = (countsByCategory[item.category] || 0) + 1;
  }

  // 1. Bulk check existing materials in 1 query
  console.log(`Checking existing materials against ${RAW_MATERIALS_CATALOG.length} catalog items...`);
  const existingMaterials = await prisma.rawMaterial.findMany();
  const existingMap = new Map(existingMaterials.map((m) => [m.name, m]));

  const toCreate = [];
  for (const item of RAW_MATERIALS_CATALOG) {
    if (!existingMap.has(item.name)) {
      toCreate.push({
        name: item.name,
        category: item.category,
        type: item.type,
        unit: item.unit,
        purchaseUnit: item.purchaseUnit,
        issueUnit: item.issueUnit,
        conversionFactor: item.conversionFactor,
        costPerUnit: 0,
        currentStock: 0,
        minStockLevel: item.minStockLevel,
        status: "OUT_OF_STOCK",
      });
    }
  }

  if (toCreate.length > 0) {
    console.log(`Creating ${toCreate.length} new materials in bulk...`);
    await prisma.rawMaterial.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  } else {
    console.log("All catalog materials already exist in database.");
  }

  // Refresh all materials into lookup map
  const allMaterials = await prisma.rawMaterial.findMany();
  const materialMap = Object.fromEntries(allMaterials.map((m) => [m.name, m]));

  console.log("\nRaw Materials Catalog Breakdown:");
  for (const [cat, count] of Object.entries(countsByCategory)) {
    console.log(`  - ${cat}: ${count} صنف`);
  }

  // 2. Bulk link recipes to existing menu items
  console.log("\nLinking Recipes to Menu Items in Bulk (with NEEDS_QUANTITY flag)...");
  const menuItems = await prisma.menuItem.findMany({
    include: { category: true },
  });

  const existingRecipeItems = await prisma.recipeItem.findMany();
  const existingRecipeSet = new Set(
    existingRecipeItems.map((r) => `${r.menuItemId}_${r.rawMaterialId}`)
  );

  const recipesToCreate = [];

  for (const item of menuItems) {
    const itemName = item.nameAr;
    const catName = item.category?.nameAr || "";
    const candidateMaterials = [];

    // Skip services like delivery or grilling service fees
    if (catName === "خدمات الشوي" || itemName.includes("خدمة شوي")) {
      continue;
    }

    // 1. Meat and dish mapping
    if (itemName.includes("كفتة")) {
      candidateMaterials.push("لحمة كفتة");
      candidateMaterials.push("بصل أحمر / أبيض");
      candidateMaterials.push("بهارات كفتة مخصوصة");
      candidateMaterials.push("بقدونس أخضر طازج");
    }
    if (itemName.includes("سجق")) {
      candidateMaterials.push("لحمة سجق");
      candidateMaterials.push("بهارات لحمة مشويات");
    }
    if (itemName.includes("طرب")) {
      candidateMaterials.push("طرب (منديل ضاني)");
      candidateMaterials.push("لحمة كفتة");
      candidateMaterials.push("بهارات كفتة مخصوصة");
    }
    if (itemName.includes("شيش طاووق") || itemName.includes("شيش")) {
      candidateMaterials.push("شيش طاووق متبل");
      candidateMaterials.push("بهارات فراخ وتتبيل");
    }
    if (itemName.includes("كباب") || itemName.includes("مشكل مشويات")) {
      candidateMaterials.push("لحمة شيش كباب");
      candidateMaterials.push("لحمة كفتة");
      candidateMaterials.push("طرب (منديل ضاني)");
    }
    if (itemName.includes("فراخ") || itemName.includes("فرخة")) {
      candidateMaterials.push("فراخ كاملة للشوي");
      candidateMaterials.push("بهارات فراخ وتتبيل");
      candidateMaterials.push("ليمون بلدي");
    }
    if (itemName.includes("كرشة")) {
      candidateMaterials.push("كرشة بقري مسلوقة");
      candidateMaterials.push("بصل أحمر / أبيض");
      candidateMaterials.push("بهارات لحمة مشويات");
    }
    if (itemName.includes("ممبار")) {
      candidateMaterials.push("ممبار بلدي محشي");
      candidateMaterials.push("زيت طعام للتحمير والقلي");
    }
    if (itemName.includes("أرز") || itemName.includes("ارز")) {
      candidateMaterials.push("أرز بسمتي أبيض بالخلطة");
      candidateMaterials.push("سمنة بلدي / زبدة");
      candidateMaterials.push("علب أرز وجوانب بغطاء");
    }
    if (itemName.includes("طحينة")) {
      candidateMaterials.push("طحينة سمسم بيضاء خام");
      candidateMaterials.push("خل أبيض نقي");
      candidateMaterials.push("كمون مطحون");
      candidateMaterials.push("علب صوص وطحينة صغيرة بغطاء");
    }
    if (itemName.includes("سلطة خضراء") || itemName.includes("سلطة بلدي")) {
      candidateMaterials.push("طماطم بلدي");
      candidateMaterials.push("خيار بلدي طازج");
      candidateMaterials.push("بقدونس أخضر طازج");
      candidateMaterials.push("ليمون بلدي");
      candidateMaterials.push("علب سلطة خضراء ومخلل بغطاء");
    }
    if (itemName.includes("مخلل")) {
      candidateMaterials.push("مخلل مشكل بلدي");
      candidateMaterials.push("علب سلطة خضراء ومخلل بغطاء");
    }
    if (itemName.includes("عيش بلدي") || itemName.includes("خبز بلدي")) {
      candidateMaterials.push("عيش بلدي طازج");
      candidateMaterials.push("أكياس تغليف غذائي نايلون");
    }

    // Bread and Packaging mapping by category
    if (catName.includes("ساندوتشات على الفحم")) {
      candidateMaterials.push("عيش بلدي طازج");
      candidateMaterials.push("ورق تغليف سندوتشات حراري");
      candidateMaterials.push("طحينة سمسم بيضاء خام");
    } else if (catName.includes("الساندوتشات الفرنساوي")) {
      candidateMaterials.push("عيش فينو فرنساوي");
      candidateMaterials.push("ورق تغليف سندوتشات حراري");
      candidateMaterials.push("علب وأغلفة سندوتشات كرتون");
    } else if (catName.includes("ساندوتشات سوري")) {
      candidateMaterials.push("عيش صاج سوري");
      candidateMaterials.push("ورق تغليف سندوتشات حراري");
    } else if (catName.includes("المشويات") || catName.includes("وجبات العمالة")) {
      candidateMaterials.push("علب وجبات مشويات مقسمة");
      candidateMaterials.push("شوك وملاعق وسكاكين بلاستيك مغلفة");
      candidateMaterials.push("مناديل ورقية سفرة وتيك أواي");
    } else if (catName.includes("صواني")) {
      candidateMaterials.push("علب وجبات كبيرة أو صواني مشكل");
      candidateMaterials.push("فويل ألومنيوم حراري للشوي");
      candidateMaterials.push("أكياس طلبات كبيرة مقواة");
    }

    // Deduplicate candidate materials
    const uniqueCandidates = [...new Set(candidateMaterials)];

    for (const matName of uniqueCandidates) {
      const rawMat = materialMap[matName];
      if (!rawMat) continue;

      const key = `${item.id}_${rawMat.id}`;
      if (!existingRecipeSet.has(key)) {
        recipesToCreate.push({
          menuItemId: item.id,
          rawMaterialId: rawMat.id,
          quantity: 0, // Placeholder
          unit: rawMat.unit,
          isComplete: false,
          status: "NEEDS_QUANTITY",
          notes: "تم الربط المبدئي آلياً — بانتظار اعتماد المقدار الدقيق من الإدارة",
        });
        existingRecipeSet.add(key);
      }
    }
  }

  if (recipesToCreate.length > 0) {
    console.log(`Bulk inserting ${recipesToCreate.length} recipe links...`);
    await prisma.recipeItem.createMany({
      data: recipesToCreate,
      skipDuplicates: true,
    });
  }

  const finalRecipeCount = await prisma.recipeItem.count();
  console.log(`\nRecipe Linking Completed:`);
  console.log(`  - Newly created recipe links in this run: ${recipesToCreate.length}`);
  console.log(`  - Total recipe relationships in database: ${finalRecipeCount}`);
  console.log(`  - All incomplete recipes flagged with 'NEEDS_QUANTITY' (Quantity = 0, isComplete = false).`);
  console.log("  - Zero cleaners linked to recipes.");
  console.log("  - Automatic stock deduction will NOT trigger until admin confirms quantities.");

  console.log("\n=========================================================");
  console.log("✅ SEED COMPLETED SUCCESSFULLY WITH ZERO DATA LOSS");
  console.log("=========================================================\n");

  await prisma.$disconnect();
}

seedCatalogAndRecipes().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
