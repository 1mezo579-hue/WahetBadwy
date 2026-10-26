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

// -------------------------------------------------------------
// TYPE DEFINITIONS
// -------------------------------------------------------------

export interface OrderSearchResult {
  id: string;
  orderNumber: number;
  orderType: string;
  orderTypeAr: string;
  orderKind?: string | null;
  status: string;
  statusAr: string;
  workflowStatus: string;
  workflowStatusAr: string;
  totalAmount: number;
  subtotal: number;
  discount: number;
  paymentStatus: "PAID" | "UNPAID" | "CANCELLED";
  paymentStatusAr: string;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  tableName?: string | null;
  createdAt: string;
  createdAtFormatted: string;
  createdAtDate: string;
  createdAtTime: string;
  notes?: string | null;
  reprintCount: number;
  meatType?: string | null;
  customerMeatWeight?: number | null;
  itemsCount: number;
  items: Array<{
    nameAr: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string | null;
    isCustomerMeat?: boolean | null;
  }>;
}

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
  category: "sales" | "inventory" | "grills" | "cashier" | "expenses" | "orders_search" | "admin_report" | "general" | "admin_restricted";
  statsSnapshot?: AmoBasionySnapshot;
  quickSuggestions: string[];
  pendingExpenseConfirmation?: PendingExpense;
  matchingOrders?: OrderSearchResult[];
  confirmedExpense?: {
    id: string;
    amount: number;
    categoryName: string;
    paymentMethod: string;
  };
}

export interface AdminReportData {
  authorized: boolean;
  title: string;
  periodLabel: string;
  summary: {
    grossSales: number;
    netSales: number;
    totalDiscounts: number;
    totalOrdersCount: number;
    paidOrdersCount: number;
    cancelledOrdersCount: number;
    cancelledTotalAmount: number;
    totalExpenses: number;
    drawerShortageTotal: number;
    drawerOverageTotal: number;
    estimatedCostOfGoods: number;
    estimatedNetProfit: number;
    isProfitEstimated: boolean;
  };
  channelBreakdown: {
    channel: string;
    channelAr: string;
    count: number;
    total: number;
    percentage: number;
  }[];
  cashierBreakdown: {
    cashierName: string;
    ordersCount: number;
    totalSales: number;
  }[];
  topItems: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
  recentCancellations: {
    orderNumber: number;
    totalAmount: number;
    time: string;
    cashier: string;
    reason: string;
  }[];
  shiftReconciliations: {
    shiftNumber: number;
    cashierName: string;
    startTime: string;
    endTime?: string;
    initialCash: number;
    expectedCash: number;
    actualCash: number;
    shortageOverage: number;
    status: string;
  }[];
  anomalies: string[];
  textAnswer?: string;
}

// -------------------------------------------------------------
// ARABIC LOCALIZATION HELPERS
// -------------------------------------------------------------

function getOrderTypeAr(type: string, kind?: string | null): string {
  if (kind === "CUSTOMER_GRILL") return "شوي للغير (خامة العميل)";
  switch (type) {
    case "DINE_IN":
      return "صالة";
    case "TAKEAWAY":
      return "تيك أواي / سفري";
    case "DELIVERY":
      return "دليفري / توصيل";
    default:
      return type || "عادي";
  }
}

function getWorkflowStatusAr(status?: string | null): string {
  switch (status) {
    case "NEW":
      return "جديد";
    case "PREPARING":
      return "قيد التجهيز والشوي";
    case "READY":
      return "جاهز للتسليم";
    case "DELIVERED":
      return "تم التسليم";
    case "RECEIVED_CUSTOMER_MEAT":
      return "تم استلام لحم العميل";
    default:
      return status || "غير محدد";
  }
}

function getPaymentStatusAr(status: string): string {
  switch (status) {
    case "PAID":
      return "مدفوع بالكامل ✓";
    case "OPEN":
      return "غير مدفوع / مفتوح ⏳";
    case "CANCELLED":
      return "ملغي ✕";
    default:
      return status;
  }
}

// -------------------------------------------------------------
// 1. CASHIER ORDER SEARCH (عمو بسيوني — البحث عن الأوردرات للكاشير)
// -------------------------------------------------------------

/**
 * Allows cashiers, managers, and admins to search for orders by:
 * - Order Number (e.g. 125, #125)
 * - Customer Phone (e.g. 01012345678)
 * - Customer Name
 * - Order ID / Client ID
 *
 * Results are returned from newest to oldest.
 * Strictly avoids leaking internal purchase costs or wholesale profit data.
 */
export async function searchOrdersForCashier({
  query,
  limit = 25,
}: {
  query: string;
  limit?: number;
}): Promise<{ success: boolean; orders: OrderSearchResult[]; totalFound: number; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, orders: [], totalFound: 0, error: "يجب تسجيل الدخول للبحث عن الأوردرات" };
    }

    const raw = (query || "").trim();
    if (!raw) {
      return { success: true, orders: [], totalFound: 0 };
    }

    const cleanNumberStr = raw.replace(/^#/, "").trim();
    const isNumeric = /^\d+$/.test(cleanNumberStr);
    const parsedNumber = isNumeric ? parseInt(cleanNumberStr, 10) : null;

    const orClauses: any[] = [
      { customerPhone: { contains: raw } },
      { customerName: { contains: raw, mode: "insensitive" } },
      { id: { contains: raw } },
      { customer: { phone: { contains: raw } } },
      { customer: { name: { contains: raw, mode: "insensitive" } } },
    ];

    if (parsedNumber !== null && parsedNumber > 0 && parsedNumber < 2147483647) {
      orClauses.push({ orderNumber: parsedNumber });
    }

    const dbOrders = await prisma.order.findMany({
      where: {
        OR: orClauses,
      },
      orderBy: {
        createdAt: "desc", // Newest to oldest
      },
      take: Math.min(limit, 50),
      include: {
        table: {
          select: { name: true, number: true },
        },
        items: {
          include: {
            menuItem: {
              select: {
                nameAr: true,
              },
            },
          },
        },
      },
    });

    const sanitizedOrders: OrderSearchResult[] = dbOrders.map((o) => {
      const isPaid = o.status === "PAID";
      const isCancelled = o.workflowStatus === "CANCELLED";
      const paymentStatus: "PAID" | "UNPAID" | "CANCELLED" = isCancelled ? "CANCELLED" : isPaid ? "PAID" : "UNPAID";

      const createdDate = new Date(o.createdAt);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderType: o.orderType,
        orderTypeAr: getOrderTypeAr(o.orderType, o.orderKind),
        orderKind: o.orderKind,
        status: o.status,
        statusAr: isCancelled ? "ملغي" : isPaid ? "مسدد" : "مفتوح",
        workflowStatus: o.workflowStatus || "NEW",
        workflowStatusAr: getWorkflowStatusAr(o.workflowStatus),
        totalAmount: o.totalAmount,
        subtotal: o.subtotal,
        discount: o.discount || 0,
        paymentStatus,
        paymentStatusAr: getPaymentStatusAr(o.status),
        customerName: o.customerName || null,
        customerPhone: o.customerPhone || null,
        deliveryAddress: o.deliveryAddress || null,
        tableName: o.table ? (o.table.name || `طاولة ${o.table.number}`) : null,
        createdAt: createdDate.toISOString(),
        createdAtFormatted: createdDate.toLocaleString("ar-EG", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        createdAtDate: createdDate.toLocaleDateString("ar-EG"),
        createdAtTime: createdDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        notes: o.notes,
        reprintCount: o.reprintCount || 0,
        meatType: o.meatType,
        customerMeatWeight: o.customerMeatWeight,
        itemsCount: o.items.length,
        items: o.items.map((it) => ({
          nameAr: it.menuItem?.nameAr || "صنف مشويات",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          notes: it.notes,
          isCustomerMeat: it.isCustomerMeat,
        })),
      };
    });

    return {
      success: true,
      orders: sanitizedOrders,
      totalFound: sanitizedOrders.length,
    };
  } catch (error: any) {
    console.error("Order search error:", error);
    return { success: false, orders: [], totalFound: 0, error: error.message || "فشل البحث عن الأوردرات" };
  }
}

// -------------------------------------------------------------
// 2. ADMIN SMART ASSISTANT & REPORTS (مساعد الأدمن الذكي — التقارير الشاملة)
// -------------------------------------------------------------

/**
 * Generates comprehensive real-time data-driven reports exclusively for ADMIN.
 * Strictly verifies admin role on the server.
 * Reconciles sales, safe, shifts, cancellations, discounts, P&L.
 */
export async function askAdminAssistant({
  query,
  period = "TODAY",
}: {
  query: string;
  period?: "TODAY" | "WEEK" | "MONTH" | "ALL";
}): Promise<AdminReportData> {
  // 1. STRICT SERVER-SIDE ROLE ENFORCEMENT
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;

  if (!session || !session.user || userRole !== "ADMIN") {
    return {
      authorized: false,
      title: "صلاحية مقيدة",
      periodLabel: "غير مصرح",
      summary: {
        grossSales: 0,
        netSales: 0,
        totalDiscounts: 0,
        totalOrdersCount: 0,
        paidOrdersCount: 0,
        cancelledOrdersCount: 0,
        cancelledTotalAmount: 0,
        totalExpenses: 0,
        drawerShortageTotal: 0,
        drawerOverageTotal: 0,
        estimatedCostOfGoods: 0,
        estimatedNetProfit: 0,
        isProfitEstimated: false,
      },
      channelBreakdown: [],
      cashierBreakdown: [],
      topItems: [],
      recentCancellations: [],
      shiftReconciliations: [],
      anomalies: [],
      textAnswer: "عذرًا، هذه التقارير الإدارية والرقابة المالية مخصصة حصريًا لحساب الأدمن (الإدارة العليا) وفقاً لسياسة الصلاحيات المعتمدة.",
    };
  }

  // 2. Determine Date Bounds
  const now = new Date();
  let startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  let periodLabel = "اليوم";

  if (period === "WEEK") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    periodLabel = "آخر 7 أيام";
  } else if (period === "MONTH") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    periodLabel = "هذا الشهر";
  } else if (period === "ALL") {
    startDate = new Date(2020, 0, 1);
    periodLabel = "كل الفترات";
  }

  // Detect specific query topics
  const q = (query || "").toLowerCase();
  if (q.includes("أمس") || q.includes("امبارح")) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    periodLabel = "أمس";
  }

  // 3. Query Database
  const [orders, shifts, rawMaterials, expensesSummary, recentAuditCancellations] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      include: {
        user: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            menuItem: {
              include: {
                recipeItems: {
                  include: { rawMaterial: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shift.findMany({
      where: {
        startTime: { gte: startDate },
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { startTime: "desc" },
    }),
    prisma.rawMaterial.findMany({
      take: 50,
      orderBy: { currentStock: "asc" },
    }),
    getExpensesSummary(period === "TODAY" ? "TODAY" : period === "MONTH" ? "MONTH" : "ALL"),
    prisma.$queryRawUnsafe(
      `SELECT id, order_id, user_name, reason, details, created_at
       FROM audit_logs
       WHERE action = 'ORDER_CANCELLED' AND created_at >= $1
       ORDER BY created_at DESC LIMIT 15`,
      startDate
    ).catch(() => [] as any[]),
  ]);

  // 4. Calculations
  let grossSales = 0;
  let totalDiscounts = 0;
  let netSales = 0;
  let paidCount = 0;
  let cancelledCount = 0;
  let cancelledTotal = 0;
  let estimatedCostOfGoods = 0;

  const channelMap = new Map<string, { count: number; total: number }>();
  const cashierMap = new Map<string, { count: number; total: number }>();
  const itemMap = new Map<string, { count: number; revenue: number }>();
  const recentCancellationsList: any[] = [];
  const anomalies: string[] = [];

  for (const o of orders) {
    if (o.workflowStatus === "CANCELLED") {
      cancelledCount++;
      cancelledTotal += o.totalAmount;
      recentCancellationsList.push({
        orderNumber: o.orderNumber,
        totalAmount: o.totalAmount,
        time: new Date(o.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        cashier: o.user?.name || "كاشير",
        reason: o.notes || "إلغاء الطلب",
      });
      continue;
    }

    if (o.status === "PAID") {
      paidCount++;
      grossSales += (o.subtotal || o.totalAmount);
      totalDiscounts += (o.discount || 0);
      netSales += o.totalAmount;

      // Channel breakdown
      const chKey = o.orderKind === "CUSTOMER_GRILL" ? "CUSTOMER_GRILL" : o.orderType;
      const ch = channelMap.get(chKey) || { count: 0, total: 0 };
      ch.count++;
      ch.total += o.totalAmount;
      channelMap.set(chKey, ch);

      // Cashier breakdown
      const cName = o.user?.name || "الكاشير العام";
      const cash = cashierMap.get(cName) || { count: 0, total: 0 };
      cash.count++;
      cash.total += o.totalAmount;
      cashierMap.set(cName, cash);

      // Item Sales & Recipe COGS
      for (const item of o.items) {
        const iName = item.menuItem?.nameAr || "صنف";
        const cur = itemMap.get(iName) || { count: 0, revenue: 0 };
        cur.count += item.quantity;
        cur.revenue += item.totalPrice;
        itemMap.set(iName, cur);

        // Compute ingredient cost if recipes exist
        if (item.menuItem?.recipeItems && item.menuItem.recipeItems.length > 0) {
          for (const r of item.menuItem.recipeItems) {
            const matCost = (r.rawMaterial?.costPerUnit || 0) * r.quantity * item.quantity;
            estimatedCostOfGoods += matCost;
          }
        }
      }

      // Check anomalies on paid order
      if (o.discount > 100 || (o.subtotal > 0 && o.discount / o.subtotal > 0.2)) {
        anomalies.push(`خصم استثنائي بقيمة ${o.discount} ج.م على الطلب #${o.orderNumber}`);
      }
      if ((o.reprintCount || 0) > 1) {
        anomalies.push(`الطلب #${o.orderNumber} تمت إعادة طباعته ${o.reprintCount} مرات`);
      }
    }
  }

  // Shift Reconciliations
  let drawerShortageTotal = 0;
  let drawerOverageTotal = 0;
  const shiftList = shifts.map((s) => {
    const shortageOverage = s.shortageOverage || 0;
    if (shortageOverage < 0) {
      drawerShortageTotal += Math.abs(shortageOverage);
      anomalies.push(`عجز نقدي بقيمة ${Math.abs(shortageOverage).toFixed(2)} ج.م في الوردية #${s.shiftNumber} (${s.user?.name || "كاشير"})`);
    } else if (shortageOverage > 0) {
      drawerOverageTotal += shortageOverage;
    }

    return {
      shiftNumber: s.shiftNumber,
      cashierName: s.user?.name || "كاشير",
      startTime: new Date(s.startTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      endTime: s.endTime ? new Date(s.endTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : undefined,
      initialCash: s.initialCash,
      expectedCash: s.expectedCash,
      actualCash: s.actualCash || s.expectedCash,
      shortageOverage,
      status: s.status === "OPEN" ? "مفتوحة 🟢" : "مقفلة ومجردة 🔒",
    };
  });

  const channelBreakdown = Array.from(channelMap.entries()).map(([k, v]) => ({
    channel: k,
    channelAr: getOrderTypeAr(k, k === "CUSTOMER_GRILL" ? "CUSTOMER_GRILL" : null),
    count: v.count,
    total: v.total,
    percentage: netSales > 0 ? Math.round((v.total / netSales) * 100) : 0,
  }));

  const cashierBreakdown = Array.from(cashierMap.entries()).map(([k, v]) => ({
    cashierName: k,
    ordersCount: v.count,
    totalSales: v.total,
  }));

  const topItems = Array.from(itemMap.entries())
    .map(([name, data]) => ({ name, quantity: data.count, revenue: data.revenue }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const totalExpenses = expensesSummary.totalAmount || 0;
  const estimatedNetProfit = netSales - estimatedCostOfGoods - totalExpenses;

  // Build textual executive answer in Arabic
  const answerParagraphs: string[] = [
    `📊 **تقرير الإدارة والرقابة المالية (${periodLabel}) — مشويات بسيوني**`,
    `• **صافي المبيعات المحصلة:** **${netSales.toLocaleString("ar-EG")} ج.م** (${paidCount} طلب مسدد)`,
    `• **إجمالي الخصومات:** **${totalDiscounts.toLocaleString("ar-EG")} ج.م**`,
    `• **الفواتير الملغاة:** **${cancelledCount} فاتورة** (بقيمة ملغاة: ${cancelledTotal.toLocaleString("ar-EG")} ج.م)`,
    `• **إجمالي المصروفات والنثريات:** **${totalExpenses.toLocaleString("ar-EG")} ج.م**`,
    `• **حالة الخزنة:** ${
      drawerShortageTotal > 0
        ? `⚠️ يوجد عجز نقدي تراكمي بالدرج قدره **${drawerShortageTotal.toFixed(2)} ج.م** في الورديات.`
        : `✓ الخزنة مطابقة تمامًا بدون عجز مسجل.`
    }`,
    `• **صافي الربح التقديري:** **${estimatedNetProfit.toLocaleString("ar-EG")} ج.م** (تنويه: محسوب وفق التكاليف والمصروفات المسجلة فعليًا بالنظام)`,
  ];

  if (anomalies.length > 0) {
    answerParagraphs.push(`\n🚨 **العمليات والاستثناءات المرصودة للرقابة:**\n${anomalies.slice(0, 4).map((a) => `• ${a}`).join("\n")}`);
  }

  return {
    authorized: true,
    title: `تقرير الإدارة المالية (${periodLabel})`,
    periodLabel,
    summary: {
      grossSales,
      netSales,
      totalDiscounts,
      totalOrdersCount: orders.length,
      paidOrdersCount: paidCount,
      cancelledOrdersCount: cancelledCount,
      cancelledTotalAmount: cancelledTotal,
      totalExpenses,
      drawerShortageTotal,
      drawerOverageTotal,
      estimatedCostOfGoods,
      estimatedNetProfit,
      isProfitEstimated: true,
    },
    channelBreakdown,
    cashierBreakdown,
    topItems,
    recentCancellations: recentCancellationsList.slice(0, 8),
    shiftReconciliations: shiftList.slice(0, 6),
    anomalies: anomalies.slice(0, 10),
    textAnswer: answerParagraphs.join("\n"),
  };
}

// -------------------------------------------------------------
// 3. FINANCIAL AUDIT & CONTROL DASHBOARD DATA (نظام الرقابة المالية)
// -------------------------------------------------------------

/**
 * Returns audit trail logs and exceptions for the Admin Financial Control Panel.
 * Admin-only security check.
 */
export async function getFinancialAuditDashboardData(): Promise<{
  authorized: boolean;
  recentLogs: Array<{
    id: string;
    action: string;
    orderId?: string | null;
    userName?: string | null;
    userRole?: string | null;
    details?: any;
    reason?: string | null;
    createdAt: string;
  }>;
  exceptions: {
    cancellationsCount: number;
    cancellationsValue: number;
    discountsCount: number;
    discountsValue: number;
    shiftsWithShortageCount: number;
    shiftsShortageTotal: number;
  };
}> {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;

  if (!session || !session.user || userRole !== "ADMIN") {
    return {
      authorized: false,
      recentLogs: [],
      exceptions: {
        cancellationsCount: 0,
        cancellationsValue: 0,
        discountsCount: 0,
        discountsValue: 0,
        shiftsWithShortageCount: 0,
        shiftsShortageTotal: 0,
      },
    };
  }

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [rawLogs, todayCancelledOrders, todayDiscountedOrders, todayShifts] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT id, action, order_id, user_name, user_role, details, reason, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 40`
      ).catch(() => []),
      prisma.order.findMany({
        where: { workflowStatus: "CANCELLED", createdAt: { gte: startOfToday } },
        select: { totalAmount: true },
      }),
      prisma.order.findMany({
        where: { discount: { gt: 0 }, createdAt: { gte: startOfToday } },
        select: { discount: true },
      }),
      prisma.shift.findMany({
        where: { startTime: { gte: startOfToday } },
        select: { shortageOverage: true },
      }),
    ]);

    const cancellationsValue = todayCancelledOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const discountsValue = todayDiscountedOrders.reduce((sum, o) => sum + (o.discount || 0), 0);

    const shiftsWithShortage = todayShifts.filter((s) => (s.shortageOverage || 0) < 0);
    const shiftsShortageTotal = shiftsWithShortage.reduce((sum, s) => sum + Math.abs(s.shortageOverage || 0), 0);

    const formattedLogs = rawLogs.map((l) => ({
      id: l.id,
      action: l.action,
      orderId: l.order_id,
      userName: l.user_name || "النظام",
      userRole: l.user_role || "CASHIER",
      details: l.details,
      reason: l.reason,
      createdAt: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
    }));

    return {
      authorized: true,
      recentLogs: formattedLogs,
      exceptions: {
        cancellationsCount: todayCancelledOrders.length,
        cancellationsValue,
        discountsCount: todayDiscountedOrders.length,
        discountsValue,
        shiftsWithShortageCount: shiftsWithShortage.length,
        shiftsShortageTotal,
      },
    };
  } catch (error) {
    console.error("Financial audit data lookup error:", error);
    return {
      authorized: true,
      recentLogs: [],
      exceptions: {
        cancellationsCount: 0,
        cancellationsValue: 0,
        discountsCount: 0,
        discountsValue: 0,
        shiftsWithShortageCount: 0,
        shiftsShortageTotal: 0,
      },
    };
  }
}

// -------------------------------------------------------------
// 4. MAIN AMO BASIONY CONVERSATIONAL DISPATCHER
// -------------------------------------------------------------

function extractAmount(text: string): number | null {
  const westernText = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
  const patterns = [
    /(?:بـ|بـ\s+|بقيمة\s+|بمبلغ\s+|صرفت\s+|سجل\s+|ادفع\s+)(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\.م|egp|ألف)?\b/i,
    /\b(\d+(?:\.\d+)?)\b/,
  ];

  for (const regex of patterns) {
    const match = westernText.match(regex);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function extractPaymentMethod(text: string): "CASH" | "VISA" | "TRANSFER" {
  const t = text.toLowerCase();
  if (t.includes("فيزا") || t.includes("كارت") || t.includes("بطاقة") || t.includes("visa")) return "VISA";
  if (t.includes("تحويل") || t.includes("فودافون") || t.includes("انستاباي") || t.includes("بنك")) return "TRANSFER";
  return "CASH";
}

export async function askAmoBasiony(userQuery: string): Promise<AssistantResponse> {
  const query = (userQuery || "").trim().toLowerCase();

  // Verify session before processing
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return {
      answer: "يا مرحب بيك في مشويات بسيوني! يرجى تسجيل الدخول أولاً في النظام عشان أقدر أعرضلك تفاصيل الوردية والمبيعات والمخزون الحية.",
      category: "general",
      quickSuggestions: ["تسجيل الدخول للنظام"],
    };
  }

  const userRole = (session.user as any)?.role || "CASHIER";

  // -------------------------------------------------------------
  // A. DIRECT ORDER SEARCH DETECTION
  // E.g. "#123", "طلب رقم 45", "فاتورة 45", "01012345678", "ابحث عن 12"
  // -------------------------------------------------------------
  const isOrderSearch =
    query.startsWith("#") ||
    query.includes("أوردر") ||
    query.includes("اوردر") ||
    query.includes("فاتورة") ||
    query.includes("طلب رقم") ||
    query.startsWith("بحث عن") ||
    query.startsWith("ابحث عن") ||
    /^(?:01)[0125]\d{8}$/.test(query.replace(/\s+/g, ""));

  if (isOrderSearch) {
    const searchRes = await searchOrdersForCashier({ query: userQuery });
    if (searchRes.success && searchRes.orders.length > 0) {
      const topOrder = searchRes.orders[0];
      const itemsText = topOrder.items.map((it) => `• ${it.nameAr} (${it.quantity} × ${it.unitPrice} ج.م)`).join("\n");

      return {
        answer: `لقيتلك **${searchRes.orders.length} طلب** مطابق للبحث:
        
📋 **أحدث طلب: #${topOrder.orderNumber}**
• **النوع:** ${topOrder.orderTypeAr} (${topOrder.tableName || "بدون طاولة"})
• **العميل:** ${topOrder.customerName || "عميل عام"} ${topOrder.customerPhone ? `(${topOrder.customerPhone})` : ""}
• **التاريخ:** ${topOrder.createdAtFormatted}
• **حالة الطلب:** ${topOrder.workflowStatusAr}
• **حالة الدفع:** ${topOrder.paymentStatusAr}
• **إجمالي الحساب:** **${topOrder.totalAmount} ج.م**

**الأصناف:**
${itemsText}`,
        category: "orders_search",
        matchingOrders: searchRes.orders,
        quickSuggestions: [
          `تفاصيل الأوردر #${topOrder.orderNumber}`,
          "بحث برقم تليفون عميل آخر",
          "مبيعات وردية النهاردة",
        ],
      };
    } else {
      return {
        answer: `بحثتلك في الدفاتر وسجلات الأوردرات ومقتش طلب مطابق لـ «${userQuery}».
اتأكد من رقم الأوردر أو رقم تليفون العميل وجرب تاني!`,
        category: "orders_search",
        matchingOrders: [],
        quickSuggestions: [
          "بحث برقم تليفون العميل",
          "مبيعات اليوم والدرج",
          "مصروفات النهاردة",
        ],
      };
    }
  }

  // -------------------------------------------------------------
  // B. ADMIN EXCLUSIVE INTENT DETECTION (تقارير الأرباح والمراجعة)
  // -------------------------------------------------------------
  const isAdminQuery =
    query.includes("أرباح") ||
    query.includes("ارباح") ||
    query.includes("خسائر") ||
    query.includes("رقابة") ||
    query.includes("تقرير شامل") ||
    query.includes("ملغي") ||
    query.includes("مرتجعات") ||
    query.includes("خصومات") ||
    query.includes("فروق الخزنة") ||
    query.includes("عجز");

  if (isAdminQuery) {
    if (userRole !== "ADMIN") {
      return {
        answer: "عذرًا يا بطل، تقارير الأرباح والرقابة المالية وسجلات الإلغاءات مخصصة حصريًا لحساب الأدمن (الإدارة العليا) وفقاً لصلاحيات النظام. لو محتاج مساعدة في مبيعات الوردية أو البحث عن أوردر أنا في خدمتك!",
        category: "admin_restricted",
        quickSuggestions: [
          "ابحث عن أوردر",
          "مبيعات وردية النهاردة والدرج",
          "سجل 350 جنيه منظفات نقدي",
        ],
      };
    } else {
      const adminReport = await askAdminAssistant({ query: userQuery, period: "TODAY" });
      return {
        answer: adminReport.textAnswer || "تم استخراج تقرير الإدارة المالية بنجاح.",
        category: "admin_report",
        quickSuggestions: [
          "تقرير مبيعات هذا الأسبوع",
          "تقرير الفواتير الملغاة",
          "تقرير حركة الخزنة والورديات",
          "تقرير الأصناف الأكثر مبيعاً",
        ],
      };
    }
  }

  // -------------------------------------------------------------
  // C. SNAPSHOT GATHERING FOR GENERAL & EXPENSE QUERIES
  // -------------------------------------------------------------
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
        where: { createdAt: { gte: startOfToday, lte: endOfToday } },
        include: { items: { include: { menuItem: true } } },
      }),
      prisma.shift.findFirst({
        where: { status: "OPEN" },
        include: { user: { select: { name: true } } },
        orderBy: { startTime: "desc" },
      }),
      prisma.rawMaterial.findMany({
        select: { name: true, currentStock: true, minStockLevel: true, unit: true },
        take: 30,
      }).then((items) => items.filter((i) => i.currentStock <= (i.minStockLevel || 5)).slice(0, 5)).catch(() => []),
      getExpensesSummary("TODAY"),
    ]);

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
        const name = item.menuItem?.nameAr || "صنف";
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

  const categories = await getExpenseCategories();

  // -------------------------------------------------------------
  // D. CONVERSATIONAL EXPENSE RECORDING COMMANDS
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
  // E. SALES & CASH IN DRAWER
  // -------------------------------------------------------------
  const isSalesQuery = query.includes("مبيع") || query.includes("فلوس") || query.includes("إيراد") || query.includes("درج") || query.includes("خزنة");
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
        "ابحث عن أوردر",
      ],
    };
  }

  // Default Greeting
  return {
    answer: `أنا **عمو بسيوني**، المساعد الذكي لمشويات بسيوني! 🥩🔥
معاك لحظة بلحظة:
• **البحث عن أي أوردر** (برقم الأوردر، الفاتورة، أو تليفون العميل).
• **تسجيل المصروفات بالعامية** (مثلاً: «سجل 350 جنيه منظفات نقدي»).
• **حسابات الخزنة والدرج والورديات**.
${userRole === "ADMIN" ? "• **التقارير الإدارية والرقابة المالية الشاملة** (متاحة لحساب الأدمن)." : ""}

اكتبلي أي استفسار أو استخدم أزرار البحث بالأعلى!`,
    category: "general",
    statsSnapshot: snapshot,
    quickSuggestions: [
      "🔍 ابحث عن أوردر",
      "💸 سجل 350 جنيه منظفات نقدي",
      "📊 مبيعات اليوم والدرج",
      "🥩 الأصناف الأكثر مبيعاً اليوم",
    ],
  };
}

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
