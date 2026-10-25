import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface SecurityAuditLog {
  id: string;
  action: "LOCK_SYSTEM" | "UNLOCK_SYSTEM" | "FORCE_LOGOUT_ALL" | "VOID_ORDER" | "REFUND_ORDER" | "PRICE_CHANGE" | "DISCOUNT_APPLIED" | "ZERO_OUT_RESET" | "RECORD_EXPENSE";
  actionAr: string;
  performedBy: string;
  timestamp: string;
  details?: string;
}

export interface SystemLockState {
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  sessionCutoff: number; // timestamp in ms; any session iat before this is revoked
  logs: SecurityAuditLog[];
}

const CONFIG_KEY = "CENTRAL_SYSTEM_LOCK_STATE";

export async function getSystemLockState(): Promise<SystemLockState> {
  try {
    const record = await prisma.equipment.findFirst({
      where: { name: CONFIG_KEY },
    });

    if (record && record.notes) {
      try {
        const parsed = JSON.parse(record.notes);
        return {
          isLocked: !!parsed.isLocked,
          lockedBy: parsed.lockedBy || null,
          lockedAt: parsed.lockedAt || null,
          sessionCutoff: parsed.sessionCutoff || 0,
          logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        };
      } catch (e) {
        console.error("Error parsing lock state:", e);
      }
    }

    return {
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
      sessionCutoff: 0,
      logs: [],
    };
  } catch (error) {
    console.error("Error reading system lock state:", error);
    return {
      isLocked: false,
      lockedBy: null,
      lockedAt: null,
      sessionCutoff: 0,
      logs: [],
    };
  }
}

export async function saveSystemLockState(state: SystemLockState): Promise<void> {
  const notesJson = JSON.stringify({
    isLocked: state.isLocked,
    lockedBy: state.lockedBy,
    lockedAt: state.lockedAt,
    sessionCutoff: state.sessionCutoff,
    logs: state.logs,
  });

  const existing = await prisma.equipment.findFirst({
    where: { name: CONFIG_KEY },
  });

  if (existing) {
    await prisma.equipment.update({
      where: { id: existing.id },
      data: {
        notes: notesJson,
        type: "SYSTEM_CONFIG",
        status: state.isLocked ? "OUT_OF_SERVICE" : "OPERATIONAL",
      },
    });
  } else {
    await prisma.equipment.create({
      data: {
        name: CONFIG_KEY,
        type: "SYSTEM_CONFIG",
        status: state.isLocked ? "OUT_OF_SERVICE" : "OPERATIONAL",
        notes: notesJson,
      },
    });
  }

  revalidatePath("/pos");
  revalidatePath("/dashboard");
}

export async function logSecurityEvent(
  action: SecurityAuditLog["action"],
  actionAr: string,
  performedBy: string,
  details?: string
) {
  try {
    const state = await getSystemLockState();
    const now = new Date();
    const logEntry: SecurityAuditLog = {
      id: "log_" + Date.now(),
      action,
      actionAr,
      performedBy,
      timestamp: now.toLocaleString("ar-EG"),
      details,
    };

    state.logs = [logEntry, ...state.logs.slice(0, 99)];
    await saveSystemLockState(state);
  } catch (e) {
    console.error("Error logging security event:", e);
  }
}

export async function lockSystem(adminName: string) {
  const state = await getSystemLockState();
  const now = new Date();
  const logEntry: SecurityAuditLog = {
    id: "log_" + Date.now(),
    action: "LOCK_SYSTEM",
    actionAr: "قفل النظام على كل الأجهزة",
    performedBy: adminName,
    timestamp: now.toLocaleString("ar-EG"),
  };

  state.isLocked = true;
  state.lockedBy = adminName;
  state.lockedAt = now.toLocaleString("ar-EG");
  state.logs = [logEntry, ...state.logs.slice(0, 99)];

  await saveSystemLockState(state);
  return { success: true, message: "تم قفل النظام بنجاح على جميع الأجهزة" };
}

export async function unlockSystem(adminName: string) {
  const state = await getSystemLockState();
  const now = new Date();
  const logEntry: SecurityAuditLog = {
    id: "log_" + Date.now(),
    action: "UNLOCK_SYSTEM",
    actionAr: "إعادة فتح النظام",
    performedBy: adminName,
    timestamp: now.toLocaleString("ar-EG"),
  };

  state.isLocked = false;
  state.lockedBy = null;
  state.lockedAt = null;
  state.logs = [logEntry, ...state.logs.slice(0, 99)];

  await saveSystemLockState(state);
  return { success: true, message: "تم إعادة فتح النظام بنجاح" };
}

export async function forceLogoutAllDevices(adminName: string) {
  const state = await getSystemLockState();
  const now = new Date();
  const logEntry: SecurityAuditLog = {
    id: "log_" + Date.now(),
    action: "FORCE_LOGOUT_ALL",
    actionAr: "تسجيل الخروج الإجباري من جميع الأجهزة",
    performedBy: adminName,
    timestamp: now.toLocaleString("ar-EG"),
  };

  state.sessionCutoff = Date.now();
  state.logs = [logEntry, ...state.logs.slice(0, 99)];

  await saveSystemLockState(state);
  return { success: true, message: "تم إبطال جميع الجلسات وتسجيل الخروج بنجاح" };
}
