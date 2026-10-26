"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus, TableType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit-logger";
import bcrypt from "bcryptjs";

export interface ApplyHospitalityPayload {
  orderId: string;
  orderItemId?: string; // Optional if hospitality on single item
  type: "FULL" | "ITEM" | "DISCOUNT";
  amount?: number;
  reason: string;
  cashierName?: string;
  managerUsername: string;
  managerPassword: string;
}

/**
 * Apply Hospitality / Complimentary (بند الضيافة والعزومات)
 * Strictly requires Manager/Admin verification via bcrypt.
 * Never counts as drawer cash or collected paid sales revenue.
 * Properly handles inventory without double deduction.
 */
export async function applyHospitalityWithManagerApproval(payload: ApplyHospitalityPayload) {
  try {
    const {
      orderId,
      orderItemId,
      type,
      amount: requestedAmount,
      reason,
      cashierName = "الكاشير",
      managerUsername,
      managerPassword,
    } = payload;

    if (!orderId || !reason || !reason.trim()) {
      return { success: false, error: "معرف الطلب وسبب الضيافة/العزومة مطلوبان." };
    }

    if (!managerUsername || !managerPassword) {
      return { success: false, error: "اسم المدير وكلمة مرور المدير مطلوبة لاعتماد بند الضيافة." };
    }

    // 1. Strict Server-side Verification of Manager Credentials via bcrypt
    const manager = await prisma.user.findUnique({
      where: { username: managerUsername.trim().toLowerCase() },
    });

    if (!manager || !manager.active || (manager.role !== Role.ADMIN && manager.role !== Role.MANAGER)) {
      return {
        success: false,
        error: "حساب المدير غير موجود أو ليس لديه الصلاحيات الإدارية المطلوبة (ADMIN/MANAGER).",
      };
    }

    const isMatch = await bcrypt.compare(managerPassword, manager.password);
    if (!isMatch) {
      return { success: false, error: "كلمة مرور المدير غير صحيحة. تم رفض اعتماد الضيافة." };
    }

    // 2. Fetch the target order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        shift: true,
      },
    });

    if (!order) {
      return { success: false, error: "الطلب غير موجود." };
    }

    if (order.workflowStatus === "CANCELLED") {
      return { success: false, error: "لا يمكن تطبيق ضيافة على طلب ملغي." };
    }

    const now = new Date();
    const nowIso = now.toISOString();

    let hospitalityAmount = 0;
    let details: any = {};
    let newSubtotal = order.subtotal || 0;
    let newTotalAmount = order.totalAmount || 0;
    let newDiscount = order.discount || 0;
    let isFullComp = false;

    if (type === "FULL") {
      // Entire Order Complimentary / Hospitality
      hospitalityAmount = order.totalAmount > 0 ? order.totalAmount : order.subtotal;
      isFullComp = true;
      newDiscount = (order.subtotal || hospitalityAmount);
      newTotalAmount = 0;
      details = {
        type: "FULL_ORDER_COMPLIMENTARY",
        originalSubtotal: order.subtotal,
        originalTotal: order.totalAmount,
        itemsCount: order.items.length,
        items: order.items.map((i) => ({
          name: i.menuItem?.nameAr || "صنف",
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      };
    } else if (type === "ITEM") {
      // Complimentary Specific Item
      if (!orderItemId) {
        return { success: false, error: "يرجى تحديد الصنف المراد اعتباره ضيافة/مجاني." };
      }
      const targetItem = order.items.find((i) => i.id === orderItemId);
      if (!targetItem) {
        return { success: false, error: "الصنف المحدد غير موجود في هذا الطلب." };
      }
      hospitalityAmount = targetItem.totalPrice;
      newDiscount = (order.discount || 0) + hospitalityAmount;
      newTotalAmount = Math.max(0, (order.totalAmount || 0) - hospitalityAmount);
      details = {
        type: "ITEM_COMPLIMENTARY",
        itemId: targetItem.id,
        itemName: targetItem.menuItem?.nameAr || "صنف",
        itemQuantity: targetItem.quantity,
        itemUnitPrice: targetItem.unitPrice,
        hospitalityAmount,
      };
    } else if (type === "DISCOUNT") {
      // Approved Managerial Hospitality Discount Amount
      const amt = Number(requestedAmount);
      if (isNaN(amt) || amt <= 0) {
        return { success: false, error: "يرجى تحديد مبلغ الضيافة/الخصم المعتمد." };
      }
      hospitalityAmount = Math.min(amt, order.totalAmount);
      newDiscount = (order.discount || 0) + hospitalityAmount;
      newTotalAmount = Math.max(0, (order.totalAmount || 0) - hospitalityAmount);
      details = {
        type: "PARTIAL_HOSPITALITY_DISCOUNT",
        hospitalityAmount,
        requestedAmount: amt,
      };
    }

    const auditNote = `[بند ضيافة/عزومة: ${hospitalityAmount} ج.م معتمد من المدير ${manager.name} بواسطة ${cashierName} - السبب: ${reason.trim()}]`;

    const updatedHistory = [
      ...(Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : []),
      {
        action: "HOSPITALITY_APPLIED",
        type,
        hospitalityAmount,
        reason: reason.trim(),
        manager: manager.name,
        cashier: cashierName,
        timestamp: nowIso,
        isFullComp,
      },
    ];

    // Atomically update order and record hospitality ledger
    const [updatedOrder, record] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          isComplimentary: isFullComp ? true : order.isComplimentary,
          discount: newDiscount,
          totalAmount: newTotalAmount,
          hospitalityValue: (order.hospitalityValue || 0) + hospitalityAmount,
          hospitalityReason: reason.trim(),
          hospitalityApprovedBy: manager.name,
          hospitalityApprovedAt: now,
          notes: order.notes ? `${order.notes} ${auditNote}` : auditNote,
          statusHistory: updatedHistory,
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      }),
      prisma.hospitalityRecord.create({
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          type,
          amount: hospitalityAmount,
          reason: reason.trim(),
          managerId: manager.id,
          managerName: manager.name,
          cashierName,
          shiftId: order.shiftId,
          details,
        },
      }),
    ]);

    // Audit Log
    await recordAuditLog({
      action: "HOSPITALITY_RECORDED",
      orderId: order.id,
      userId: manager.id,
      userName: manager.name,
      userRole: manager.role,
      reason: `اعتماد بند ضيافة/عزومة بقيمة ${hospitalityAmount} ج.م للطلب #${order.orderNumber} - السبب: ${reason.trim()}`,
      details: {
        orderNumber: order.orderNumber,
        hospitalityAmount,
        type,
        cashier: cashierName,
        manager: manager.name,
        previousTotal: order.totalAmount,
        newTotal: newTotalAmount,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/kitchen");
    revalidatePath("/dashboard/reports");

    return {
      success: true,
      message: `تم اعتماد بند الضيافة بقيمة ${hospitalityAmount} ج.م بنجاح باعتماد المدير (${manager.name}) ✓`,
      order: updatedOrder,
      hospitalityRecord: record,
      hospitalityAmount,
      managerName: manager.name,
    };
  } catch (error: any) {
    console.error("Error in applyHospitalityWithManagerApproval:", error);
    return { success: false, error: error.message || "فشل تسجيل اعتماد بند الضيافة" };
  }
}

/**
 * Get Hospitality Records Report
 */
export async function getHospitalityReport({
  shiftId,
  dateFrom,
  dateTo,
  limit = 100,
}: {
  shiftId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
} = {}) {
  try {
    const where: any = {};
    if (shiftId) where.shiftId = shiftId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const records = await prisma.hospitalityRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const totalHospitalityAmount = records.reduce((sum, r) => sum + r.amount, 0);

    return {
      success: true,
      records,
      totalHospitalityAmount,
      count: records.length,
    };
  } catch (error: any) {
    console.error("Error in getHospitalityReport:", error);
    return { success: false, records: [], totalHospitalityAmount: 0, count: 0, error: error.message };
  }
}
