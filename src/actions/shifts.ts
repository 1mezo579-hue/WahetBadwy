"use server";

import { prisma } from "@/lib/prisma";
import { OrderStatus, ShiftStatus, TableType } from "@prisma/client";
import { revalidatePath } from "next/cache";

const MAX_SHIFT_HOURS = 12;

/**
 * 1. Get currently active OPEN shift
 * Computes elapsed hours and checks for the 12-hour limit.
 */
export async function getActiveShift(userId?: string) {
  try {
    const activeShift = await prisma.shift.findFirst({
      where: {
        status: ShiftStatus.OPEN,
        ...(userId ? { userId } : {}),
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
        o.table.type !== TableType.OWNER &&
        o.table.type !== TableType.MANAGER
    );

    const complimentaryOrders = shiftOrders.filter(
      (o) =>
        o.isComplimentary ||
        o.table.type === TableType.OWNER ||
        o.table.type === TableType.MANAGER
    );

    const paidOrdersTotal = regularPaidOrders.reduce(
      (sum, o) => sum + o.totalAmount,
      0
    );
    const complimentaryWaivedTotal = complimentaryOrders.reduce(
      (sum, o) => sum + o.subtotal,
      0
    );

    const liveExpectedCash = activeShift.initialCash + paidOrdersTotal;

    return {
      activeShift: {
        ...activeShift,
        elapsedHours,
        hasExceeded12Hours,
        remainingHours,
        liveExpectedCash,
        paidOrdersTotal,
        paidOrdersCount: regularPaidOrders.length,
        complimentaryOrdersCount: complimentaryOrders.length,
        complimentaryWaivedTotal,
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
    // Check if user or system already has an open shift
    const existing = await prisma.shift.findFirst({
      where: { status: ShiftStatus.OPEN },
    });

    if (existing) {
      return {
        error: `يوجد وردية مفتوحة بالفعل (رقم #${existing.shiftNumber}). يرجى تقفيلها أولاً قبل فتح وردية جديدة.`,
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

/**
 * 3. End shift (تقفيل وتسليم الوردية)
 * CRITICAL REQUIREMENTS:
 * - Cashier inputs counted actual cash.
 * - Orders from "Owner Table" and "Manager Table" (Complimentary) MUST be excluded from ExpectedCash.
 * - Compares Actual vs Expected cash and logs shortage/overage.
 */
export async function endShift({
  shiftId,
  actualCash,
  notes,
}: {
  shiftId: string;
  actualCash: number;
  notes?: string;
}) {
  try {
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
      return { error: "الوردية غير موجودة أو مقفلة بالفعل" };
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
        o.table.type !== TableType.OWNER &&
        o.table.type !== TableType.MANAGER
    );

    const complimentaryOrders = paidOrders.filter(
      (o) =>
        o.isComplimentary ||
        o.table.type === TableType.OWNER ||
        o.table.type === TableType.MANAGER
    );

    const salesTotal = regularPaidOrders.reduce(
      (sum, o) => sum + o.totalAmount,
      0
    );
    const expectedCash = shift.initialCash + salesTotal;
    const shortageOverage = actualCash - expectedCash;

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
      },
      include: {
        user: true,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/reports");

    return {
      success: true,
      shift: updatedShift,
      stats: {
        initialCash: shift.initialCash,
        salesTotal,
        expectedCash,
        actualCash,
        shortageOverage,
        paidOrdersCount: regularPaidOrders.length,
        complimentaryOrdersCount: complimentaryOrders.length,
        complimentaryWaivedTotal: complimentaryOrders.reduce(
          (sum, o) => sum + o.subtotal,
          0
        ),
      },
      message: `تم تقفيل الوردية رقم #${shift.shiftNumber} بنجاح. ${
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
