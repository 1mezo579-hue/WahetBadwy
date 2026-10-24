"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus, TableType, TableStatus, OrderType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSystemLockState, logSecurityEvent } from "@/lib/system-lock";

export interface ReportFilters {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  channel?: "ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  status?: "ALL" | "PAID" | "OPEN";
  shiftId?: string;
}

export async function getAdminReportsData(filters?: ReportFilters) {
  try {
    // 1. Strict Server-Side Security Check: Only ADMIN and MANAGER can access financial reports
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { authorized: false, error: "غير مصرح: يجب تسجيل الدخول للوصول إلى التقارير." };
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return {
        authorized: false,
        error: "عذراً، التقارير المالية والإدارية مخصصة للمدير العام ومدير الصالة فقط.",
      };
    }

    // 2. Parse Date Filters (Safe Timezone handling)
    let dateWhere: any = {};
    if (filters?.from) {
      const fromD = new Date(filters.from);
      fromD.setHours(0, 0, 0, 0);
      dateWhere.gte = fromD;
    }
    if (filters?.to) {
      const toD = new Date(filters.to);
      toD.setHours(23, 59, 59, 999);
      dateWhere.lte = toD;
    }

    const orderWhere: any = {};
    if (Object.keys(dateWhere).length > 0) {
      orderWhere.createdAt = dateWhere;
    }
    if (filters?.channel && filters.channel !== "ALL") {
      orderWhere.orderType = filters.channel;
    }
    if (filters?.status && filters.status !== "ALL") {
      orderWhere.status = filters.status;
    }
    if (filters?.shiftId && filters.shiftId !== "ALL") {
      orderWhere.shiftId = filters.shiftId;
    }

    // 3. Parallel Queries for Optimal Performance
    const [
      orders,
      shifts,
      complimentaryOrders,
      rawMaterials,
      menuItemsWithRecipes,
      staffList,
      lockState,
    ] = await Promise.all([
      // Orders
      prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: "desc" },
        include: {
          table: true,
          customer: true,
          user: { select: { id: true, name: true, username: true, role: true } },
          shift: { select: { id: true, shiftNumber: true, status: true, startTime: true } },
          items: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  nameAr: true,
                  price: true,
                  categoryId: true,
                  category: { select: { id: true, nameAr: true } },
                },
              },
            },
          },
        },
      }),

      // Shifts
      prisma.shift.findMany({
        where: Object.keys(dateWhere).length > 0 ? { startTime: dateWhere } : undefined,
        orderBy: { startTime: "desc" },
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
          orders: {
            where: { status: OrderStatus.PAID },
            select: { id: true, totalAmount: true, isComplimentary: true, orderType: true },
          },
        },
      }),

      // Complimentary & VIP Orders
      prisma.order.findMany({
        where: {
          ...(Object.keys(dateWhere).length > 0 ? { createdAt: dateWhere } : {}),
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

      // Raw Materials & Inventory
      prisma.rawMaterial.findMany({
        orderBy: { name: "asc" },
        include: {
          recipeItems: {
            include: {
              menuItem: { select: { id: true, nameAr: true } },
            },
          },
        },
      }),

      // Menu Items with Recipes for Cost & Profit Calculation
      prisma.menuItem.findMany({
        include: {
          category: { select: { id: true, nameAr: true } },
          recipeItems: {
            include: {
              rawMaterial: { select: { id: true, name: true, costPerUnit: true, unit: true } },
            },
          },
        },
      }),

      // Staff & Attendances
      prisma.staff.findMany({
        include: {
          attendances: {
            where: Object.keys(dateWhere).length > 0 ? { date: dateWhere } : undefined,
            orderBy: { date: "desc" },
          },
        },
      }),

      // System Lock & Audit Log
      getSystemLockState(),
    ]);

    // 4. Sales Metrics Computation
    const paidOrders = orders.filter((o) => o.status === OrderStatus.PAID);
    const totalSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalDiscounts = paidOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const totalDeliveryFees = paidOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    const averageOrderValue = paidOrders.length > 0 ? totalSales / paidOrders.length : 0;

    // Daily Breakdown
    const dailyMap = new Map<string, { date: string; revenue: number; count: number; discounts: number }>();
    paidOrders.forEach((o) => {
      const dStr = new Date(o.createdAt).toISOString().split("T")[0];
      const existing = dailyMap.get(dStr) || { date: dStr, revenue: 0, count: 0, discounts: 0 };
      existing.revenue += o.totalAmount;
      existing.count += 1;
      existing.discounts += o.discount || 0;
      dailyMap.set(dStr, existing);
    });
    const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    // 5. Channel Breakdown (Takeaway, Delivery, Dine-in)
    const channelStats = {
      TAKEAWAY: { nameAr: "تيك أواي (سفري)", count: 0, revenue: 0, percentage: 0 },
      DELIVERY: { nameAr: "دليفري (توصيل)", count: 0, revenue: 0, deliveryFees: 0, percentage: 0 },
      DINE_IN: { nameAr: "صالة داخلي", count: 0, revenue: 0, percentage: 0 },
    };

    paidOrders.forEach((o) => {
      const ch = o.orderType as keyof typeof channelStats;
      if (channelStats[ch]) {
        channelStats[ch].count += 1;
        channelStats[ch].revenue += o.totalAmount;
        if (ch === "DELIVERY") {
          channelStats.DELIVERY.deliveryFees += o.deliveryFee || 0;
        }
      }
    });

    if (totalSales > 0) {
      channelStats.TAKEAWAY.percentage = (channelStats.TAKEAWAY.revenue / totalSales) * 100;
      channelStats.DELIVERY.percentage = (channelStats.DELIVERY.revenue / totalSales) * 100;
      channelStats.DINE_IN.percentage = (channelStats.DINE_IN.revenue / totalSales) * 100;
    }

    // 6. Item Performance (Quantities & Revenues)
    const itemsMap = new Map<
      string,
      {
        id: string;
        nameAr: string;
        categoryNameAr: string;
        price: number;
        quantitySold: number;
        totalRevenue: number;
      }
    >();

    paidOrders.forEach((o) => {
      o.items.forEach((item) => {
        const itemId = item.menuItemId;
        const nameAr = item.menuItem?.nameAr || "صنف غير معروف";
        const catName = item.menuItem?.category?.nameAr || "عام";
        const existing = itemsMap.get(itemId) || {
          id: itemId,
          nameAr,
          categoryNameAr: catName,
          price: item.unitPrice,
          quantitySold: 0,
          totalRevenue: 0,
        };
        existing.quantitySold += item.quantity;
        existing.totalRevenue += item.totalPrice;
        itemsMap.set(itemId, existing);
      });
    });

    const itemsSoldList = Array.from(itemsMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
    const topSellingItems = itemsSoldList.slice(0, 10);
    const leastSellingItems = [...itemsSoldList].reverse().slice(0, 10);

    // 7. Profit & Cost Analysis (Strict: NEVER fabricate unrecorded costs)
    // Pre-calculate recipe food cost for each menuItem
    const itemCostMap = new Map<string, { cost: number; hasFullRecipe: boolean }>();
    menuItemsWithRecipes.forEach((m) => {
      if (!m.recipeItems || m.recipeItems.length === 0) {
        itemCostMap.set(m.id, { cost: 0, hasFullRecipe: false });
        return;
      }
      let itemCost = 0;
      let hasValidData = true;
      for (const r of m.recipeItems) {
        const mat = r.rawMaterial;
        if (!mat || mat.costPerUnit <= 0) {
          hasValidData = false;
        } else {
          itemCost += r.quantity * mat.costPerUnit;
        }
      }
      itemCostMap.set(m.id, { cost: itemCost, hasFullRecipe: hasValidData && itemCost > 0 });
    });

    let totalEstimatedFoodCost = 0;
    let totalRevenueFromCostedItems = 0;
    let unrecordedCostItemsCount = 0;

    const profitByItemList = itemsSoldList.map((item) => {
      const costInfo = itemCostMap.get(item.id) || { cost: 0, hasFullRecipe: false };
      const unitCost = costInfo.cost;
      const hasRecipe = costInfo.hasFullRecipe;

      if (!hasRecipe || unitCost <= 0) {
        unrecordedCostItemsCount++;
        return {
          ...item,
          unitCost: null,
          hasCostData: false,
          unitMargin: null,
          marginPercent: null,
          totalProfit: null,
          totalCost: null,
        };
      }

      const unitMargin = item.price - unitCost;
      const marginPercent = item.price > 0 ? (unitMargin / item.price) * 100 : 0;
      const totalCost = unitCost * item.quantitySold;
      const totalProfit = unitMargin * item.quantitySold;

      totalEstimatedFoodCost += totalCost;
      totalRevenueFromCostedItems += item.totalRevenue;

      return {
        ...item,
        unitCost,
        hasCostData: true,
        unitMargin,
        marginPercent,
        totalProfit,
        totalCost,
      };
    });

    const totalEstimatedGrossProfit = totalRevenueFromCostedItems - totalEstimatedFoodCost;
    const overallEstimatedMarginPercent =
      totalRevenueFromCostedItems > 0
        ? (totalEstimatedGrossProfit / totalRevenueFromCostedItems) * 100
        : 0;

    // 8. Inventory & Stock Valuation
    const inventoryItems = rawMaterials.map((mat) => {
      const isLow = mat.currentStock <= mat.minStockLevel;
      const totalValue = mat.currentStock * mat.costPerUnit;
      return {
        id: mat.id,
        name: mat.name,
        unit: mat.unit,
        currentStock: mat.currentStock,
        minStockLevel: mat.minStockLevel,
        costPerUnit: mat.costPerUnit,
        totalValue,
        isLow,
      };
    });

    const totalInventoryValue = inventoryItems.reduce((sum, i) => sum + i.totalValue, 0);
    const lowStockAlerts = inventoryItems.filter((i) => i.isLow);

    // 9. Expenses Breakdown from Shift Records
    const expensesList: Array<{
      date: string;
      shiftNumber: number;
      cashierName: string;
      amount: number;
      item: string;
      receiver?: string;
      responsible?: string;
      notes?: string;
    }> = [];

    shifts.forEach((s) => {
      const sNum = s.shiftNumber;
      const cName = s.user?.name || "كاشير";
      const sDate = new Date(s.startTime).toLocaleDateString("ar-EG");
      let details: any[] = [];
      if (Array.isArray(s.expensesDetails)) {
        details = s.expensesDetails;
      } else if (typeof s.expensesDetails === "string") {
        try {
          details = JSON.parse(s.expensesDetails);
        } catch {}
      }

      details.forEach((exp: any) => {
        expensesList.push({
          date: sDate,
          shiftNumber: sNum,
          cashierName: cName,
          amount: parseFloat(exp.amount) || 0,
          item: exp.item || "مصروف عام",
          receiver: exp.receiver || "-",
          responsible: exp.responsible || "-",
          notes: exp.notes || "",
        });
      });
    });

    const totalRecordedExpenses = shifts.reduce((sum, s) => sum + (s.expensesTotal || 0), 0);

    // 10. Shifts Reconciliation (Drawer Cash vs Card vs Shortage/Overage)
    const shiftsReport = shifts.map((s) => {
      const durationHours = s.endTime
        ? ((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60)).toFixed(1)
        : "جارية";

      return {
        id: s.id,
        shiftNumber: s.shiftNumber,
        cashierName: s.user?.name || s.user?.username || "كاشير",
        startTime: s.startTime,
        endTime: s.endTime,
        durationHours,
        status: s.status,
        initialCash: s.initialCash,
        grossSales: s.grossSales || 0,
        visaAmount: s.visaAmount || 0,
        expensesTotal: s.expensesTotal || 0,
        managementChecks: s.managementChecks || 0,
        managementWithdrawals: s.managementWithdrawalsTotal || 0,
        expectedCash: s.expectedCash,
        actualCash: s.actualCash,
        shortageOverage: s.shortageOverage || 0,
        endOfDayBalance: s.endOfDayBalance || 0,
        receivedBy: s.receivedBy || "-",
        ordersCount: s.orders.length,
      };
    });

    // 11. Staff Attendance and Hours
    const staffReport = staffList.map((st) => {
      const totalHours = st.attendances.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
      const estimatedWages = (st.hourlyRate || 0) * totalHours;
      return {
        id: st.id,
        name: st.name,
        role: st.role,
        phone: st.phone || "-",
        monthlySalary: st.monthlySalary || 0,
        hourlyRate: st.hourlyRate || 0,
        active: st.active,
        totalAttendances: st.attendances.length,
        totalHoursWorked: totalHours,
        estimatedWages,
      };
    });

    // 12. Security Audit Logs
    const auditLogs = lockState.logs || [];

    return {
      authorized: true,
      userRole,
      userName: session.user.name || "المدير",
      filters: filters || {},
      salesSummary: {
        totalSales,
        totalPaidOrders: paidOrders.length,
        allOrdersCount: orders.length,
        averageOrderValue,
        totalDiscounts,
        totalDeliveryFees,
        dailyBreakdown,
      },
      channelBreakdown: channelStats,
      itemsPerformance: {
        all: itemsSoldList,
        top10: topSellingItems,
        least10: leastSellingItems,
      },
      profitReport: {
        items: profitByItemList,
        totalRevenueFromCostedItems,
        totalEstimatedFoodCost,
        totalEstimatedGrossProfit,
        overallEstimatedMarginPercent,
        unrecordedCostItemsCount,
      },
      inventoryReport: {
        items: inventoryItems,
        totalInventoryValue,
        lowStockAlerts,
      },
      expensesReport: {
        expenses: expensesList,
        totalRecordedExpenses,
      },
      shiftsReport,
      ordersReport: {
        orders: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          orderType: o.orderType,
          status: o.status,
          isComplimentary: o.isComplimentary,
          tableName: o.table?.name || (o.orderType === "TAKEAWAY" ? "تيك أواي" : "دليفري"),
          customerName: o.customer?.name || o.customerName || "-",
          customerPhone: o.customer?.phone || o.customerPhone || "-",
          cashierName: o.user?.name || "كاشير",
          subtotal: o.subtotal,
          discount: o.discount,
          deliveryFee: o.deliveryFee,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          itemsCount: o.items.length,
          itemsSummary: o.items.map((i) => `${i.quantity}x ${i.menuItem?.nameAr || "صنف"}`).join("، "),
        })),
        totalOrders: orders.length,
        paidCount: paidOrders.length,
        openCount: orders.filter((o) => o.status === OrderStatus.OPEN).length,
      },
      complimentaryReport: {
        orders: complimentaryOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          tableName: o.table?.name || "ضيافة إدارة",
          responsible: o.user?.name || "الإدارة",
          subtotal: o.subtotal,
          createdAt: o.createdAt,
          items: o.items.map((i) => `${i.quantity}x ${i.menuItem?.nameAr || "صنف"}`).join("، "),
        })),
        totalWaived: complimentaryOrders.reduce((sum, o) => sum + o.subtotal, 0),
        count: complimentaryOrders.length,
      },
      auditReport: {
        logs: auditLogs,
      },
      staffReport,
    };
  } catch (error: any) {
    console.error("Error generating admin reports:", error);
    return {
      authorized: true,
      error: error.message || "فشل توليد بيانات التقارير",
    };
  }
}

/**
 * Refund / Void / Delete Order (حذف الفاتورة كمرتجع واستعادة المخزون مع توثيق التدقيق)
 */
export async function refundOrDeleteOrder(orderId: string, reason?: string) {
  try {
    const lockState = await getSystemLockState();
    if (lockState.isLocked) {
      return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };
    }

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { error: "غير مصرح: يجب تسجيل الدخول لتنفيذ هذا الإجراء." };
    }
    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
      return { error: "عذراً، حذف الفواتير وتعديل المخزون مقصور على الإدارة (المدير العام أو مدير الصالة) فقط." };
    }
    const userName = session.user.name || "المدير";

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

    // 1. Return/Restore raw materials to inventory stock
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

    // 2. Free up table if needed
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

    // 3. Delete the order
    await prisma.order.delete({
      where: { id: orderId },
    });

    // 4. Log security audit event
    await logSecurityEvent(
      "REFUND_ORDER",
      "حذف واسترجاع فاتورة (مرتجع)",
      userName,
      `تم حذف الفاتورة رقم #${order.orderNumber} بمبلغ ${order.totalAmount} ج.م. سبب المرتجع: ${reason || "لم يذكر"}`
    );

    revalidatePath("/dashboard/reports");
    revalidatePath("/pos");
    revalidatePath("/dashboard/tables");

    return {
      success: true,
      message: `تم حذف الفاتورة رقم #${order.orderNumber} بنجاح كمرتجع واستعادة رصيد المواد الخام في المخزن وتوثيق العملية في سجل التدقيق.`,
    };
  } catch (error: any) {
    console.error("Error refunding/deleting order:", error);
    return { error: error.message || "فشل حذف الفاتورة واسترجاعها" };
  }
}
