"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface AmoBasionySnapshot {
  todaySales: number;
  todayOrdersCount: number;
  unpaidOrdersCount: number;
  activeShift: {
    isOpen: boolean;
    openedBy?: string;
    initialCash?: number;
    startTime?: string;
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

export interface AssistantResponse {
  answer: string;
  category: "sales" | "inventory" | "grills" | "cashier" | "general";
  statsSnapshot?: AmoBasionySnapshot;
  quickSuggestions: string[];
}

export async function askAmoBasiony(userQuery: string): Promise<AssistantResponse> {
  const query = (userQuery || "").trim().toLowerCase();
  
  // 1. Gather Real-Time Operational Context from Database safely
  let snapshot: AmoBasionySnapshot = {
    todaySales: 0,
    todayOrdersCount: 0,
    unpaidOrdersCount: 0,
    activeShift: { isOpen: false },
    lowStockItems: [],
    topItemsToday: [],
  };

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [todayOrders, openShift, rawMaterials] = await Promise.all([
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
      activeShift: {
        isOpen: !!openShift,
        openedBy: openShift?.user?.name || undefined,
        initialCash: openShift?.initialCash || 0,
        startTime: openShift?.startTime?.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      },
      lowStockItems: rawMaterials || [],
      topItemsToday: topItems,
    };
  } catch (err) {
    console.error("Amo Basiony stats lookup error:", err);
  }

  // 2. Intelligent Persona Engine for "عمو بسيوني"
  // Handles questions about Sales, Cash Drawer, Inventory, Grills, Recipes, Cashier closing, etc.
  let answer = "";
  let category: AssistantResponse["category"] = "general";

  const isSalesQuery = query.includes("مبيع") || query.includes("فلوس") || query.includes("إيراد") || query.includes("حساب") || query.includes("درج") || query.includes("شيك");
  const isStockQuery = query.includes("مخزون") || query.includes("لحم") || query.includes("نواقص") || query.includes("خامات") || query.includes("بضاعة") || query.includes("تتبيل");
  const isMenuQuery = query.includes("منيو") || query.includes("صنف") || query.includes("كباب") || query.includes("كفتة") || query.includes("طلب") || query.includes("أكتر");
  const isShiftQuery = query.includes("وردية") || query.includes("قفل") || query.includes("جرد") || query.includes("عجز") || query.includes("زيادة");

  if (isSalesQuery) {
    category = "sales";
    const avgOrder = snapshot.todayOrdersCount > 0 ? (snapshot.todaySales / snapshot.todayOrdersCount).toFixed(1) : "0";
    answer = `يا هلا بيك يا معلم! مبيعات مشويات بسيوني النهاردة حتى اللحظة عاملة **${snapshot.todaySales.toLocaleString("ar-EG")} ج.م** من إجمالي **${snapshot.todayOrdersCount} طلب مسدد**.
    
متوسط الفاتورة الواحدة حوالي **${avgOrder} ج.م**. وفيه دلوقتي **${snapshot.unpaidOrdersCount} طلبات مفتوحة/قيد التحضير** لسه ماتحاسبش عليها.
${snapshot.activeShift.isOpen ? `الوردية شغالة برعاية المعلم (${snapshot.activeShift.openedBy || "الكاشير"}) وفيها عهدة افتتاحية ${snapshot.activeShift.initialCash} ج.م.` : "⚠️ ملحوظة: مفيش وردية مفتوحة حالياً، اتأكد من فتح الوردية عشان الفلوس تتقفل صح!"}
ربنا يطرح البركة ويزيد الخير! 🔥🥩`;
  } else if (isStockQuery) {
    category = "inventory";
    if (snapshot.lowStockItems.length > 0) {
      const list = snapshot.lowStockItems.map(i => `• **${i.name}**: باقي ${i.currentStock} ${i.unit} (الحد الأدنى ${i.minStockLevel})`).join("\n");
      answer = `عينيا يا باشا، خد بالك الجريل مايستناش! عندنا خامات قربت تخلص ومحتاجة إذن شراء سريع:
${list}

**نصيحة عمو بسيوني للجريل:**
اللحوم والريش البلدي لازم تتتبل قبلها بـ 4 ساعات على الأقل وتفضل مبردة عند 4 درجات، متستناش لما المخزون يصفر عشان الزباين ماتاخدش اعتذارات!`;
    } else {
      answer = `كله تمام التمام يا غالي! المخزون في السليم والحمد لله مفيش أي خامات واصلة لحد النقص الحرج حالياً.
فحم الشوي واللحوم والتتبيلة في الأمان، بس خلي عينك دايماً على وزن الهبيش والشواية عشان نحافظ على الهامش المظبوط! 🍖✨`;
    }
  } else if (isMenuQuery) {
    category = "grills";
    if (snapshot.topItemsToday.length > 0) {
      const topList = snapshot.topItemsToday.map((item, idx) => `${idx + 1}. **${item.name}** (طلب منها ${item.quantity} طلب)`).join("\n");
      answer = `أكتر الأصناف اللي مسمّعة وشايلة الشغل النهاردة في مشويات بسيوني:
${topList}

**سر الصنعة من عمو بسيوني:**
الأصناف دي هي فرسان الرهان؛ اتأكد إن صوص الطحينة البلدي والمخلل وسلطة بلدي دايماً طازة وموجودين جنبها، الزبون بيطلب بالأصول! 👌`;
    } else {
      answer = `المنيو بتاعنا معتمد ومميز:
1. **مشويات وكباب وكفتة بسيوني المشكل**: ريحة الشوي على الفحم اللي ملهاش بديل.
2. **صواني العائلات والمندي**: بتظبط الإيراد ومتوسط الفاتورة بشكل ممتاز.
3. **التيك أواي والديليفري**: خدمة سريعة ومحكمة في التغليف عشان الطلب يوصل سخن نار.`;
    }
  } else if (isShiftQuery) {
    category = "cashier";
    answer = `بص يا فنان، قفلة الوردية دي أمانة وقانون:
1. **عِد النقدية في الدرج بتركيز تام** قبل ما تدخل رقم الفعلي في السيستم.
2. **شيكات الدليفري المعلقة** لازم تتقفل مع الطيارين ويتسجل تحصيلها.
3. **أي مصروف طارئ** (شراء خضار، بيبسي، فحم، نظافة) لازم يتسجل فوري باسم المستلم عشان ميعملش عجز وهمي في الدرج.
4. اطبع فوراً **تقرير الـ Z-Report** وخلي المستلم والكاشير يوقعوا عليه.`;
  } else {
    category = "general";
    answer = `أنا **عمو بسيوني**، شيخ الكار ومستشارك في مطعم مشويات بسيوني! 🥩🔥
معاك في طالع ونازل الصالة والتيك أواي والدليفري والجريل والتقارير.
تقدر تسألني في أي وقت عن:
- مبيعات اليوم ووضع الدرج والورديات.
- حالة المخزون ونواقص الخامات ومشتريات الجزارة.
- الأصناف الأكثر مبيعاً وضبط نسب الهدر والربحية.
- إدارة المطعم وتشغيل الطابعات الصامتة Xprinter 80mm.

أؤمرني يا غالي وأنا معاك لحظة بلحظة!`;
  }

  return {
    answer,
    category,
    statsSnapshot: snapshot,
    quickSuggestions: [
      "📊 طمّني على مبيعات وردية النهاردة",
      "🥩 إيه أخبار نواقص المخزون واللحمة والجريل؟",
      "🔥 مين أكتر الأصناف شداً وطلباً النهاردة؟",
      "💡 نصيحة عمو بسيوني لتقليل الهدر وضبط الحسابات",
    ],
  };
}
