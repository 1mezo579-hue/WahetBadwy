"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

export interface FastOrderSearchFilters {
  query?: string;
  orderType?: "ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "CUSTOMER_GRILL";
  status?: "ALL" | "OPEN" | "PAID" | "CANCELLED";
  riderName?: string;
  date?: string;
  limit?: number;
}

export interface FastOrderSearchResult {
  id: string;
  orderNumber: number;
  orderType: string;
  orderTypeAr: string;
  orderKind: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  tableName: string | null;
  subtotal: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  paymentMethod: string;
  paymentStatus: "PAID" | "UNPAID" | "CANCELLED";
  paymentStatusAr: string;
  workflowStatus: string;
  workflowStatusAr: string;
  deliveryStatus: string;
  riderName: string | null;
  riderCashDue: number;
  riderCashRemitted: number;
  reprintCount: number;
  isComplimentary: boolean;
  hospitalityValue: number;
  createdAt: string;
  createdAtFormatted: string;
  notes: string | null;
  items: {
    id: string;
    nameAr: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string | null;
  }[];
}

/**
 * Normalizes Egyptian phone numbers for fuzzy searching:
 * Handles +20, 0020, 20, leading 0, etc.
 * Returns array of searchable prefixes and formats.
 */
function normalizeEgyptianPhoneVariations(phoneQuery: string): string[] {
  const digits = phoneQuery.replace(/\D/g, "");
  if (!digits) return [phoneQuery];

  const variations = new Set<string>();
  variations.add(phoneQuery);
  variations.add(digits);

  // If starts with 20 (e.g. 2010... or +2010...)
  if (digits.startsWith("20") && digits.length >= 3) {
    const local = "0" + digits.substring(2);
    variations.add(local);
    variations.add(digits.substring(2));
  }

  // If starts with 01 (e.g. 010..., 011..., 012..., 015...)
  if (digits.startsWith("01")) {
    variations.add(digits);
    variations.add(digits.substring(1)); // 10...
    variations.add("2" + digits); // 2010...
    variations.add("+2" + digits); // +2010...
  } else if (digits.startsWith("1") && (digits[1] === "0" || digits[1] === "1" || digits[1] === "2" || digits[1] === "5")) {
    variations.add("0" + digits);
    variations.add("20" + digits);
    variations.add("+20" + digits);
  }

  return Array.from(variations);
}

export async function fastSearchOrders(
  filters: FastOrderSearchFilters = {}
): Promise<{ success: boolean; orders: FastOrderSearchResult[]; totalFound: number; error?: string }> {
  try {
    const {
      query = "",
      orderType = "ALL",
      status = "ALL",
      riderName,
      date,
      limit = 50,
    } = filters;

    const trimmedQuery = query.trim();
    const where: any = {};

    // 1. Order Type Filter
    if (orderType && orderType !== "ALL") {
      if (orderType === "CUSTOMER_GRILL") {
        where.orderKind = "CUSTOMER_GRILL";
      } else {
        where.orderType = orderType;
        where.orderKind = { not: "CUSTOMER_GRILL" };
      }
    }

    // 2. Status Filter
    if (status && status !== "ALL") {
      if (status === "CANCELLED") {
        where.workflowStatus = "CANCELLED";
      } else if (status === "PAID") {
        where.status = OrderStatus.PAID;
        where.workflowStatus = { not: "CANCELLED" };
      } else if (status === "OPEN") {
        where.status = OrderStatus.OPEN;
        where.workflowStatus = { not: "CANCELLED" };
      }
    }

    // 3. Rider Name Filter
    if (riderName && riderName !== "ALL") {
      where.OR = [
        { riderName: { contains: riderName, mode: "insensitive" } },
        { deliveredBy: { contains: riderName, mode: "insensitive" } },
      ];
    }

    // 4. Date Filter
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    // 5. Query Search (Order #, Egyptian Phone, Customer Name, Rider, ID)
    if (trimmedQuery) {
      const isNumeric = /^\d+$/.test(trimmedQuery.replace(/^#/, ""));
      const parsedNum = isNumeric ? parseInt(trimmedQuery.replace(/^#/, ""), 10) : null;
      const phoneVariations = normalizeEgyptianPhoneVariations(trimmedQuery);

      const searchConditions: any[] = [
        { customerName: { contains: trimmedQuery, mode: "insensitive" } },
        { deliveryAddress: { contains: trimmedQuery, mode: "insensitive" } },
        { riderName: { contains: trimmedQuery, mode: "insensitive" } },
        { deliveredBy: { contains: trimmedQuery, mode: "insensitive" } },
        { id: { contains: trimmedQuery } },
      ];

      // Phone clauses
      phoneVariations.forEach((varPhone) => {
        searchConditions.push({ customerPhone: { contains: varPhone } });
      });

      // Order number clause
      if (parsedNum !== null && parsedNum > 0 && parsedNum < 2147483647) {
        searchConditions.push({ orderNumber: parsedNum });
      }

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const rawOrders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      include: {
        table: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    const orders: FastOrderSearchResult[] = rawOrders.map((o) => {
      const isPaid = o.status === OrderStatus.PAID;
      const isCancelled = o.workflowStatus === "CANCELLED";
      const paymentStatus: "PAID" | "UNPAID" | "CANCELLED" = isCancelled ? "CANCELLED" : isPaid ? "PAID" : "UNPAID";

      const createdDate = new Date(o.createdAt);
      const isComplimentary = Boolean(o.isComplimentary || o.table?.type === "OWNER" || o.table?.type === "MANAGER");
      const totalAmount = isComplimentary ? 0 : (o.totalAmount || 0);
      const amountPaid = isPaid ? totalAmount : 0;
      const remainingAmount = isPaid ? 0 : totalAmount;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderType: o.orderType,
        orderTypeAr:
          o.orderKind === "CUSTOMER_GRILL"
            ? "شوي للغير (خامة العميل)"
            : o.orderType === "DELIVERY"
            ? "دليفري (توصيل)"
            : o.orderType === "TAKEAWAY"
            ? "تيك أواي (سفري)"
            : "صالة",
        orderKind: o.orderKind || "NORMAL",
        customerName: o.customerName || null,
        customerPhone: o.customerPhone || null,
        deliveryAddress: o.deliveryAddress || null,
        tableName: o.table ? (o.table.name || `طاولة ${o.table.number}`) : null,
        subtotal: o.subtotal || 0,
        discount: o.discount || 0,
        totalAmount,
        amountPaid,
        remainingAmount,
        paymentMethod: o.paymentMethod || "CASH",
        paymentStatus,
        paymentStatusAr: isCancelled ? "ملغي" : isPaid ? "مسدد" : "مفتوح / غير مسدد",
        workflowStatus: o.workflowStatus || "NEW",
        workflowStatusAr:
          isCancelled
            ? "ملغي"
            : o.workflowStatus === "PREPARING"
            ? "قيد التحضير بالمطبخ"
            : o.workflowStatus === "READY"
            ? "جاهز للتسليم / وصل للكاشير"
            : o.workflowStatus === "WITH_RIDER"
            ? "مع الطيار للتوصيل"
            : o.workflowStatus === "DELIVERED"
            ? "تم التسليم للعميل"
            : "طلب جديد",
        deliveryStatus: o.deliveryStatus || o.workflowStatus || "NEW",
        riderName: o.riderName || o.deliveredBy || null,
        riderCashDue: o.riderCashDue || 0,
        riderCashRemitted: o.riderCashRemitted || 0,
        reprintCount: o.reprintCount || 0,
        isComplimentary,
        hospitalityValue: o.hospitalityValue || 0,
        createdAt: createdDate.toISOString(),
        createdAtFormatted: createdDate.toLocaleString("ar-EG", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        notes: o.notes || null,
        items: o.items.map((i) => ({
          id: i.id,
          nameAr: i.menuItem?.nameAr || "صنف",
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
          notes: i.notes || null,
        })),
      };
    });

    return {
      success: true,
      orders,
      totalFound: orders.length,
    };
  } catch (error: any) {
    console.error("Error in fastSearchOrders:", error);
    return {
      success: false,
      orders: [],
      totalFound: 0,
      error: error.message || "فشل البحث عن الطلبات",
    };
  }
}
