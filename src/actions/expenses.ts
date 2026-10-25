"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logSecurityEvent, getSystemLockState } from "@/lib/system-lock";
import {
  getExpenseCategories,
  saveExpenseCategories,
  ExpenseCategoryItem,
  DEFAULT_EXPENSE_CATEGORIES,
  matchExpenseCategory,
} from "@/lib/expenses-catalog";

export interface ExpenseRecord {
  id: string;
  amount: number;
  item: string;
  categoryId?: string;
  categoryName: string;
  categoryGroup?: string;
  paymentMethod: "CASH" | "VISA" | "TRANSFER";
  receiver?: string;
  responsible: string;
  notes?: string;
  shiftId?: string;
  shiftNumber?: number;
  timestamp: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
}

const LEDGER_CONFIG_KEY = "EXPENSE_CENTRAL_LEDGER_V1";

/**
 * 1. Helper to fetch persistent central expenses ledger
 */
export async function getCentralExpenseLedger(): Promise<ExpenseRecord[]> {
  try {
    const record = await prisma.equipment.findFirst({
      where: { name: LEDGER_CONFIG_KEY },
    });
    if (record && record.notes) {
      const parsed = JSON.parse(record.notes);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading central expense ledger:", err);
  }
  return [];
}

/**
 * 2. Helper to save persistent central expenses ledger
 */
async function saveCentralExpenseLedger(records: ExpenseRecord[]): Promise<boolean> {
  try {
    // Keep up to 2000 most recent records to prevent payload bloat
    const trimmed = records.slice(0, 2000);
    const jsonStr = JSON.stringify(trimmed);

    const existing = await prisma.equipment.findFirst({
      where: { name: LEDGER_CONFIG_KEY },
    });

    if (existing) {
      await prisma.equipment.update({
        where: { id: existing.id },
        data: { notes: jsonStr, updatedAt: new Date() },
      });
    } else {
      await prisma.equipment.create({
        data: {
          name: LEDGER_CONFIG_KEY,
          type: "CONFIG",
          status: "OPERATIONAL",
          quantity: 1,
          notes: jsonStr,
        },
      });
    }
    return true;
  } catch (err) {
    console.error("Error saving central expense ledger:", err);
    return false;
  }
}

/**
 * 3. Record an expense: Updates database, active shift drawer, and audit log
 */
export async function recordExpense(payload: {
  amount: number;
  item: string;
  categoryId?: string;
  categoryName: string;
  paymentMethod?: "CASH" | "VISA" | "TRANSFER";
  receiver?: string;
  notes?: string;
}) {
  try {
    // A. Check system lock
    const lockState = await getSystemLockState();
    if (lockState.isLocked) {
      return { success: false, error: `النظام مقفول حالياً بواسطة (${lockState.lockedBy || "الإدارة"})` };
    }

    // B. Check session & role
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "يجب تسجيل الدخول أولاً لتسجيل أي مصروف." };
    }

    const userName = session.user.name || (session.user as any).username || "المستخدم";
    const amount = Number(payload.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      return { success: false, error: "قيمة المصروف يجب أن تكون رقماً أكبر من صفر." };
    }

    const itemDesc = (payload.item || payload.categoryName || "مصروف عام").trim();
    const paymentMethod = payload.paymentMethod || "CASH";
    const nowIso = new Date().toISOString();
    const expenseId = "exp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);

    // C. Check if there is an active OPEN shift
    const activeShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
      orderBy: { startTime: "desc" },
    });

    const newRecord: ExpenseRecord = {
      id: expenseId,
      amount,
      item: itemDesc,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      paymentMethod,
      receiver: payload.receiver || "غير محدد",
      responsible: userName,
      notes: payload.notes || "",
      shiftId: activeShift ? activeShift.id : undefined,
      shiftNumber: activeShift ? activeShift.shiftNumber : undefined,
      timestamp: nowIso,
    };

    // D. If active shift exists, update shift's expensesDetails and drawer cash
    if (activeShift) {
      let currentDetails: any[] = [];
      if (Array.isArray(activeShift.expensesDetails)) {
        currentDetails = activeShift.expensesDetails;
      } else if (typeof activeShift.expensesDetails === "string") {
        try {
          currentDetails = JSON.parse(activeShift.expensesDetails);
        } catch {}
      }

      const updatedDetails = [
        ...currentDetails,
        {
          id: newRecord.id,
          amount: newRecord.amount,
          item: newRecord.item,
          category: newRecord.categoryName,
          paymentMethod: newRecord.paymentMethod,
          receiver: newRecord.receiver,
          responsible: newRecord.responsible,
          notes: newRecord.notes,
          timestamp: newRecord.timestamp,
        },
      ];

      const newExpensesTotal = (activeShift.expensesTotal || 0) + amount;

      // Bedouin Cash Drawer Calculation: If paid in CASH, update expected drawer balance
      let newExpectedCash = activeShift.expectedCash;
      if (paymentMethod === "CASH") {
        newExpectedCash = Math.max(0, (activeShift.expectedCash || 0) - amount);
      }

      await prisma.shift.update({
        where: { id: activeShift.id },
        data: {
          expensesTotal: newExpensesTotal,
          expensesDetails: updatedDetails as any,
          expectedCash: newExpectedCash,
        },
      });
    }

    // E. Save to central persistent ledger
    const ledger = await getCentralExpenseLedger();
    ledger.unshift(newRecord);
    await saveCentralExpenseLedger(ledger);

    // F. Audit logging
    await logSecurityEvent(
      "RECORD_EXPENSE" as any,
      "تسجيل مصروف",
      userName,
      `تم تسجيل مصروف بقيمة ${amount} ج.م [${payload.categoryName}] - طريقة الدفع: ${paymentMethod === "CASH" ? "نقدي من الدرج" : paymentMethod === "VISA" ? "فيزا/كارت" : "تحويل بنكي"}`
    );

    revalidatePath("/dashboard/reports");
    revalidatePath("/pos");

    return {
      success: true,
      expense: newRecord,
      shiftUpdated: !!activeShift,
      shiftNumber: activeShift?.shiftNumber,
      message: `تم تسجيل المصروف بنجاح (${amount} ج.م - ${payload.categoryName}) وتحديث الخزنة.`,
    };
  } catch (error: any) {
    console.error("Error recording expense:", error);
    return { success: false, error: error.message || "فشل تسجيل المصروف في قاعدة البيانات." };
  }
}

/**
 * 4. Get Expenses Summary and Insights
 */
export async function getExpensesSummary(period: "TODAY" | "MONTH" | "ALL" = "TODAY") {
  try {
    const ledger = await getCentralExpenseLedger();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const filtered = ledger.filter((item) => {
      const itemDate = new Date(item.timestamp);
      if (period === "TODAY") return itemDate >= startOfToday;
      if (period === "MONTH") return itemDate >= startOfMonth;
      return true;
    });

    const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);
    const count = filtered.length;

    // Breakdown by Category
    const categoryMap = new Map<string, { name: string; total: number; count: number }>();
    // Breakdown by Payment Method
    const paymentMap = { CASH: 0, VISA: 0, TRANSFER: 0 };

    for (const exp of filtered) {
      const cat = exp.categoryName || "أخرى";
      const existing = categoryMap.get(cat) || { name: cat, total: 0, count: 0 };
      existing.total += exp.amount;
      existing.count += 1;
      categoryMap.set(cat, existing);

      if (exp.paymentMethod in paymentMap) {
        paymentMap[exp.paymentMethod] += exp.amount;
      } else {
        paymentMap.CASH += exp.amount;
      }
    }

    const categoriesList = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
    const topCategories = categoriesList.slice(0, 5);

    return {
      period,
      totalAmount,
      count,
      topCategories,
      allCategories: categoriesList,
      paymentBreakdown: paymentMap,
      expenses: filtered,
    };
  } catch (err: any) {
    console.error("Error generating expenses summary:", err);
    return {
      period,
      totalAmount: 0,
      count: 0,
      topCategories: [],
      allCategories: [],
      paymentBreakdown: { CASH: 0, VISA: 0, TRANSFER: 0 },
      expenses: [],
      error: err.message,
    };
  }
}

/**
 * 5. Manage Categories Catalog (Admin & Manager)
 */
export async function fetchCategoriesCatalog() {
  return await getExpenseCategories();
}

export async function addCategoryToCatalog(item: { nameAr: string; group: string; groupAr: string; keywords?: string[] }) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
    return { success: false, error: "غير مصرح: إدارة دليل المصروفات مقصورة على الإدارة." };
  }

  const list = await getExpenseCategories();
  const newCat: ExpenseCategoryItem = {
    id: "cat-" + Date.now(),
    nameAr: item.nameAr.trim(),
    group: item.group,
    groupAr: item.groupAr,
    active: true,
    keywords: item.keywords && item.keywords.length > 0 ? item.keywords : [item.nameAr.trim()],
  };

  list.push(newCat);
  const ok = await saveExpenseCategories(list);
  revalidatePath("/dashboard/reports");
  return { success: ok, category: newCat };
}

export async function toggleCategoryStatus(id: string) {
  const session = await getServerSession(authOptions);
  if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
    return { success: false, error: "غير مصرح." };
  }

  const list = await getExpenseCategories();
  const found = list.find((c) => c.id === id);
  if (!found) return { success: false, error: "البند غير موجود" };

  found.active = !found.active;
  const ok = await saveExpenseCategories(list);
  revalidatePath("/dashboard/reports");
  return { success: ok, active: found.active };
}

export async function resetCategoriesCatalog() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return { success: false, error: "غير مصرح: إعادة تعيين الدليل للمدير العام فقط." };
  }

  const ok = await saveExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
  revalidatePath("/dashboard/reports");
  return { success: ok };
}


/**
 * 6. Void an Erroneous Expense (Admin & Manager)
 * Restores cash drawer if paid in cash from active shift, flags as isVoided, logs security event.
 */
export async function voidExpense(expenseId: string, reason?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
      return { success: false, error: "غير مصرح: إلغاء المصروفات مقتصر على الإدارة." };
    }

    const userName = session.user.name || (session.user as any).username || "الإدارة";
    const ledger = await getCentralExpenseLedger();
    const target = ledger.find((e) => e.id === expenseId);

    if (!target) {
      return { success: false, error: "المصروف غير موجود أو تم حذفه مسبقاً." };
    }

    if (target.isVoided) {
      return { success: false, error: "هذا المصروف ملغي بالفعل." };
    }

    target.isVoided = true;
    target.voidReason = reason || "إلغاء بواسطة الإدارة";
    target.voidedBy = userName;
    target.voidedAt = new Date().toISOString();

    // If it belongs to an active OPEN shift and paid in CASH, adjust shift expectedCash and expensesTotal
    if (target.shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: target.shiftId },
      });

      if (shift && shift.status === "OPEN") {
        let details: any[] = [];
        if (Array.isArray(shift.expensesDetails)) details = shift.expensesDetails;
        else if (typeof shift.expensesDetails === "string") {
          try { details = JSON.parse(shift.expensesDetails); } catch {}
        }

        const filteredDetails = details.filter((d: any) => d.id !== expenseId);
        const newTotal = Math.max(0, (shift.expensesTotal || 0) - target.amount);
        let newExpectedCash = shift.expectedCash;
        if (target.paymentMethod === "CASH") {
          newExpectedCash = (shift.expectedCash || 0) + target.amount;
        }

        await prisma.shift.update({
          where: { id: shift.id },
          data: {
            expensesTotal: newTotal,
            expensesDetails: filteredDetails as any,
            expectedCash: newExpectedCash,
          },
        });
      }
    }

    await saveCentralExpenseLedger(ledger);

    await logSecurityEvent(
      "VOID_EXPENSE",
      "إلغاء مصروف",
      userName,
      `تم إلغاء المصروف #${expenseId} بقيمة ${target.amount} ج.م [${target.categoryName}]. السبب: ${reason || "بدون سبب"}`
    );

    revalidatePath("/dashboard/reports");
    revalidatePath("/pos");

    return { success: true, message: "تم إلغاء المصروف وتحديث الحسابات بنجاح." };
  } catch (err: any) {
    console.error("Error voiding expense:", err);
    return { success: false, error: err.message || "حدث خطأ أثناء إلغاء المصروف." };
  }
}

/**
 * 7. Batch Import Expenses from Excel / CSV Data
 */
export interface ImportedExpenseInput {
  item: string;
  categoryName?: string;
  amount: number;
  paymentMethod?: string;
  receiver?: string;
  responsible?: string;
  notes?: string;
  date?: string;
}

export async function importExpensesBatch(rows: ImportedExpenseInput[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
      return { success: false, error: "غير مصرح: استيراد المصروفات مخصص للإدارة فقط." };
    }

    const userName = session.user.name || (session.user as any).username || "الإدارة";
    const categories = await getExpenseCategories();
    const ledger = await getCentralExpenseLedger();

    let importedCount = 0;
    const errors: string[] = [];
    const newRecords: ExpenseRecord[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const amount = Number(r.amount);
      if (!amount || isNaN(amount) || amount <= 0) {
        errors.push(`السطر ${i + 1}: المبلغ غير صالح (${r.amount})`);
        continue;
      }

      const itemDesc = (r.item || r.categoryName || "مصروف مستورد").trim();
      let matchedCat = r.categoryName ? matchExpenseCategory(r.categoryName, categories) : null;
      if (!matchedCat) {
        matchedCat = matchExpenseCategory(itemDesc, categories);
      }

      let payMethod: "CASH" | "VISA" | "TRANSFER" = "CASH";
      const payRaw = (r.paymentMethod || "").toLowerCase();
      if (payRaw.includes("فيزا") || payRaw.includes("visa") || payRaw.includes("كارت")) {
        payMethod = "VISA";
      } else if (payRaw.includes("تحويل") || payRaw.includes("bank") || payRaw.includes("انستا") || payRaw.includes("فودافون")) {
        payMethod = "TRANSFER";
      }

      let timestamp = new Date().toISOString();
      if (r.date) {
        const parsedD = new Date(r.date);
        if (!isNaN(parsedD.getTime())) {
          timestamp = parsedD.toISOString();
        }
      }

      const newRecord: ExpenseRecord = {
        id: "exp-imp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6) + "-" + i,
        amount,
        item: itemDesc,
        categoryId: matchedCat?.id,
        categoryName: matchedCat?.nameAr || r.categoryName || "مصروفات عامة",
        paymentMethod: payMethod,
        receiver: (r.receiver || "غير محدد").trim(),
        responsible: (r.responsible || userName).trim(),
        notes: (r.notes || "مستورد من ملف Excel").trim(),
        timestamp,
      };

      newRecords.push(newRecord);
      importedCount++;
    }

    if (newRecords.length > 0) {
      const updatedLedger = [...newRecords, ...ledger];
      await saveCentralExpenseLedger(updatedLedger);

      await logSecurityEvent(
        "IMPORT_EXPENSES",
        "استيراد مصروفات من Excel",
        userName,
        `تم استيراد ${importedCount} مصروف بنجاح من ملف Excel/CSV.`
      );

      revalidatePath("/dashboard/reports");
      revalidatePath("/pos");
    }

    return {
      success: true,
      importedCount,
      errors,
      message: `تم استيراد ${importedCount} مصروف بنجاح.${errors.length > 0 ? ` (تم تخطي ${errors.length} سطر غير صالح)` : ""}`,
    };
  } catch (err: any) {
    console.error("Error importing expenses batch:", err);
    return { success: false, error: err.message || "فشل استيراد المصروفات." };
  }
}
