"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus, ShiftStatus, TableType } from "@prisma/client";

export async function getAdminReportsData() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [shifts, paidOrders, complimentaryOrders, rawMaterials, categories] =
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

        // 2. All Paid Orders (General Sales)
        prisma.order.findMany({
          where: { status: OrderStatus.PAID },
          orderBy: { createdAt: "desc" },
          include: {
            table: true,
            user: { select: { name: true } },
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

    // Calculate Daily Sales (Today)
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
