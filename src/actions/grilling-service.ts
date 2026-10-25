"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GrillingRates, DEFAULT_RATES } from "@/lib/grilling-calculator";

const GRILLING_CONFIG_NAME = "GRILLING_SERVICE_RATES_V1";

// 1. Get Grilling Pricing Configuration
export async function getGrillingRates(): Promise<GrillingRates> {
  try {
    const configRecord = await prisma.equipment.findFirst({
      where: { name: GRILLING_CONFIG_NAME },
    });
    if (configRecord && configRecord.notes) {
      const parsed = JSON.parse(configRecord.notes);
      return {
        meatPricePerKg: Number(parsed.meatPricePerKg) || DEFAULT_RATES.meatPricePerKg,
        chickenPricePerKg: Number(parsed.chickenPricePerKg) || DEFAULT_RATES.chickenPricePerKg,
        chickenPricePerPiece: Number(parsed.chickenPricePerPiece) || DEFAULT_RATES.chickenPricePerPiece,
        fixedServiceFee: Number(parsed.fixedServiceFee) || DEFAULT_RATES.fixedServiceFee,
      };
    }
  } catch (e) {
    console.warn("Could not read grilling rates from db, using defaults:", e);
  }
  return DEFAULT_RATES;
}

// 2. Save Grilling Pricing Configuration
export async function saveGrillingRates(rates: GrillingRates) {
  try {
    const jsonStr = JSON.stringify(rates);
    const existing = await prisma.equipment.findFirst({
      where: { name: GRILLING_CONFIG_NAME },
    });
    if (existing) {
      await prisma.equipment.update({
        where: { id: existing.id },
        data: { notes: jsonStr, unitPrice: rates.meatPricePerKg },
      });
    } else {
      await prisma.equipment.create({
        data: {
          name: GRILLING_CONFIG_NAME,
          type: "SETTINGS",
          notes: jsonStr,
          unitPrice: rates.meatPricePerKg,
          quantity: 1,
        },
      });
    }
    revalidatePath("/pos");
    return { success: true, rates };
  } catch (error: any) {
    console.error("Error saving grilling rates:", error);
    return { error: error.message || "فشل حفظ أسعار خدمة الشوي" };
  }
}

// 3. Update Grilling Order Workflow Status
export type GrillingWorkflowStatus =
  | "NEW"
  | "RECEIVED_CUSTOMER_MEAT"
  | "PREPARING"
  | "GRILLING"
  | "READY_FOR_PICKUP"
  | "DELIVERED"
  | "CANCELLED";

export async function updateGrillingOrderStatus(
  orderId: string,
  newStatus: GrillingWorkflowStatus,
  actionUser: string = "كاشير",
  note?: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, workflowStatus: true, statusHistory: true, deliveredBy: true },
    });

    if (!order) {
      return { error: "الطلب غير موجود" };
    }

    if (order.workflowStatus === "DELIVERED" && newStatus !== "DELIVERED") {
      return { error: "الطلب تم تسليمه للعميل بالفعل ولا يمكن تغيير حالته" };
    }

    const currentHistory = Array.isArray(order.statusHistory)
      ? (order.statusHistory as any[])
      : [];

    const newHistoryEntry = {
      from: order.workflowStatus || "NEW",
      to: newStatus,
      user: actionUser,
      timestamp: new Date().toISOString(),
      note: note || null,
    };

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        workflowStatus: newStatus,
        statusHistory: [...currentHistory, newHistoryEntry],
        ...(newStatus === "DELIVERED" ? { deliveredBy: actionUser } : {}),
      },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/orders");
    return { success: true, order: updated };
  } catch (error: any) {
    console.error("Error updating grilling status:", error);
    return { error: error.message || "فشل تحديث حالة الطلب" };
  }
}

// 4. Update Cooked Weight (للرقابة ومتابعة الهدر دون التأثير على الفاتورة)
export async function updateCookedWeight(
  orderId: string,
  cookedWeightGrams: number,
  notes?: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { customerMeatWeight: true },
    });

    if (!order) return { error: "الطلب غير موجود" };

    const rawWeight = order.customerMeatWeight || 0;
    const shrinkageGrams = Math.max(0, rawWeight - cookedWeightGrams);
    const shrinkagePercent = rawWeight > 0 ? ((shrinkageGrams / rawWeight) * 100).toFixed(1) : "0";

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        cookedWeight: cookedWeightGrams,
      },
    });

    revalidatePath("/pos");
    return {
      success: true,
      rawWeight,
      cookedWeight: cookedWeightGrams,
      shrinkageGrams,
      shrinkagePercent: `${shrinkagePercent}%`,
    };
  } catch (error: any) {
    console.error("Error updating cooked weight:", error);
    return { error: error.message || "فشل تسجيل الوزن بعد التسوية" };
  }
}

// 5. Confirm Delivery & Handover to Customer (تسليم الطلب للعميل)
export async function confirmGrillingDelivery(
  orderId: string,
  deliveredBy: string = "كاشير",
  handoverNotes?: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, workflowStatus: true, statusHistory: true, deliveredBy: true },
    });

    if (!order) return { error: "الطلب غير موجود" };

    if (order.workflowStatus === "DELIVERED") {
      return {
        error: `الطلب تم تسليمه مسبقاً بواسطة (${order.deliveredBy || "الموظف المسؤول"}). منع التسليم المزدوج.`,
      };
    }

    const currentHistory = Array.isArray(order.statusHistory)
      ? (order.statusHistory as any[])
      : [];

    const newHistoryEntry = {
      from: order.workflowStatus || "READY_FOR_PICKUP",
      to: "DELIVERED",
      user: deliveredBy,
      timestamp: new Date().toISOString(),
      note: handoverNotes || "تم تسليم الطلب والتأكد من استلام العميل لمشوياته كاملة",
    };

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        workflowStatus: "DELIVERED",
        deliveredBy,
        statusHistory: [...currentHistory, newHistoryEntry],
      },
    });

    revalidatePath("/pos");
    return { success: true, message: `تم تأكيد تسليم المشويات للعميل بنجاح بواسطة ${deliveredBy}` };
  } catch (error: any) {
    console.error("Error confirming delivery:", error);
    return { error: error.message || "فشل تأكيد التسليم" };
  }
}

// 6. Record Order Reprint (سجل إعادة الطباعة)
export async function recordOrderReprint(orderId: string, user: string = "كاشير", reason?: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, reprintCount: true, statusHistory: true },
    });

    if (!order) return { error: "الطلب غير موجود" };

    const newCount = (order.reprintCount || 0) + 1;
    const currentHistory = Array.isArray(order.statusHistory)
      ? (order.statusHistory as any[])
      : [];

    const reprintLog = {
      action: "REPRINT",
      reprintNumber: newCount,
      user,
      reason: reason || "إعادة طباعة بون",
      timestamp: new Date().toISOString(),
    };

    await prisma.order.update({
      where: { id: orderId },
      data: {
        reprintCount: newCount,
        statusHistory: [...currentHistory, reprintLog],
      },
    });

    return { success: true, reprintCount: newCount };
  } catch (e: any) {
    console.warn("Reprint log failed:", e.message);
    return { error: e.message };
  }
}

// 7. Fetch active Customer Grilling Orders for POS Tracker
export async function getActiveGrillingOrders() {
  try {
    const orders = await prisma.order.findMany({
      where: {
        orderKind: "CUSTOMER_GRILL",
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        items: {
          include: { menuItem: true },
        },
      },
    });
    return orders;
  } catch (e) {
    console.error("Error fetching active grilling orders:", e);
    return [];
  }
}
