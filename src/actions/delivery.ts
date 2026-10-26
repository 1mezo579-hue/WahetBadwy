"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus, TableType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit-logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ---------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------

export interface DeliveryOrderFilter {
  query?: string;
  orderNumber?: number;
  phone?: string;
  customerName?: string;
  status?: string; // "ALL" | "NEW" | "IN_KITCHEN" | "READY" | "READY_FOR_RIDER" | "WITH_RIDER" | "DELIVERED" | "CANCELLED"
  riderName?: string;
  remittanceStatus?: string; // "ALL" | "PENDING" | "PARTIAL" | "REMITTED" | "NOT_APPLICABLE"
  paymentMethod?: string; // "ALL" | "CASH" | "CARD" | "WALLET" | "MIXED"
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  page?: number;
}

export interface RiderLedgerItem {
  riderName: string;
  riderPhone?: string | null;
  totalOrdersCount: number;
  activeOrdersCount: number;
  deliveredOrdersCount: number;
  totalCashDue: number;
  totalCashRemitted: number;
  pendingCashDebt: number; // Operational liability still with rider
  unsettledOrdersCount: number;
  unsettledOrders: {
    orderId: string;
    orderNumber: number;
    customerName?: string | null;
    customerPhone?: string | null;
    deliveryAddress?: string | null;
    totalAmount: number;
    cashDue: number;
    cashRemitted: number;
    pendingAmount: number;
    assignedAt: string;
    deliveryStatus: string;
  }[];
  lastRemittanceDate?: string | null;
  lastRemittanceAmount?: number | null;
}

// ---------------------------------------------------------------------
// 1. Get Delivery Orders List with Full Filters & Timeline
// ---------------------------------------------------------------------

export async function getDeliveryOrders(filter: DeliveryOrderFilter = {}) {
  try {
    const {
      query,
      orderNumber,
      phone,
      customerName,
      status,
      riderName,
      remittanceStatus,
      paymentMethod,
      dateFrom,
      dateTo,
      limit = 50,
      page = 1,
    } = filter;

    const where: any = {
      orderType: "DELIVERY",
    };

    // Filter by order number
    if (orderNumber) {
      where.orderNumber = orderNumber;
    }

    // Filter by customer phone
    if (phone && phone.trim()) {
      const cleanPhone = phone.trim().replace(/\D/g, "");
      where.OR = [
        { customerPhone: { contains: phone.trim() } },
        ...(cleanPhone ? [{ customerPhone: { contains: cleanPhone } }] : []),
      ];
    }

    // Filter by customer name
    if (customerName && customerName.trim()) {
      where.customerName = { contains: customerName.trim(), mode: "insensitive" };
    }

    // Free query search across order number, customer name, phone, address, rider
    if (query && query.trim()) {
      const q = query.trim();
      const num = parseInt(q.replace(/\D/g, ""), 10);
      where.OR = [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q } },
        { deliveryAddress: { contains: q, mode: "insensitive" } },
        { riderName: { contains: q, mode: "insensitive" } },
        { deliveredBy: { contains: q, mode: "insensitive" } },
        ...(num && !isNaN(num) ? [{ orderNumber: num }] : []),
      ];
    }

    // Filter by workflow/delivery status
    if (status && status !== "ALL") {
      if (status === "CANCELLED") {
        where.workflowStatus = "CANCELLED";
      } else {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { deliveryStatus: status },
              { workflowStatus: status },
            ],
          },
        ];
      }
    }

    // Filter by rider name
    if (riderName && riderName !== "ALL") {
      where.OR = [
        { riderName: riderName },
        { deliveredBy: riderName },
      ];
    }

    // Filter by remittance status
    if (remittanceStatus && remittanceStatus !== "ALL") {
      where.remittanceStatus = remittanceStatus;
    }

    // Filter by payment method
    if (paymentMethod && paymentMethod !== "ALL") {
      where.paymentMethod = paymentMethod;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    const totalOrders = await prisma.order.count({ where });

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        user: { select: { name: true, username: true } },
      },
    });

    const formattedOrders = orders.map((o) => {
      const isPaid = o.status === OrderStatus.PAID;
      const isCancelled = o.workflowStatus === "CANCELLED";
      const totalAmount = o.totalAmount || 0;
      const riderCashDue = o.riderCashDue ?? (o.paymentMethod === "CARD" || o.paymentMethod === "WALLET" ? 0 : totalAmount);
      const riderCashRemitted = o.riderCashRemitted || 0;
      const pendingRiderDebt = Math.max(0, riderCashDue - riderCashRemitted);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderType: o.orderType,
        customerName: o.customerName || "عميل بدون اسم",
        customerPhone: o.customerPhone || "—",
        deliveryAddress: o.deliveryAddress || "بدون عنوان",
        deliveryFee: o.deliveryFee || 0,
        subtotal: o.subtotal || 0,
        discount: o.discount || 0,
        totalAmount,
        paymentMethod: o.paymentMethod || "CASH",
        cashPortion: o.cashPortion || 0,
        electronicPortion: o.electronicPortion || 0,
        paymentStatus: isCancelled ? "CANCELLED" : isPaid ? "PAID" : "UNPAID",
        workflowStatus: o.workflowStatus || "NEW",
        deliveryStatus: o.deliveryStatus || o.workflowStatus || "NEW",
        riderName: o.riderName || o.deliveredBy || null,
        riderCashDue,
        riderCashRemitted,
        pendingRiderDebt,
        remittanceStatus: o.remittanceStatus || (riderCashDue === 0 ? "NOT_APPLICABLE" : pendingRiderDebt === 0 ? "REMITTED" : "PENDING"),
        riderRemittedAt: o.riderRemittedAt ? o.riderRemittedAt.toISOString() : null,
        expectedPickupTime: o.expectedPickupTime || null,
        notes: o.notes || null,
        reprintCount: o.reprintCount || 0,
        statusHistory: Array.isArray(o.statusHistory) ? o.statusHistory : [],
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((it) => ({
          id: it.id,
          nameAr: it.menuItem?.nameAr || "صنف",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          notes: it.notes,
        })),
      };
    });

    return {
      success: true,
      orders: formattedOrders,
      totalOrders,
      page,
      totalPages: Math.ceil(totalOrders / limit) || 1,
    };
  } catch (error: any) {
    console.error("Error in getDeliveryOrders:", error);
    return {
      success: false,
      error: error.message || "فشل جلب طلبات الدليفري",
      orders: [],
      totalOrders: 0,
      page: 1,
      totalPages: 1,
    };
  }
}

// ---------------------------------------------------------------------
// 2. Assign Rider to Delivery Order
// ---------------------------------------------------------------------

export async function assignRiderToOrder({
  orderId,
  riderName,
  notes,
  cashierName = "الكاشير",
}: {
  orderId: string;
  riderName: string;
  notes?: string;
  cashierName?: string;
}) {
  try {
    if (!orderId || !riderName || !riderName.trim()) {
      return { success: false, error: "يرجى تحديد الطلب واختيار اسم الطيار المسؤول." };
    }

    const cleanRiderName = riderName.trim();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return { success: false, error: "طلب الدليفري غير موجود." };
    }

    if (order.workflowStatus === "CANCELLED") {
      return { success: false, error: "لا يمكن إسناد طيار لطلب ملغي." };
    }

    const nowIso = new Date().toISOString();
    const isDigital = order.paymentMethod === "CARD" || order.paymentMethod === "WALLET";
    const total = order.totalAmount || 0;

    // Financial rule: Digital orders create 0 cash liability on the rider.
    // Mixed orders create cash liability only for the cash portion.
    let riderCashDue = total;
    let remittanceStatus = "PENDING";

    if (isDigital) {
      riderCashDue = 0;
      remittanceStatus = "NOT_APPLICABLE";
    } else if (order.paymentMethod === "MIXED" && (order.cashPortion ?? 0) > 0) {
      riderCashDue = order.cashPortion || 0;
      remittanceStatus = "PENDING";
    }

    const updatedHistory = [
      ...(Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : []),
      {
        action: "RIDER_ASSIGNED",
        riderName: cleanRiderName,
        cashier: cashierName,
        riderCashDue,
        isDigital,
        timestamp: nowIso,
        notes: notes || null,
      },
    ];

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        riderName: cleanRiderName,
        deliveredBy: cleanRiderName,
        deliveryStatus: "WITH_RIDER",
        workflowStatus: "WITH_RIDER",
        riderCashDue,
        remittanceStatus,
        statusHistory: updatedHistory,
      },
    });

    await recordAuditLog({
      action: "RIDER_ASSIGNED",
      orderId: order.id,
      userName: cashierName,
      userRole: "CASHIER",
      reason: `تسليم أوردر دليفري #${order.orderNumber} للطيار (${cleanRiderName}) - العهدة المستحقة: ${riderCashDue} ج.م`,
      details: {
        orderNumber: order.orderNumber,
        riderName: cleanRiderName,
        riderCashDue,
        paymentMethod: order.paymentMethod,
        cashier: cashierName,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/kitchen");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `تم إسناد الطلب #${order.orderNumber} للطيار (${cleanRiderName}) بنجاح. عهدة التحصيل: ${riderCashDue} ج.م ✓`,
      order: updatedOrder,
    };
  } catch (error: any) {
    console.error("Error in assignRiderToOrder:", error);
    return { success: false, error: error.message || "فشل إسناد الطلب للطيار" };
  }
}

// ---------------------------------------------------------------------
// 3. Update Delivery Workflow Status
// ---------------------------------------------------------------------

export async function updateDeliveryStatus({
  orderId,
  status,
  notes,
  cashierName = "الكاشير",
}: {
  orderId: string;
  status: "NEW" | "IN_KITCHEN" | "READY" | "READY_FOR_RIDER" | "WITH_RIDER" | "DELIVERED" | "CANCELLED" | string;
  notes?: string;
  cashierName?: string;
}) {
  try {
    if (!orderId || !status) {
      return { success: false, error: "معرف الطلب والحالة مطلوبان." };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { success: false, error: "الطلب غير موجود." };
    }

    const nowIso = new Date().toISOString();

    const statusTranslations: Record<string, string> = {
      NEW: "طلب جديد",
      IN_KITCHEN: "قيد التجهيز في المطبخ",
      READY: "جاهز للتسليم / وصل للكاشير",
      READY_FOR_RIDER: "جاهز لاستلام الطيار",
      WITH_RIDER: "تم تسليمه للطيار (مع الطيار)",
      DELIVERED: "تم التسليم للعميل بنجاح",
      CANCELLED: "ملغي",
    };

    const updatedHistory = [
      ...(Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : []),
      {
        action: "STATUS_CHANGED",
        previousStatus: order.deliveryStatus || order.workflowStatus,
        newStatus: status,
        statusAr: statusTranslations[status] || status,
        cashier: cashierName,
        timestamp: nowIso,
        notes: notes || null,
      },
    ];

    // Build update data
    const updateData: any = {
      deliveryStatus: status,
      workflowStatus: status,
      statusHistory: updatedHistory,
    };

    // If order is cancelled, void rider liability
    if (status === "CANCELLED") {
      updateData.riderCashDue = 0;
      updateData.remittanceStatus = "NOT_APPLICABLE";
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    await recordAuditLog({
      action: "DELIVERY_STATUS_UPDATED",
      orderId: order.id,
      userName: cashierName,
      userRole: "CASHIER",
      reason: `تحديث حالة طلب دليفري #${order.orderNumber} إلى (${statusTranslations[status] || status})`,
      details: {
        orderNumber: order.orderNumber,
        newStatus: status,
        notes,
        cashier: cashierName,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/kitchen");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `تم تحديث حالة الطلب #${order.orderNumber} إلى (${statusTranslations[status] || status}) ✓`,
      order: updatedOrder,
    };
  } catch (error: any) {
    console.error("Error in updateDeliveryStatus:", error);
    return { success: false, error: error.message || "فشل تحديث حالة الطلب" };
  }
}

// ---------------------------------------------------------------------
// 4. Record Rider Remittance (تسجيل توريد عهدة من الطيار)
// ---------------------------------------------------------------------

export interface RecordRiderRemittancePayload {
  riderName: string;
  amountReceived: number;
  orderIds?: string[];
  paymentMethod?: "CASH" | "CARD" | "WALLET";
  notes?: string;
  cashierName?: string;
  varianceReason?: string;
  clientToken?: string;
}

export async function recordRiderRemittance(payload: RecordRiderRemittancePayload) {
  try {
    const {
      riderName,
      amountReceived,
      orderIds = [],
      paymentMethod = "CASH",
      notes,
      cashierName = "الكاشير",
      varianceReason,
      clientToken,
    } = payload;

    if (!riderName || !riderName.trim()) {
      return { success: false, error: "اسم الطيار مطلوب لتسجيل التوريد." };
    }

    if (typeof amountReceived !== "number" || isNaN(amountReceived) || amountReceived <= 0) {
      return { success: false, error: "يرجى إدخال مبلغ توريد صحيح أكبر من الصفر." };
    }

    const cleanRiderName = riderName.trim();

    // 1. Get currently OPEN shift - Remittance must be credited to this shift's drawer
    const activeShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
      orderBy: { startTime: "desc" },
    });

    if (!activeShift) {
      return {
        success: false,
        error: "لا توجد وردية مفتوحة حالياً. يجب فتح وردية في الكاشير لتوريد واستلام نقدية الطيار بالدرج.",
      };
    }

    // 2. Fetch pending orders for this rider
    const pendingWhere: any = {
      orderType: "DELIVERY",
      OR: [
        { riderName: cleanRiderName },
        { deliveredBy: cleanRiderName },
      ],
      remittanceStatus: { in: ["PENDING", "PARTIAL"] },
      workflowStatus: { not: "CANCELLED" },
    };

    if (orderIds && orderIds.length > 0) {
      pendingWhere.id = { in: orderIds };
    }

    const pendingOrders = await prisma.order.findMany({
      where: pendingWhere,
      orderBy: { createdAt: "asc" }, // Oldest first
    });

    if (pendingOrders.length === 0) {
      return {
        success: false,
        error: `لا توجد طلبات معلقة بانتظار التوريد للطيار (${cleanRiderName}).`,
      };
    }

    // Calculate total expected cash across target orders
    const totalExpected = pendingOrders.reduce((sum, o) => {
      const due = o.riderCashDue ?? o.totalAmount;
      const remitted = o.riderCashRemitted ?? 0;
      return sum + Math.max(0, due - remitted);
    }, 0);

    const variance = amountReceived - totalExpected;
    const now = new Date();
    const nowIso = now.toISOString();

    // 3. Atomically allocate received cash across orders and record remittance
    const result = await prisma.$transaction(async (tx) => {
      let remainingMoneyToAllocate = amountReceived;
      const updatedOrderIds: string[] = [];

      for (const order of pendingOrders) {
        if (remainingMoneyToAllocate <= 0) break;

        const due = order.riderCashDue ?? order.totalAmount;
        const previouslyRemitted = order.riderCashRemitted ?? 0;
        const orderPendingAmount = Math.max(0, due - previouslyRemitted);

        if (orderPendingAmount <= 0) continue;

        const allocatedToThisOrder = Math.min(remainingMoneyToAllocate, orderPendingAmount);
        const newRemittedTotal = previouslyRemitted + allocatedToThisOrder;
        remainingMoneyToAllocate -= allocatedToThisOrder;

        const isFullySettled = newRemittedTotal >= due;
        const newRemittanceStatus = isFullySettled ? "REMITTED" : "PARTIAL";

        const orderHistory = [
          ...(Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : []),
          {
            action: "RIDER_REMITTANCE_COLLECTED",
            riderName: cleanRiderName,
            amountRemitted: allocatedToThisOrder,
            totalRemittedForOrder: newRemittedTotal,
            totalDue: due,
            remittanceStatus: newRemittanceStatus,
            cashier: cashierName,
            shiftNumber: activeShift.shiftNumber,
            timestamp: nowIso,
          },
        ];

        await tx.order.update({
          where: { id: order.id },
          data: {
            riderCashRemitted: newRemittedTotal,
            remittanceStatus: newRemittanceStatus,
            riderRemittedAt: now,
            status: isFullySettled ? OrderStatus.PAID : order.status,
            statusHistory: orderHistory,
          },
        });

        updatedOrderIds.push(order.id);
      }

      // Create immutable RiderRemittance record
      const remittance = await tx.riderRemittance.create({
        data: {
          riderName: cleanRiderName,
          shiftId: activeShift.id,
          cashierName,
          amountExpected: totalExpected,
          amountReceived,
          variance,
          varianceReason: variance !== 0 ? (varianceReason || `فرق توريد عهدة ${variance > 0 ? "فائض" : "عجز"}`) : null,
          orderIds: updatedOrderIds as any,
          paymentMethod,
          notes: notes || null,
        },
      });

      // Update shift remittance total
      await tx.shift.update({
        where: { id: activeShift.id },
        data: {
          riderRemittancesTotal: { increment: amountReceived },
        },
      });

      return { remittance, updatedOrderIds };
    });

    // 4. Audit Log
    await recordAuditLog({
      action: "RIDER_REMITTANCE",
      orderId: result.updatedOrderIds[0] || null,
      userName: cashierName,
      userRole: "CASHIER",
      reason: `توريد عهدة طيار (${cleanRiderName}) بمبلغ ${amountReceived} ج.م لدرج كاشير وردية #${activeShift.shiftNumber}`,
      details: {
        riderName: cleanRiderName,
        amountReceived,
        amountExpected: totalExpected,
        variance,
        varianceReason,
        shiftId: activeShift.id,
        shiftNumber: activeShift.shiftNumber,
        coveredOrdersCount: result.updatedOrderIds.length,
        cashier: cashierName,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/reports");

    return {
      success: true,
      message: `تم تسجيل توريد ${amountReceived.toFixed(2)} ج.م من الطيار (${cleanRiderName}) بنجاح إلى درج الكاشير ✓`,
      remittance: result.remittance,
      coveredOrdersCount: result.updatedOrderIds.length,
      variance,
    };
  } catch (error: any) {
    console.error("Error in recordRiderRemittance:", error);
    return { success: false, error: error.message || "فشل تسجيل توريد العهدة من الطيار" };
  }
}

// ---------------------------------------------------------------------
// 5. Get Rider Ledger Summary (ملخص عهد الطيارين المفتوحة والمتبقية)
// ---------------------------------------------------------------------

export async function getRiderLedgerSummary(): Promise<{
  success: boolean;
  riders: RiderLedgerItem[];
  totals: {
    totalPendingDebt: number;
    totalRemittedToday: number;
    activeRidersCount: number;
    unsettledOrdersCount: number;
  };
  error?: string;
}> {
  try {
    // 1. Fetch all delivery orders with active rider assignments
    const deliveryOrders = await prisma.order.findMany({
      where: {
        orderType: "DELIVERY",
        workflowStatus: { not: "CANCELLED" },
        OR: [
          { riderName: { not: null } },
          { deliveredBy: { not: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Fetch last remittances per rider
    const remittances = await prisma.riderRemittance.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const ridersMap = new Map<string, RiderLedgerItem>();

    for (const o of deliveryOrders) {
      const rider = (o.riderName || o.deliveredBy || "طيار غير محدد").trim();
      if (!rider) continue;

      if (!ridersMap.has(rider)) {
        ridersMap.set(rider, {
          riderName: rider,
          totalOrdersCount: 0,
          activeOrdersCount: 0,
          deliveredOrdersCount: 0,
          totalCashDue: 0,
          totalCashRemitted: 0,
          pendingCashDebt: 0,
          unsettledOrdersCount: 0,
          unsettledOrders: [],
          lastRemittanceDate: null,
          lastRemittanceAmount: null,
        });
      }

      const item = ridersMap.get(rider)!;
      item.totalOrdersCount += 1;

      if (o.deliveryStatus === "WITH_RIDER" || o.workflowStatus === "WITH_RIDER") {
        item.activeOrdersCount += 1;
      }
      if (o.deliveryStatus === "DELIVERED" || o.workflowStatus === "DELIVERED") {
        item.deliveredOrdersCount += 1;
      }

      const totalAmount = o.totalAmount || 0;
      const isDigital = o.paymentMethod === "CARD" || o.paymentMethod === "WALLET";
      const due = o.riderCashDue ?? (isDigital ? 0 : totalAmount);
      const remitted = o.riderCashRemitted ?? 0;
      const pending = Math.max(0, due - remitted);

      item.totalCashDue += due;
      item.totalCashRemitted += remitted;
      item.pendingCashDebt += pending;

      if (pending > 0 && o.remittanceStatus !== "REMITTED" && o.remittanceStatus !== "NOT_APPLICABLE") {
        item.unsettledOrdersCount += 1;
        item.unsettledOrders.push({
          orderId: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          deliveryAddress: o.deliveryAddress,
          totalAmount,
          cashDue: due,
          cashRemitted: remitted,
          pendingAmount: pending,
          assignedAt: o.createdAt.toISOString(),
          deliveryStatus: o.deliveryStatus || o.workflowStatus || "WITH_RIDER",
        });
      }
    }

    // Attach last remittance info
    ridersMap.forEach((item, riderName) => {
      const lastR = remittances.find((r) => r.riderName.trim().toLowerCase() === riderName.toLowerCase());
      if (lastR) {
        item.lastRemittanceDate = lastR.createdAt.toISOString();
        item.lastRemittanceAmount = lastR.amountReceived;
      }
    });

    const ridersList = Array.from(ridersMap.values()).sort(
      (a, b) => b.pendingCashDebt - a.pendingCashDebt
    );

    // Calculate overall totals
    const totalPendingDebt = ridersList.reduce((sum, r) => sum + r.pendingCashDebt, 0);
    const unsettledOrdersCount = ridersList.reduce((sum, r) => sum + r.unsettledOrdersCount, 0);

    // Today's remittances
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRemittances = remittances.filter((r) => new Date(r.createdAt) >= todayStart);
    const totalRemittedToday = todayRemittances.reduce((sum, r) => sum + r.amountReceived, 0);

    return {
      success: true,
      riders: ridersList,
      totals: {
        totalPendingDebt,
        totalRemittedToday,
        activeRidersCount: ridersList.length,
        unsettledOrdersCount,
      },
    };
  } catch (error: any) {
    console.error("Error in getRiderLedgerSummary:", error);
    return {
      success: false,
      riders: [],
      totals: { totalPendingDebt: 0, totalRemittedToday: 0, activeRidersCount: 0, unsettledOrdersCount: 0 },
      error: error.message || "فشل جلب دفتر عهدة الطيارين",
    };
  }
}

// ---------------------------------------------------------------------
// 6. Get Active Riders List (for dropdown selection)
// ---------------------------------------------------------------------

export async function getActiveRidersList(): Promise<string[]> {
  try {
    const staffRiders = await prisma.staff.findMany({
      where: {
        active: true,
        role: { in: ["RIDER", "طيار", "دليفري", "سائق"] },
      },
      select: { name: true },
    });

    const recentOrderRiders = await prisma.order.findMany({
      where: {
        orderType: "DELIVERY",
        riderName: { not: null },
      },
      select: { riderName: true },
      distinct: ["riderName"],
      take: 20,
    });

    const names = new Set<string>();

    staffRiders.forEach((s) => names.add(s.name.trim()));
    recentOrderRiders.forEach((o) => {
      if (o.riderName && o.riderName.trim()) names.add(o.riderName.trim());
    });

    // Provide default fallback riders if none found yet in DB
    if (names.size === 0) {
      ["كابتن محمود", "كابتن إبراهيم", "كابتن أحمد", "كابتن سيد"].forEach((n) => names.add(n));
    }

    return Array.from(names);
  } catch (error) {
    console.error("Error in getActiveRidersList:", error);
    return ["كابتن محمود", "كابتن إبراهيم", "كابتن أحمد"];
  }
}
