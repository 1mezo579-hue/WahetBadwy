"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus, ShiftStatus, TableType, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getAdminReportsData() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [shifts, allOrders, complimentaryOrders, rawMaterials, categories] =
      await Promise.all([
        // 1. All Shifts
        prisma.shift.findMany({
          orderBy: { startTime: "desc" },
          take: 50,
          include: {
            user: { select: { id: true, name: true, username: true, role: true } },
            orders: {
              where: { status: OrderStatus.PAID },
              select: { id: true, totalAmount: true, isComplimentary: true },
            },
          },
        }),

        // 2. All Invoices / Orders (Both PAID and OPEN for full accounting log)
        prisma.order.findMany({
          orderBy: { createdAt: "desc" },
          take: 300,
          include: {
            table: true,
            customer: true,
            user: { select: { id: true, name: true, username: true } },
            shift: { select: { id: true, shiftNumber: true, status: true } },
            items: {
              include: {
                menuItem: {
                  include: { category: true },
                },
              },
            },
          },
        }),

        // 3. CRITICAL REQUIREMENT 5: Separate log for Complimentary Orders (Owner & Manager)
        prisma.order.findMany({
          where: {
            OR: [
              { isComplimentary: true },
              { table: { type: TableType.OWNER } },
              { table: { type: TableType.MANAGER } },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: {
            table: true,
            user: { select: { name: true } },
            items: {
              include: {
                menuItem: true,
              },
            },
          },
        }),

        // 4. Inventory / Raw Materials Consumption
        prisma.rawMaterial.findMany({
          orderBy: { name: "asc" },
          include: {
            recipeItems: {
              include: { menuItem: true },
            },
          },
        }),

        // 5. Categories
        prisma.category.findMany({
          include: {
            items: {
              include: {
                orderItems: {
                  where: { order: { status: OrderStatus.PAID } },
                },
              },
            },
          },
        }),
      ]);

    // Filter paid orders for sales calculation
    const paidOrders = allOrders.filter((o) => o.status === OrderStatus.PAID);
    const todayOrders = paidOrders.filter((o) => new Date(o.createdAt) >= today);
    const todaySales = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const allTimeSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    // Category Sales breakdown
    const categoryBreakdown = categories.map((cat) => {
      let revenue = 0;
      let itemsSold = 0;
      for (const item of cat.items) {
        for (const orderItem of item.orderItems) {
          revenue += orderItem.totalPrice;
          itemsSold += orderItem.quantity;
        }
      }
      return {
        id: cat.id,
        nameAr: cat.nameAr,
        revenue,
        itemsSold,
      };
    });

    // Complimentary stats
    const totalComplimentaryWaived = complimentaryOrders.reduce(
      (sum, o) => sum + o.subtotal,
      0
    );

    return {
      shifts,
      allOrders,
      sales: {
        todaySales,
        todayOrdersCount: todayOrders.length,
        allTimeSales,
        allTimeOrdersCount: paidOrders.length,
        averageOrderValue:
          paidOrders.length > 0 ? allTimeSales / paidOrders.length : 0,
        categoryBreakdown,
      },
      complimentaryOrders,
      totalComplimentaryWaived,
      rawMaterials,
    };
  } catch (error: any) {
    console.error("Error generating admin reports:", error);
    return {
      shifts: [],
      allOrders: [],
      sales: {
        todaySales: 0,
        todayOrdersCount: 0,
        allTimeSales: 0,
        allTimeOrdersCount: 0,
        averageOrderValue: 0,
        categoryBreakdown: [],
      },
      complimentaryOrders: [],
      totalComplimentaryWaived: 0,
      rawMaterials: [],
      error: error.message,
    };
  }
}

/**
 * Refund / Void / Delete Order (حذف الفاتورة كمرتجع واستعادة المخزون)
 */
export async function refundOrDeleteOrder(orderId: string, reason?: string) {
  try {
    if (!orderId) return { error: "معرف الطلب غير محدد" };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        table: true,
        items: {
          include: {
            menuItem: {
              include: {
                recipeItems: true,
              },
            },
          },
        },
      },
    });

    if (!order) return { error: "الفاتورة غير موجودة" };

    // 1. Return/Restore raw materials to inventory stock (استرجاع المكونات للمخزون)
    for (const item of order.items) {
      if (item.menuItem && item.menuItem.recipeItems.length > 0) {
        for (const recipe of item.menuItem.recipeItems) {
          const returnQty = recipe.quantity * item.quantity;
          try {
            await prisma.rawMaterial.update({
              where: { id: recipe.rawMaterialId },
              data: {
                currentStock: {
                  increment: returnQty,
                },
              },
            });
          } catch (stockErr) {
            console.warn("Could not increment stock for material:", recipe.rawMaterialId, stockErr);
          }
        }
      }
    }

    // 2. If table was occupied by this order, check if table should be freed
    if (order.tableId) {
      const otherOrders = await prisma.order.count({
        where: {
          tableId: order.tableId,
          id: { not: order.id },
          status: OrderStatus.OPEN,
        },
      });
      if (otherOrders === 0) {
        try {
          await prisma.diningTable.update({
            where: { id: order.tableId },
            data: { status: TableStatus.AVAILABLE },
          });
        } catch (tableErr) {
          console.warn("Table update error:", tableErr);
        }
      }
    }

    // 3. Delete the order (cascade deletes order_items)
    await prisma.order.delete({
      where: { id: orderId },
    });

    revalidatePath("/dashboard/reports");
    revalidatePath("/pos");
    revalidatePath("/dashboard/tables");

    return {
      success: true,
      message: `تم حذف الفاتورة رقم #${order.orderNumber} بنجاح كمرتجع واستعادة رصيد المواد الخام في المخزن.`,
    };
  } catch (error: any) {
    console.error("Error refunding/deleting order:", error);
    return { error: error.message || "فشل حذف الفاتورة واسترجاعها" };
  }
}
