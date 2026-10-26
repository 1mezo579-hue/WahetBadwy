"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit-logger";

export async function getActiveKitchenOrders() {
  try {
    const orders = await prisma.order.findMany({
      where: {
        workflowStatus: {
          notIn: ["DELIVERED", "CANCELLED", "COMPLETED"],
        },
        createdAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000), // Active orders within last 48 hours
        },
      },
      include: {
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                nameAr: true,
                categoryId: true,
              },
            },
          },
        },
        table: {
          select: {
            id: true,
            name: true,
            number: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc", // FIFO: Oldest orders first
      },
    });

    return { success: true, orders };
  } catch (error: any) {
    console.error("Error fetching active kitchen orders:", error);
    return { success: false, error: error.message || "فشل استدعاء طلبات المطبخ", orders: [] };
  }
}

export async function updateOrderKitchenStatus({
  orderId,
  nextStatus,
  chefName = "شيف المطبخ",
  note,
}: {
  orderId: string;
  nextStatus:
    | "NEW"
    | "RECEIVED_CUSTOMER_MEAT"
    | "PREPARING"
    | "READY"
    | "HANDED_TO_CASHIER"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED";
  chefName?: string;
  note?: string;
}) {
  try {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        workflowStatus: true,
        statusHistory: true,
      },
    });

    if (!existing) {
      return { error: "الطلب غير موجود في النظام" };
    }

    const currentHistory = Array.isArray(existing.statusHistory)
      ? (existing.statusHistory as any[])
      : [];

    const defaultNotes: Record<string, string> = {
      NEW: "طلب جديد وارد للمطبخ",
      RECEIVED_CUSTOMER_MEAT: "استلام لحوم وخامات العميل وتوجيه للشواية",
      PREPARING: "بدء التجهيز والطهي الفعلي (بدء عداد 45 دقيقة)",
      READY: "الطلب جاهز للتسليم في المطبخ",
      HANDED_TO_CASHIER: "تم التسليم للكاشير / مسؤول التسليم",
      OUT_FOR_DELIVERY: "خرج مع مندوب الديليفري للتوصيل للعميل",
      DELIVERED: "تم تسليم الطلب للعميل بنجاح واكتمال الدورة التشغيلية",
    };

    const newHistoryEntry = {
      from: existing.workflowStatus || "NEW",
      to: nextStatus,
      user: chefName,
      timestamp: new Date().toISOString(),
      note: note || defaultNotes[nextStatus] || `تحديث الحالة إلى ${nextStatus}`,
    };

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        workflowStatus: nextStatus,
        statusHistory: [...currentHistory, newHistoryEntry],
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        table: true,
        customer: true,
      },
    });

    await recordAuditLog({
      action: "STATUS_CHANGED",
      orderId: updated.id,
      userName: chefName,
      details: {
        orderNumber: updated.orderNumber,
        fromStatus: existing.workflowStatus,
        toStatus: nextStatus,
        historyCount: currentHistory.length + 1,
      },
      reason: note || defaultNotes[nextStatus] || `تحديث حالة الأوردر إلى ${nextStatus}`,
    });

    revalidatePath("/kitchen");
    revalidatePath("/pos");
    revalidatePath("/dashboard");

    return {
      success: true,
      order: updated,
      message: `تم تحديث حالة الطلب #${updated.orderNumber} إلى (${nextStatus}) بنجاح ✓`,
    };
  } catch (error: any) {
    console.error("Error updating order kitchen status:", error);
    return { error: error.message || "فشل تحديث حالة الطلب في المطبخ" };
  }
}
