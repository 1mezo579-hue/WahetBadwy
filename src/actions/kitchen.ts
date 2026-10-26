"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit-logger";

export async function getActiveKitchenOrders() {
  try {
    const orders = await prisma.order.findMany({
      where: {
        workflowStatus: {
          notIn: ["DELIVERED", "CANCELLED"],
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
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
  nextStatus: "NEW" | "PREPARING" | "READY" | "DELIVERED" | "RECEIVED_CUSTOMER_MEAT";
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

    const newHistoryEntry = {
      from: existing.workflowStatus || "NEW",
      to: nextStatus,
      user: chefName,
      timestamp: new Date().toISOString(),
      note: note || (nextStatus === "PREPARING" ? "بدء التجهيز والطهي" : nextStatus === "READY" ? "الطلب جاهز للتسليم" : "تم تسليم الطلب للعميل"),
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
      },
      reason: note || `تحديث حالة الأوردر إلى ${nextStatus}`,
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
