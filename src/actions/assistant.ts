"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getExpenseCategories,
  matchExpenseCategory,
  ExpenseCategoryItem,
} from "@/lib/expenses-catalog";
import {
  recordExpense,
  getExpensesSummary,
  getCentralExpenseLedger,
} from "@/actions/expenses";

export interface AmoBasionySnapshot {
  todaySales: number;
  todayOrdersCount: number;
  unpaidOrdersCount: number;
  todayExpenses: number;
  activeShift: {
    isOpen: boolean;
    openedBy?: string;
    initialCash?: number;
    startTime?: string;
    expectedCash?: number;
  };
  lowStockItems: {
    name: string;
    currentStock: number;
    minStockLevel: number;
    unit: string;
  }[];
  topItemsToday: {
    name: string;
    quantity: number;
  }[];
}

export interface PendingExpense {
  amount: number;
  categoryName: string;
  categoryId?: string;
  item: string;
  paymentMethod: "CASH" | "VISA" | "TRANSFER";
  receiver?: string;
  notes?: string;
}

export interface AssistantResponse {
  answer: string;
  category: "sales" | "inventory" | "grills" | "cashier" | "expenses" | "general";
  statsSnapshot?: AmoBasionySnapshot;
  quickSuggestions: string[];
  pendingExpenseConfirmation?: PendingExpense;
  confirmedExpense?: {
    id: string;
    amount: number;
    categoryName: string;
    paymentMethod: string;
  };
}

/**
 * Helper to parse amounts from Egyptian Arabic text
 * e.g. "350 جنيه", "بـ 500", "١٥٠", "250.5"
 */
function extractAmount(text: string): number | null {
  // Convert Arabic-Indic numerals (٠-٩) to western digits
  const westernText = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

  // Regex patterns for amounts
  const patterns = [
    /(?:بـ|بـ\s+|بقيمة\s+|بمبلغ\s+|صرفت\s+|سجل\s+|ادفع\s+)(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\.م|egp|ألف)?\b/i,
    /\b(\d+(?:\.\d+)?)\b/,
  ];

  for (const regex of patterns) {
    const match = westernText.match(regex);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }
  return null;
}

/**
 * Helper to extract payment method from text
 */
function extractPaymentMethod(text: string): "CASH" | "VISA" | "TRANSFER" {
  const t = text.toLowerCase();
  if (t.includes("فيزا") || t.includes("كارت") || t.includes("بطاقة") || t.includes("visa")) {
    return "VISA";
  }
  if (t.includes("تحويل") || t.includes("فودافون") || t.includes("انستاباي") || t.includes("بنك")) {
    return "TRANSFER";
  }
  // Default for cashier expenses is cash from drawer
  return "CASH";
}

/**
 * 1. Ask Amo Basiony: Natural Egyptian Conversation & Expense Registration
 */
export async function askAmoBasiony(userQuery: string): Promise<AssistantResponse> {
  const query = (userQuery || "").trim().toLowerCase();

  // 0. Security & Role Isolation: Verify session before accessing operational data
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      answer: "يا مرحب بيك في مشويات بسيوني! يرجى تسجيل الدخول أولاً في النظام عشان أقدر أعرضلك تفاصيل الوردية والمبيعات والمخزون الحية.",
      category: "general",
      quickSuggestions: ["تسجيل الدخول للنظام"],
    };
  }

  // 1. Gather Real-Time Operational Context
  let snapshot: AmoBasionySnapshot = {
    todaySales: 0,
    todayOrdersCount: 0,
    unpaidOrdersCount: 0,
    todayExpenses: 0,
    activeShift: { isOpen: false },
    lowStockItems: [],
    topItemsToday: [],
  };

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [todayOrders, openShift, rawMaterials, expensesSummary] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      }),
      prisma.shift.findFirst({
        where: { status: "OPEN" },
        include: { user: { select: { name: true } } },
        orderBy: { startTime: "desc" },
      }),
      prisma.rawMaterial.findMany({
        select: {
          name: true,
          currentStock: true,
          minStockLevel: true,
          unit: true,
        },
        take: 30,
      }).then(items => items.filter(i => i.currentStock <= (i.minStockLevel || 5)).slice(0, 5)).catch(() => []),
      getExpensesSummary("TODAY"),
    ]);

    // Aggregate Orders
    let salesTotal = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    const itemMap = new Map<string, number>();

    for (const order of todayOrders) {
      if (order.status === "PAID") {
        salesTotal += order.totalAmount;
        paidCount++;
      } else if (order.status === "OPEN" || order.status === "PREPARING" || order.status === "READY") {
        unpaidCount++;
      }

      for (const item of order.items) {
        const name = item.menuItem?.nameAr || "صنف غير مسمى";
        itemMap.set(name, (itemMap.get(name) || 0) + item.quantity);
      }
    }

    const topItems = Array.from(itemMap.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4);

    snapshot = {
      todaySales: salesTotal,
      todayOrdersCount: paidCount,
      unpaidOrdersCount: unpaidCount,
      todayExpenses: expensesSummary.totalAmount,
      activeShift: {
        isOpen: !!openShift,
        openedBy: openShift?.user?.name || undefined,
        initialCash: openShift?.initialCash || 0,
        startTime: openShift?.startTime?.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        expectedCash: openShift?.expectedCash,
      },
      lowStockItems: rawMaterials || [],
      topItemsToday: topItems,
    };
  } catch (err) {
    console.error("Amo Basiony stats lookup error:", err);
  }

  // Load Categories Catalog for matching
  const categories = await getExpenseCategories();

  // -------------------------------------------------------------
  // 2. CONVERSATIONAL EXPENSE RECORDING COMMANDS (سجل، صرفت، ادفع، شراء)
  // -------------------------------------------------------------
  const isRecordCommand =
    query.startsWith("سجل") ||
    query.startsWith("صرفت") ||
    query.startsWith("صرفنا") ||
    query.startsWith("ادفع") ||
    query.startsWith("شراء") ||
    query.includes("سجل مصروف") ||
    query.includes("مصروف جديد");

  if (isRecordCommand) {
    const amount = extractAmount(query);
    const matchedCategory = matchExpenseCategory(query, categories);
    const paymentMethod = extractPaymentMethod(query);

    // Case A: Missing both amount and category
    if (!amount && !matchedCategory) {
      return {
        answer: `يا مرحب بيك يا معلم! عايز تسجل مصروف؟ عينيا ليك! 💸
قولي بالظبط: المبلغ كام؟ والبند إيه؟ (مثلاً: «سجل 350 جنيه منظفات نقدي» أو «صرفت 500 لحمة كاش»).`,
        category: "expenses",
        statsSnapshot: snapshot,
        quickSuggestions: [
          "سجل 350 جنيه منظفات نقدي",
          "سجل 200 جنيه فحم شوي من الدرج",
          "سجل 150 جنيه بنزين طيارين نقدي",
          "سجل 500 جنيه لحمة مفرومة كاش",
        ],
      };
    }

    // Case B: Missing amount only
    if (!amount && matchedCategory) {
      return {
        answer: `تمام يا غالي، فهمت إن المصروف لبند **(${matchedCategory.nameAr})** 🥩✨
بس قولي كام المبلغ اللي اتصرف بالضبط؟`,
        category: "expenses",
        statsSnapshot: snapshot,
        quickSuggestions: [
          `سجل 100 جنيه ${matchedCategory.keywords[0] || matchedCategory.nameAr} نقدي`,
          `سجل 250 جنيه ${matchedCategory.keywords[0] || matchedCategory.nameAr} نقدي`,
          `سجل 500 جنيه ${matchedCategory.keywords[0] || matchedCategory.nameAr} نقدي`,
        ],
      };
    }

    // Case C: Missing category only
    if (amount && !matchedCategory) {
      return {
        answer: `المبلغ اتحدد تمام: **${amount} ج.م** 👌
بس قولي المصروف ده طلع في إيه؟ (لحوم، خضار، منظفات، فحم، بنزين، عيش، صيانة...؟)`,
        category: "expenses",
        statsSnapshot: snapshot,
        quickSuggestions: [
          `سجل ${amount} جنيه منظفات نقدي`,
          `سجل ${amount} جنيه فحم شوي نقدي`,
          `سجل ${amount} جنيه خضار وسلطة كاش`,
          `سجل ${amount} جنيه بنزين طيارين`,
        ],
      };
    }

    // Case D: Both amount and category are determined!
    // REQUEST ONE CONFIRMATION BEFORE SAVING (Requirement 5)
    if (amount && matchedCategory) {
      const payLabel =
        paymentMethod === "CASH"
          ? "نقدي (خصم من درج الكاشير)"
          : paymentMethod === "VISA"
          ? "فيزا / بطاقة إلكترونية"
          : "تحويل بنكي / فودافون كاش";

      const pending: PendingExpense = {
        amount,
        categoryName: matchedCategory.nameAr,
        categoryId: matchedCategory.id,
        item: matchedCategory.keywords[0] || matchedCategory.nameAr,
        paymentMethod,
        receiver: "غير محدد",
        notes: "تم الإدخال عبر محادثة عمو بسيوني الذكية",
      };

      const drawerImpact =
        paymentMethod === "CASH"
          ? (snapshot.activeShift.isOpen
              ? `سيتم خصمها من رصيد درج الوردية المتوقع (الرصيد الآن: ${snapshot.activeShift.expectedCash || 0} ج.م)`
              : "⚠️ تنبيه: لا توجد وردية مفتوحة حالياً؛ سيتم قيدها في دفتر المصروفات العام.")
          : "لن تخصم من نقدية الدرج (دفع إلكتروني).";

      return {
        answer: `جاهز يا معلم بسيوني! راجع ملخص المصروف قبل الاعتماد:

📋 **بيانات المصروف المطلوب تسجيله:**
• **البند:** ${matchedCategory.nameAr} (${matchedCategory.groupAr})
• **المبلغ:** **${amount.toLocaleString("ar-EG")} ج.م**
• **طريقة الدفع:** **${payLabel}**
• **أثر الخزنة:** ${drawerImpact}

اضغط زر **«تأكيد تسجيل المصروف»** بالأسفل لاعتماده وتحديث الدفاتر والدرج فوراً! 🧾👇`,
        category: "expenses",
        statsSnapshot: snapshot,
        pendingExpenseConfirmation: pending,
        quickSuggestions: [
          "تأكيد تسجيل المصروف",
          "إلغاء الأمر",
        ],
      };
    }
  }

  // -------------------------------------------------------------
  // 3. EXPENSE INQUIRIES & SUMMARIES (مصروفات النهاردة، الشهر، أعلى البنود)
  // -------------------------------------------------------------
  const isExpenseQuery = query.includes("مصروف") || query.includes("صرفنا") || query.includes("مصاريف");
  
  if (isExpenseQuery) {
    if (query.includes("شهر") || query.includes("الشهر")) {
      const monthSummary = await getExpensesSummary("MONTH");
      const topList = monthSummary.topCategories
        .map((c, i) => `${i + 1}. **${c.name}**: ${c.total.toLocaleString("ar-EG")} ج.م`)
        .join("\n");

      return {
        answer: `إجمالي مصروفات مشويات بسيوني **خلال هذا الشهر** عاملة **${monthSummary.totalAmount.toLocaleString("ar-EG")} ج.م** من واقع **${monthSummary.count} إذن صرف**.

📊 **أعلى البنود تكلفة هذا الشهر:**
${topList || "لا توجد مصروفات مسجلة حتى الآن هذا الشهر."}

💳 **طريقة السداد:**
• نقدي من الدرج: ${monthSummary.paymentBreakdown.CASH.toLocaleString("ar-EG")} ج.م
• فيزا وكروت: ${monthSummary.paymentBreakdown.VISA.toLocaleString("ar-EG")} ج.م
• تحويلات: ${monthSummary.paymentBreakdown.TRANSFER.toLocaleString("ar-EG")} ج.م`,
        category: "expenses",
        statsSnapshot: snapshot,
        quickSuggestions: [
          "مصروفات النهاردة كام؟",
          "إيه أكتر بنود صرفنا عليها؟",
          "سجل مصروف جديد",
        ],
      };
    }

    if (query.includes("أعلى") || query.includes("أكتر") || query.includes("اكبر")) {
      const monthSummary = await getExpensesSummary("MONTH");
      const topList = monthSummary.topCategories
        .map((c, i) => `${i + 1}. **${c.name}**: ${c.total.toLocaleString("ar-EG")} ج.م (${c.count} فواتير)`)
        .join("\n");

      return {
        answer: `أكتر البنود اللي سحبت ميزانية الفترة دي يا باشا:
${topList || "الدفاتر بيضاء ولسه مفيش بنود مسجلة."}

💡 **نصيحة عمو بسيوني:**
دايماً راجع خامات الشوي واللحوم والتغليف أول بأول عشان تضمن أعلى هامش ربح وتمنع أي هدر! 👌`,
        category: "expenses",
        statsSnapshot: snapshot,
        quickSuggestions: [
          "مصروفات النهاردة كام؟",
          "سجل 350 جنيه منظفات نقدي",
          "طمّني على مبيعات وردية النهاردة",
        ],
      };
    }

    // Default Today's Expenses
    const todaySummary = await getExpensesSummary("TODAY");
    const topList = todaySummary.topCategories
      .map((c, i) => `• **${c.name}**: ${c.total.toLocaleString("ar-EG")} ج.م`)
      .join("\n");

    return {
      answer: `مصروفات مطعم مشويات بسيوني **النهاردة** عاملة **${todaySummary.totalAmount.toLocaleString("ar-EG")} ج.م** بإجمالي **${todaySummary.count} مصروفات مسجلة**.

${topList ? `تفصيل البنود:\n${topList}` : "الحمد لله مفيش مصروفات كتير مسجلة النهاردة."}

نقدية الدرج اتخصم منها: **${todaySummary.paymentBreakdown.CASH.toLocaleString("ar-EG")} ج.م**. ربنا يعوض بالخير والبركة! 🔥🥩`,
      category: "expenses",
      statsSnapshot: snapshot,
      quickSuggestions: [
        "إجمالي مصروفات الشهر",
        "إيه أكتر بنود صرفنا عليها؟",
        "سجل 200 جنيه فحم شوي من الدرج",
      ],
    };
  }

  // -------------------------------------------------------------
  // 4. SHIFT & CASH DRAWER RECONCILIATION
  // -------------------------------------------------------------
  const isShiftQuery = query.includes("وردية") || query.includes("قفل") || query.includes("جرد") || query.includes("عجز") || query.includes("زيادة");
  if (isShiftQuery) {
    return {
      answer: `بص يا فنان، قفلة الوردية دي أمانة وقانون:
1. **عِد النقدية في الدرج بتركيز تام** قبل ما تدخل رقم الفعلي في السيستم.
2. **شيكات الدليفري المعلقة** لازم تتقفل مع الطيارين ويتسجل تحصيلها.
3. **المصروفات اليومية**: لو صرفت أي حاجة، سجلها فوراً معايا («سجل ... نقدي») عشان تتخصم من الدرج وماتعملش عجز وهمي.
4. اطبع فوراً **تقرير الـ Z-Report** وخلي المستلم والكاشير يوقعوا عليه.`,
      category: "cashier",
      statsSnapshot: snapshot,
      quickSuggestions: [
        "طمّني على مبيعات وردية النهاردة والدرج",
        "مصروفات النهاردة كام؟",
        "سجل مصروف جديد",
      ],
    };
  }

  // -------------------------------------------------------------
  // 5. INVENTORY & GRILLS STOCK
  // -------------------------------------------------------------
  const isStockQuery = query.includes("مخزون") || query.includes("لحم") || query.includes("نواقص") || query.includes("خامات") || query.includes("بضاعة") || query.includes("تتبيل");
  if (isStockQuery) {
    let stockAnswer = "";
    if (snapshot.lowStockItems.length > 0) {
      const list = snapshot.lowStockItems.map(i => `• **${i.name}**: باقي ${i.currentStock} ${i.unit} (الحد الأدنى ${i.minStockLevel})`).join("\n");
      stockAnswer = `عينيا يا باشا، خد بالك الجريل مايستناش! عندنا خامات قربت تخلص ومحتاجة إذن شراء سريع:
${list}

**نصيحة عمو بسيوني للجريل:**
اللحوم والريش البلدي لازم تتتبل قبلها بـ 4 ساعات على الأقل وتفضل مبردة عند 4 درجات، متستناش لما المخزون يصفر عشان الزباين ماتاخدش اعتذارات!`;
    } else {
      stockAnswer = `كله تمام التمام يا غالي! المخزون في السليم والحمد لله مفيش أي خامات واصلة لحد النقص الحرج حالياً.
فحم الشوي واللحوم والتتبيلة في الأمان، بس خلي عينك دايماً على وزن الهبيش والشواية عشان نحافظ على الهامش المظبوط! 🍖✨`;
    }
    return {
      answer: stockAnswer,
      category: "inventory",
      statsSnapshot: snapshot,
      quickSuggestions: [
        "سجل 500 جنيه لحمة بلدي كاش",
        "سجل 200 جنيه فحم شوي من الدرج",
        "مين أكتر أصناف مشويات مسمّعة النهاردة؟",
      ],
    };
  }

  // -------------------------------------------------------------
  // 5.5 CUSTOMER GRILLING SERVICE & RAW WEIGHT RULES (شوي للغير والأوزان)
  // -------------------------------------------------------------
  const isGrillingQuery =
    query.includes("شوي للغير") ||
    query.includes("خامات العميل") ||
    query.includes("تسوية") ||
    query.includes("انكماش") ||
    query.includes("وزن المشويات") ||
    query.includes("خدمة الشوي");

  if (isGrillingQuery) {
    return {
      answer: `يا هلا بيك يا معلم! نظام **«شوي للغير — خامات العميل»** وبيع المشويات بالوزن في مشويات بسيوني ماشي بأصول وقواعد محاسبية صارمة:

1. **القاعدة الذهبية (حماية المخزون)**:
   لحوم وفراخ الزبائن **لا تدخل إطلاقاً في مبيعات المطعم ولا تُخصم من مخزوننا**!
   الفاتورة المحصلة تشمل فقط: **رسوم خدمة الشوي + الإضافات (سلطات، طحينة، عيش، مشروبات)**.

2. **التسعير العادل للشوي**:
   • لحم بلدي / ضاني / ريش / كفتة مجهزة: **60 ج.م / كجم**.
   • فراخ وشيش طاووق: **50 ج.م / كجم** (أو **25 ج.م / فرخة بالقطعة**).
   • خدمة تسوية مقطوعة ثابتة: **30 ج.م**.

3. **الوزن قبل وبعد التسوية**:
   الحساب دائماً على **الوزن النيء**. بنسجل الوزن بعد التسوية لمتابعة نسبة الانكماش الطبيعي وجودة الشوي بدون ما نطالب العميل بمليم زيادة.

4. **بونات الأمان 80 مم**:
   بون الشواية للمطبخ عليه تحذير صريح بعدم الخصم من المخزون، وبون التسليم بعدد العلب وتوقيع الاستلام.`,
      category: "grills",
      statsSnapshot: snapshot,
      quickSuggestions: [
        "إيراد خدمة الشوي للغير كام؟",
        "طمّني على مبيعات وردية النهاردة",
        "مصروفات النهاردة كام؟",
        "سجل 200 جنيه فحم شوي من الدرج",
      ],
    };
  }

  // -------------------------------------------------------------
  // 6. MENU & TOP SELLING GRILLS
  // -------------------------------------------------------------
  const isMenuQuery = query.includes("منيو") || query.includes("صنف") || query.includes("كباب") || query.includes("كفتة") || query.includes("طلب") || query.includes("أكتر");
  if (isMenuQuery) {
    let menuAnswer = "";
    if (snapshot.topItemsToday.length > 0) {
      const topList = snapshot.topItemsToday.map((item, idx) => `${idx + 1}. **${item.name}** (طلب منها ${item.quantity} طلب)`).join("\n");
      menuAnswer = `أكتر الأصناف اللي مسمّعة وشايلة الشغل النهاردة في مشويات بسيوني:
${topList}

**سر الصنعة من عمو بسيوني:**
الأصناف دي هي فرسان الرهان؛ اتأكد إن صوص الطحينة البلدي والمخلل وسلطة بلدي دايماً طازة وموجودين جنبها، الزبون بيطلب بالأصول! 👌`;
    } else {
      menuAnswer = `المنيو بتاعنا معتمد ومميز:
1. **مشويات وكباب وكفتة بسيوني المشكل**: ريحة الشوي على الفحم اللي ملهاش بديل.
2. **صواني العائلات والمندي**: بتظبط الإيراد ومتوسط الفاتورة بشكل ممتاز.
3. **التيك أواي والديليفري**: خدمة سريعة ومحكمة في التغليف عشان الطلب يوصل سخن نار.`;
    }
    return {
      answer: menuAnswer,
      category: "grills",
      statsSnapshot: snapshot,
      quickSuggestions: [
        "طمّني على مبيعات وردية النهاردة",
        "مصروفات النهاردة كام؟",
        "سجل 350 جنيه منظفات نقدي",
      ],
    };
  }

  // -------------------------------------------------------------
  // 7. SALES & CASH IN DRAWER
  // -------------------------------------------------------------
  const isSalesQuery = query.includes("مبيع") || query.includes("فلوس") || query.includes("إيراد") || query.includes("حساب") || query.includes("درج") || query.includes("شيك");
  if (isSalesQuery) {
    const avgOrder = snapshot.todayOrdersCount > 0 ? (snapshot.todaySales / snapshot.todayOrdersCount).toFixed(1) : "0";
    return {
      answer: `يا هلا بيك يا معلم! مبيعات مشويات بسيوني النهاردة حتى اللحظة عاملة **${snapshot.todaySales.toLocaleString("ar-EG")} ج.م** من إجمالي **${snapshot.todayOrdersCount} طلب مسدد**.
    
متوسط الفاتورة الواحدة حوالي **${avgOrder} ج.م**.
إجمالي المصروفات المسجلة اليوم: **${snapshot.todayExpenses.toLocaleString("ar-EG")} ج.م**.
${snapshot.activeShift.isOpen ? `الوردية شغالة برعاية المعلم (${snapshot.activeShift.openedBy || "الكاشير"}) ورصيد الدرج المتوقع: ${snapshot.activeShift.expectedCash?.toLocaleString("ar-EG") || 0} ج.م.` : "⚠️ ملحوظة: مفيش وردية مفتوحة حالياً، اتأكد من فتح الوردية عشان الفلوس تتقفل صح!"}
ربنا يطرح البركة ويزيد الخير! 🔥🥩`,
      category: "sales",
      statsSnapshot: snapshot,
      quickSuggestions: [
        "مصروفات النهاردة كام؟",
        "سجل 350 جنيه منظفات نقدي",
        "إيه أخبار نواقص المخزون واللحمة والجريل؟",
      ],
    };
  }

  // -------------------------------------------------------------
  // 8. GENERAL INTRO
  // -------------------------------------------------------------
  return {
    answer: `أنا **عمو بسيوني**، شيخ الكار ومستشارك في مطعم مشويات بسيوني! 🥩🔥
معاك لحظة بلحظة في:
• **تسجيل واستعلام المصروفات بالمحادثة** (مثلاً: «سجل 350 جنيه منظفات نقدي»).
• **حسابات الخزنة والدرج والورديات**.
• **مبيعات اليوم والطلبات وحالة المخزون**.

اختار أي حاجة من الاقتراحات السريعة أو اكتبلي في الشات وأنا في خدمتك!`,
    category: "general",
    statsSnapshot: snapshot,
    quickSuggestions: [
      "💸 سجل 350 جنيه منظفات نقدي",
      "📊 مصروفات النهاردة كام؟",
      "📈 طمّني على مبيعات وردية النهاردة والدرج",
      "🥩 إيه أخبار نواقص المخزون واللحمة والجريل؟",
    ],
  };
}

/**
 * 2. Execute Confirmed Expense (Called directly upon clicking the confirmation button)
 */
export async function confirmExpenseRegistration(pending: PendingExpense) {
  const result = await recordExpense({
    amount: pending.amount,
    item: pending.item,
    categoryId: pending.categoryId,
    categoryName: pending.categoryName,
    paymentMethod: pending.paymentMethod,
    receiver: pending.receiver,
    notes: pending.notes,
  });

  if (!result.success) {
    return {
      success: false,
      answer: `عذراً يا معلم بسيوني، حصل خطأ أثناء حفظ المصروف: ${result.error}`,
    };
  }

  const payAr = pending.paymentMethod === "CASH" ? "نقداً من درج الكاشير" : pending.paymentMethod === "VISA" ? "عبر الفيزا" : "تحويل بنكي";

  return {
    success: true,
    confirmedExpense: {
      id: result.expense?.id || "",
      amount: pending.amount,
      categoryName: pending.categoryName,
      paymentMethod: pending.paymentMethod,
    },
    answer: `تم اعتماد وتسجيل المصروف بنجاح يا معلم بسيوني! 🧾✨
• **البند:** ${pending.categoryName}
• **المبلغ:** ${pending.amount.toLocaleString("ar-EG")} ج.م (${payAr})
${result.shiftUpdated ? `• **الخزنة والوردية:** تم خصمها فوراً من الدرج وتحديث الوردية رقم #${result.shiftNumber}.` : "• تم قيدها في دفتر المصروفات المركزي."}
الدفاتر تمام والدرج مظبوط بالقرش! 👌`,
  };
}
