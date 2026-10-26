import { prisma } from "@/lib/prisma";

export interface AuditLogInput {
  action:
    | "ORDER_CREATED"
    | "PAYMENT_COLLECTED"
    | "ORDER_CANCELLED"
    | "DISCOUNT_APPLIED"
    | "ORDER_REPRINTED"
    | "ITEM_VOIDED"
    | "STATUS_CHANGED"
    | "SHIFT_STARTED"
    | "SHIFT_ENDED"
    | "SYSTEM_LOCKED"
    | "SYSTEM_UNLOCKED";
  orderId?: string | null;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  details?: Record<string, any>;
  reason?: string | null;
}

/**
 * Persists an immutable audit log entry in PostgreSQL and links it to the order history.
 * Non-blocking: will never crash the main transaction if logging encounters an issue.
 */
export async function recordAuditLog(log: AuditLogInput): Promise<boolean> {
  try {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const detailsJson = JSON.stringify(log.details || {});

    await prisma.$executeRawUnsafe(
      `INSERT INTO audit_logs (id, action, order_id, user_id, user_name, user_role, details, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())`,
      id,
      log.action,
      log.orderId || null,
      log.userId || null,
      log.userName || null,
      log.userRole || null,
      detailsJson,
      log.reason || null
    );

    // If linked to an order, also append to order.statusHistory for quick inspection
    if (log.orderId) {
      const existing = await prisma.order.findUnique({
        where: { id: log.orderId },
        select: { statusHistory: true },
      });

      if (existing) {
        const currentHistory = Array.isArray(existing.statusHistory)
          ? (existing.statusHistory as any[])
          : [];

        const newEntry = {
          action: log.action,
          user: log.userName || "النظام",
          role: log.userRole || "CASHIER",
          reason: log.reason || null,
          details: log.details || null,
          timestamp: new Date().toISOString(),
        };

        await prisma.order.update({
          where: { id: log.orderId },
          data: {
            statusHistory: [...currentHistory, newEntry],
          },
        });
      }
    }

    return true;
  } catch (error) {
    console.error("Audit log recording error:", error);
    return false;
  }
}
