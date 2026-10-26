"use server";
import { getSystemLockState } from "@/lib/system-lock";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderStatus, ShiftStatus, TableType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit-logger";

const MAX_SHIFT_HOURS = 12;

/**
 * 1. Get currently active OPEN shift
 * Returns the restaurant's active open shift (single active shift model).
 * Includes detailed cash orders, cash expenses breakdown, and user status.
 */
export async function getActiveShift(userId?: string) {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: {
        status: ShiftStatus.OPEN,
      },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } },
        orders: {
          include: {
            table: true,
          },
        },
      },
      orderBy: { startTime: "desc" },
    });

    if (!activeShift) {
      return { activeShift: null };
    }

    const now = new Date();
    const elapsedMs = now.getTime() - new Date(activeShift.startTime).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const hasExceeded12Hours = elapsedHours >= MAX_SHIFT_HOURS;
    const remainingHours = Math.max(0, MAX_SHIFT_HOURS - elapsedHours);

    // Compute live expected cash
    const shiftOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        createdAt: { gte: activeShift.startTime },
      },
      include: {
        table: true,
      },
    });

    // CRITICAL: Exclude Owner and Manager complimentary orders from ExpectedCash
    const regularPaidOrders = shiftOrders.filter(
      (o) =>
        !o.isComplimentary &&
        o.table?.type !== TableType.OWNER &&
        o.table?.type !== TableType.MANAGER
    );

    const complimentaryOrders = shiftOrders.filter(
      (o) =>
        o.isComplimentary ||
        o.table?.type === TableType.OWNER ||
        o.table?.type === TableType.MANAGER
    );

    const paidOrdersTotal = regularPaidOrders.reduce(
      (sum, o) => sum + o.totalAmount,
      0
    );
    const complimentaryWaivedTotal = complimentaryOrders.reduce(
      (sum, o) => sum + o.subtotal,
      0
    );

    // Parse shift expenses
    let expensesList: any[] = [];
    if (Array.isArray(activeShift.expensesDetails)) {
      expensesList = activeShift.expensesDetails;
    } else if (typeof activeShift.expensesDetails === "string") {
      try {
        expensesList = JSON.parse(activeShift.expensesDetails);
      } catch {}
    }

    // Cash expenses deducted from drawer
    const cashExpenses = expensesList.filter((e) => !e.paymentMethod || e.paymentMethod === "CASH");
    const nonCashExpenses = expensesList.filter((e) => e.paymentMethod && e.paymentMethod !== "CASH");
    const cashExpensesTotal = cashExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const nonCashExpensesTotal = nonCashExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Fetch actual Rider Remittances received into this shift's drawer
    const shiftRemittances = await prisma.riderRemittance.findMany({
      where: { shiftId: activeShift.id },
      orderBy: { createdAt: "desc" },
    });
    const riderRemittancesTotal = shiftRemittances.reduce((sum, r) => sum + r.amountReceived, 0);

    // Fetch pending cash debt still held by delivery riders (unremitted operational debt)
    const pendingDeliveryOrders = await prisma.order.findMany({
      where: {
        orderType: "DELIVERY",
        workflowStatus: { not: "CANCELLED" },
        remittanceStatus: { in: ["PENDING", "PARTIAL"] },
        riderCashDue: { gt: 0 },
      },
      select: {
        riderName: true,
        deliveredBy: true,
        riderCashDue: true,
        riderCashRemitted: true,
      },
    });
    const riderPendingDebtTotal = pendingDeliveryOrders.reduce((sum, o) => {
      const due = o.riderCashDue || 0;
      const remitted = o.riderCashRemitted || 0;
      return sum + Math.max(0, due - remitted);
    }, 0);

    // Build per-rider debt breakdown for shift view
    const riderDebtsMap: Record<string, number> = {};
    for (const p of pendingDeliveryOrders) {
      const name = (p.riderName || p.deliveredBy || "طيار غير محدد").trim();
      const debt = Math.max(0, (p.riderCashDue || 0) - (p.riderCashRemitted || 0));
      riderDebtsMap[name] = (riderDebtsMap[name] || 0) + debt;
    }
    const riderDebtsBreakdown = Object.entries(riderDebtsMap).map(([name, amount]) => ({
      riderName: name,
      pendingDebt: amount,
    }));

    // Counter paid sales (non-delivery)
    const counterPaidOrders = regularPaidOrders.filter((o) => o.orderType !== "DELIVERY");
    const counterPaidSalesTotal = counterPaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Expected Drawer Cash = Initial Float + Counter Cash Sales + Physical Rider Remittances - Cash Expenses
    const liveExpectedCash = Math.max(
      0,
      activeShift.initialCash + counterPaidSalesTotal + riderRemittancesTotal - cashExpensesTotal
    );

    return {
      activeShift: {
        ...activeShift,
        elapsedHours,
        hasExceeded12Hours,
        remainingHours,
        liveExpectedCash,
        paidOrdersTotal,
        counterPaidSalesTotal,
        riderRemittancesTotal,
        riderPendingDebtTotal,
        riderDebtsBreakdown,
        shiftRemittances,
        paidOrdersCount: regularPaidOrders.length,
        complimentaryOrdersCount: complimentaryOrders.length,
        complimentaryWaivedTotal,
        expensesList,
        cashExpensesTotal,
        nonCashExpensesTotal,
        isOpenedByCurrentUser: userId ? activeShift.userId === userId : false,
      },
    };
  } catch (error: any) {
    console.error("Error fetching active shift:", error);
    return { activeShift: null, error: error.message };
  }
}

/**
 * 2. Start a new shift
 * Takes initial drawer cash float.
 */
export async function startShift({
  userId,
  initialCash = 0,
  notes,
}: {
  userId: string;
  initialCash: number;
  notes?: string;
}) {
  try {
    const lockState = await getSystemLockState();
    if (lockState.isLocked) return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };

    // Check if user or system already has an open shift
    const existing = await prisma.shift.findFirst({
      where: { status: ShiftStatus.OPEN },
      include: { user: { select: { name: true, role: true } } },
    });

    if (existing) {
      return {
        error: `يوجد وردية نشطة بالفعل (رقم #${existing.shiftNumber}) تم فتحها بواسطة (${existing.user?.name || "الموظف"}) في ${new Date(existing.startTime).toLocaleTimeString("ar-EG")}. يرجى من الإدارة تقفيلها أولاً قبل فتح وردية جديدة.`,
      };
    }

    const shift = await prisma.shift.create({
      data: {
        userId,
        initialCash: Math.max(0, initialCash),
        expectedCash: Math.max(0, initialCash),
        status: ShiftStatus.OPEN,
        notes,
      },
      include: {
        user: true,
      },
    });

    await recordAuditLog({
      action: "SHIFT_STARTED",
      userId: shift.userId,
      userName: shift.user?.name || "كاشير",
      userRole: shift.user?.role || "CASHIER",
      details: {
        shiftId: shift.id,
        shiftNumber: shift.shiftNumber,
        initialCash,
      },
      reason: `فتح وردية جديدة بعهدة افتتاحية ${initialCash.toFixed(2)} ج.م`,
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/reports");

    return {
      success: true,
      shift,
      message: `تم فتح وردية جديدة رقم #${shift.shiftNumber} بعهدة افتتاحية ${initialCash.toFixed(2)} ج.م`,
    };
  } catch (error: any) {
    console.error("Error starting shift:", error);
    return { error: error.message || "فشل فتح الوردية" };
  }
}

export interface ClosingItem {
  id?: string;
  item?: string;
  amount: number;
  notes?: string;
  receiver?: string;
  responsible?: string;
}

export interface EndShiftPayload {
  shiftId: string;
  actualCash: number;
  notes?: string;
  grossSales?: number;
  discounts?: number;
  visaAmount?: number;
  otherBalance?: number;
  expensesTotal?: number;
  expensesDetails?: ClosingItem[];
  managementChecks?: number;
  staffWasteTotal?: number;
  staffWasteDetails?: ClosingItem[];
  managementWithdrawalsTotal?: number;
  managementWithdrawalsDetails?: ClosingItem[];
  endOfDayBalance?: number;
  receivedBy?: string;
}

/**
 * 3. End shift (تقفيل وتسليم الوردية - ورقة تقفيل مشويات بسيوني الرسمية)
 * CRITICAL REQUIREMENTS:
 * - Cashier inputs counted actual cash.
 * - Complete 9-item closing reconciliation (المبيعات، الخصومات، فيزا، رصيد أخر، مصاريف مفصلة، شيكات، توالف سطاف مفصلة، مسحوبات إدارة مفصلة، رصيد أخر اليوم، المستلم).
 * - Excludes complimentary orders.
 * - Compares Actual vs Expected cash and logs shortage/overage.
 */
export async function endShift(payload: EndShiftPayload) {
  try {
    const lockState = await getSystemLockState();
    if (lockState.isLocked) return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };

    // RBAC: Only Admin or Manager can close and finalize shifts
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role || "CASHIER";
    const managerName = session?.user?.name || "المدير";
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return {
        error: "غير مصرح للكاشير بإغلاق الوردية نهائياً. تقفيل واعتماد الوردية مقتصر على صلاحية المدير أو الأدمن فقط.",
      };
    }

    const {
      shiftId,
      actualCash,
      notes,
      grossSales: customGrossSales,
      discounts: customDiscounts,
      visaAmount = 0,
      otherBalance = 0,
      expensesTotal: customExpensesTotal,
      expensesDetails = [],
      managementChecks = 0,
      staffWasteTotal: customStaffWasteTotal,
      staffWasteDetails = [],
      managementWithdrawalsTotal: customWithdrawalsTotal,
      managementWithdrawalsDetails = [],
      receivedBy,
    } = payload;

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        user: true,
        orders: {
          include: { table: true },
        },
      },
    });

    if (!shift || shift.status !== ShiftStatus.OPEN) {
      return { error: "الوردية غير موجودة أو تم إغلاقها مسبقاً بالفعل" };
    }

    const endTime = new Date();

    // Fetch all PAID orders during the shift timeframe
    const paidOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        createdAt: {
          gte: shift.startTime,
          lte: endTime,
        },
      },
      include: {
        table: true,
      },
    });

    // CRITICAL REQUIREMENT: Strictly exclude Complimentary (Owner/Manager tables) from ExpectedCash
    const regularPaidOrders = paidOrders.filter(
      (o) =>
        !o.isComplimentary &&
        o.table?.type !== TableType.OWNER &&
        o.table?.type !== TableType.MANAGER
    );

    const complimentaryOrders = paidOrders.filter(
      (o) =>
        o.isComplimentary ||
        o.table?.type === TableType.OWNER ||
        o.table?.type === TableType.MANAGER
    );

    const computedGrossSales = regularPaidOrders.reduce(
      (sum, o) => sum + (o.subtotal || o.totalAmount),
      0
    );
    const computedDiscounts = regularPaidOrders.reduce(
      (sum, o) => sum + (o.discount || 0),
      0
    );
    const regularSalesNet = regularPaidOrders.reduce(
      (sum, o) => sum + o.totalAmount,
      0
    );

    const finalGrossSales =
      typeof customGrossSales === "number" && !isNaN(customGrossSales)
        ? customGrossSales
        : computedGrossSales;

    const finalDiscounts =
      typeof customDiscounts === "number" && !isNaN(customDiscounts)
        ? customDiscounts
        : computedDiscounts;

    // Calculate itemized totals if not explicitly given
    const finalExpensesTotal =
      typeof customExpensesTotal === "number" && !isNaN(customExpensesTotal)
        ? customExpensesTotal
        : expensesDetails.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const finalWithdrawalsTotal =
      typeof customWithdrawalsTotal === "number" && !isNaN(customWithdrawalsTotal)
        ? customWithdrawalsTotal
        : managementWithdrawalsDetails.reduce(
            (sum, w) => sum + (Number(w.amount) || 0),
            0
          );

    const finalStaffWasteTotal =
      typeof customStaffWasteTotal === "number" && !isNaN(customStaffWasteTotal)
        ? customStaffWasteTotal
        : staffWasteDetails.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    // Bedouin Grill Closing Formula (رصيد أخر اليوم المتوقع بالدرج):
    // الصافي المتوقع = العهدة الافتتاحية + إجمالي المبيعات - الخصومات - فيزا - رصيد أخر - المصاريف - شيكات إدارة - مسحوبات إدارة
    const expectedCash =
      shift.initialCash +
      finalGrossSales -
      finalDiscounts -
      visaAmount -
      otherBalance -
      finalExpensesTotal -
      managementChecks -
      finalWithdrawalsTotal;

    const shortageOverage = actualCash - expectedCash;
    const endOfDayBalance = expectedCash;

    // Calculate actual rider remittances in this shift
    const shiftRemittances = await prisma.riderRemittance.findMany({
      where: { shiftId },
    });
    const finalRiderRemittancesTotal = shiftRemittances.reduce((sum, r) => sum + r.amountReceived, 0);

    // Calculate pending operational cash debt still held by delivery riders
    const pendingDeliveryOrders = await prisma.order.findMany({
      where: {
        orderType: "DELIVERY",
        workflowStatus: { not: "CANCELLED" },
        remittanceStatus: { in: ["PENDING", "PARTIAL"] },
        riderCashDue: { gt: 0 },
      },
    });
    const finalRiderPendingDebtTotal = pendingDeliveryOrders.reduce((sum, o) => {
      const due = o.riderCashDue || 0;
      const remitted = o.riderCashRemitted || 0;
      return sum + Math.max(0, due - remitted);
    }, 0);

    // Link unlinked shift orders
    await prisma.order.updateMany({
      where: {
        id: { in: paidOrders.map((o) => o.id) },
        shiftId: null,
      },
      data: {
        shiftId: shift.id,
      },
    });

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        endTime,
        actualCash,
        expectedCash,
        shortageOverage,
        status: ShiftStatus.CLOSED,
        notes: notes || shift.notes,
        grossSales: finalGrossSales,
        discounts: finalDiscounts,
        visaAmount,
        otherBalance,
        expensesTotal: finalExpensesTotal,
        expensesDetails: expensesDetails as any,
        managementChecks,
        staffWasteTotal: finalStaffWasteTotal,
        staffWasteDetails: staffWasteDetails as any,
        managementWithdrawalsTotal: finalWithdrawalsTotal,
        managementWithdrawalsDetails: managementWithdrawalsDetails as any,
        endOfDayBalance,
        receivedBy: receivedBy || null,
        riderRemittancesTotal: finalRiderRemittancesTotal,
        riderPendingDebtTotal: finalRiderPendingDebtTotal,
      },
      include: {
        user: true,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/reports");

    await recordAuditLog({
      action: "SHIFT_ENDED",
      userId: updatedShift.userId,
      userName: updatedShift.user?.name || "كاشير",
      userRole: updatedShift.user?.role || "CASHIER",
      details: {
        shiftId: updatedShift.id,
        shiftNumber: updatedShift.shiftNumber,
        initialCash: shift.initialCash,
        grossSales: finalGrossSales,
        actualCash,
        expectedCash,
        shortageOverage,
        receivedBy: receivedBy || null,
      },
      reason: `تقفيل الوردية رقم #${updatedShift.shiftNumber} (عجز/زيادة: ${shortageOverage.toFixed(2)} ج.م)`,
    });

    return {
      success: true,
      shift: updatedShift,
      stats: {
        initialCash: shift.initialCash,
        grossSales: finalGrossSales,
        discounts: finalDiscounts,
        netSales: finalGrossSales - finalDiscounts,
        salesTotal: regularSalesNet,
        visaAmount,
        otherBalance,
        expensesTotal: finalExpensesTotal,
        expensesDetails,
        managementChecks,
        staffWasteTotal: finalStaffWasteTotal,
        staffWasteDetails,
        managementWithdrawalsTotal: finalWithdrawalsTotal,
        managementWithdrawalsDetails,
        endOfDayBalance,
        expectedCash,
        actualCash,
        shortageOverage,
        receivedBy: receivedBy || "—",
        paidOrdersCount: regularPaidOrders.length,
        complimentaryOrdersCount: complimentaryOrders.length,
        complimentaryWaivedTotal: complimentaryOrders.reduce(
          (sum, o) => sum + o.subtotal,
          0
        ),
      },
      message: `تم تقفيل الوردية وحفظ ورقة التقفيل الرسمية (#${shift.shiftNumber}) بنجاح. ${
        shortageOverage === 0
          ? "الدرج مطابق تماماً بدون عجز أو زيادة ✓"
          : shortageOverage < 0
          ? `يوجد عجز نقدي بقيمة ${Math.abs(shortageOverage).toFixed(2)} ج.م`
          : `يوجد زيادة نقدية بقيمة ${shortageOverage.toFixed(2)} ج.م`
      }`,
    };
  } catch (error: any) {
    console.error("Error ending shift:", error);
    return { error: error.message || "فشل تقفيل الوردية" };
  }
}

/**
 * 4. Get shifts summary for Admin Reports
 */
export async function getShiftsReport() {
  try {
    const shifts = await prisma.shift.findMany({
      orderBy: { startTime: "desc" },
      include: {
        user: { select: { name: true, username: true, role: true } },
        orders: {
          include: {
            table: true,
            items: { include: { menuItem: true } },
          },
        },
      },
    });

    return { shifts };
  } catch (error: any) {
    console.error("Error fetching shifts report:", error);
    return { shifts: [] };
  }
}
