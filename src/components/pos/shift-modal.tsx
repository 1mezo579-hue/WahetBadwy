"use client";

import { useState } from "react";
import { startShift, endShift, EndShiftPayload, ClosingItem } from "@/actions/shifts";
import { buildZReportHtml, silentPrintHtml } from "@/utils/printer/silent-print";

interface ShiftModalProps {
  currentShift: any | null;
  userId: string;
  userName: string;
  userRole?: string;
  onClose: () => void;
  onShiftUpdated: (shift: any | null) => void;
}

export default function ShiftModal({
  currentShift,
  userId,
  userName,
  userRole = "CASHIER",
  onClose,
  onShiftUpdated,
}: ShiftModalProps) {
  const isShiftOpen = currentShift && currentShift.status === "OPEN";
  const canCloseShift = userRole === "ADMIN" || userRole === "MANAGER";

  // State for Opening Shift
  const [openingFloat, setOpeningFloat] = useState<string>("500");
  const [openNotes, setOpenNotes] = useState<string>("");
  const [isOpening, setIsOpening] = useState(false);

  // State for Closing Shift
  const [actualCashInput, setActualCashInput] = useState<string>("");
  const [visaAmountInput, setVisaAmountInput] = useState<string>("0");
  const [otherBalanceInput, setOtherBalanceInput] = useState<string>("0");
  const [managementChecksInput, setManagementChecksInput] = useState<string>("0");
  const [receivedBy, setReceivedBy] = useState<string>("");
  const [closeNotes, setCloseNotes] = useState<string>("");

  // Detailed Expense items - Automatically populated from Shift records
  const [expenses, setExpenses] = useState<ClosingItem[]>(() => {
    const list = currentShift?.expensesList || currentShift?.expensesDetails;
    if (Array.isArray(list)) {
      return list.map((e: any) => ({
        id: e.id,
        item: e.item || e.category || "مصروف",
        amount: Number(e.amount) || 0,
        notes: e.notes || (e.paymentMethod === "CASH" ? "نقدي من الدرج" : e.paymentMethod),
        receiver: e.receiver || "غير محدد",
        responsible: e.responsible || "",
        paymentMethod: e.paymentMethod || "CASH",
      }));
    }
    return [];
  });
  const [expName, setExpName] = useState("");
  const [expAmount, setExpAmount] = useState("");

  // Detailed Management Withdrawals
  const [withdrawals, setWithdrawals] = useState<ClosingItem[]>([]);
  const [wdName, setWdName] = useState("");
  const [wdAmount, setWdAmount] = useState("");

  const [isClosing, setIsClosing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculations
  const initialCash = currentShift?.initialCash || 0;
  const paidSales = currentShift?.paidOrdersTotal || 0;
  
  // Distinguish cash vs non-cash expenses (Requirement 3: strictly deduct only cash expenses from drawer)
  const cashExpenses = expenses.filter((e: any) => !e.paymentMethod || e.paymentMethod === "CASH");
  const cashExpensesTotal = cashExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const nonCashExpenses = expenses.filter((e: any) => e.paymentMethod && e.paymentMethod !== "CASH");
  const nonCashExpensesTotal = nonCashExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const visaAmount = Number(visaAmountInput) || 0;
  const otherBalance = Number(otherBalanceInput) || 0;
  const managementChecks = Number(managementChecksInput) || 0;

  // Expected Cash in Drawer = Initial + Paid Sales - Visa - Other - Cash Expenses - Management Checks - Withdrawals
  const expectedCash = Math.max(
    0,
    initialCash + paidSales - visaAmount - otherBalance - cashExpensesTotal - managementChecks - totalWithdrawals
  );

  const actualCash = Number(actualCashInput) || 0;
  const shortageOverage = actualCash - expectedCash;

  // Handle Opening Shift
  const handleStartShift = async () => {
    const float = Number(openingFloat);
    if (isNaN(float) || float < 0) {
      setErrorMessage("يرجى إدخال عهدة افتتاحية صالحة");
      return;
    }
    setIsOpening(true);
    setErrorMessage(null);
    try {
      const res = await startShift({ userId, initialCash: float, notes: openNotes });
      if (res.error) {
        setErrorMessage(res.error);
      } else if (res.shift) {
        onShiftUpdated(res.shift);
        alert(res.message);
        onClose();
      }
    } catch (e: any) {
      setErrorMessage(e.message || "حدث خطأ أثناء فتح الوردية");
    } finally {
      setIsOpening(false);
    }
  };

  // Add Expense item
  const handleAddExpense = () => {
    const amt = Number(expAmount);
    if (!expName.trim() || isNaN(amt) || amt <= 0) return;
    setExpenses([...expenses, { item: expName.trim(), amount: amt }]);
    setExpName("");
    setExpAmount("");
  };

  // Remove Expense item
  const handleRemoveExpense = (idx: number) => {
    setExpenses(expenses.filter((_, i) => i !== idx));
  };

  // Add Withdrawal item
  const handleAddWithdrawal = () => {
    const amt = Number(wdAmount);
    if (!wdName.trim() || isNaN(amt) || amt <= 0) return;
    setWithdrawals([...withdrawals, { item: wdName.trim(), amount: amt }]);
    setWdName("");
    setWdAmount("");
  };

  // Remove Withdrawal item
  const handleRemoveWithdrawal = (idx: number) => {
    setWithdrawals(withdrawals.filter((_, i) => i !== idx));
  };

  // Handle Closing Shift
  const handleEndShift = async () => {
    if (!actualCashInput) {
      setErrorMessage("يرجى إدخال النقدية الفعلية الموجودة بالدرج (العد الفعلي)");
      return;
    }
    const actCash = Number(actualCashInput);
    if (isNaN(actCash) || actCash < 0) {
      setErrorMessage("العد الفعلي للنقدية غير صالح");
      return;
    }

    if (!confirm("هل أنت متأكد من تقفيل الوردية الحالية وطباعة تقرير Z-Report؟ لا يمكن التراجع بعد التقفيل.")) {
      return;
    }

    setIsClosing(true);
    setErrorMessage(null);

    const payload: EndShiftPayload = {
      shiftId: currentShift.id,
      actualCash: actCash,
      notes: closeNotes,
      visaAmount,
      otherBalance,
      expensesTotal: totalExpenses,
      expensesDetails: expenses,
      managementChecks,
      managementWithdrawalsTotal: totalWithdrawals,
      managementWithdrawalsDetails: withdrawals,
      receivedBy: receivedBy.trim() || undefined,
    };

    try {
      const res = await endShift(payload);
      if (res.error) {
        setErrorMessage(res.error);
      } else if (res.success && res.stats) {
        // Print Z-Report
        try {
          const zReportHtml = buildZReportHtml(res, userName);
          await silentPrintHtml(zReportHtml);
        } catch (printErr) {
          console.warn("Z-Report printing failed or cancelled:", printErr);
        }

        alert(res.message);
        onShiftUpdated(null);
        onClose();
      }
    } catch (e: any) {
      setErrorMessage(e.message || "حدث خطأ أثناء تقفيل الوردية");
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111624] border border-[#1e263d] rounded-3xl w-full max-w-2xl p-6 shadow-2xl text-stone-100 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1c2438]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl">
              💼
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                {isShiftOpen ? `تقفيل الوردية والخزينة (#${currentShift.shiftNumber})` : "فتح وردية جديدة (تسليم العهدة)"}
              </h2>
              <p className="text-xs text-stone-400">
                مشويات بسيوني — نظام الإدارة المالية وإغلاق اليوم
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#182033] hover:bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CASE 1: NO OPEN SHIFT -> START SHIFT FORM */}
        {!isShiftOpen ? (
          <div className="space-y-4 py-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300">
              <p className="font-bold mb-1">تنبيه بدء العمل:</p>
              <p className="text-stone-300">
                لا توجد وردية مفتوحة حالياً للكاشير ({userName}). يرجى استلام العهدة النقدية للدرج وتأكيد فتح الوردية للبدء في إصدار الفواتير.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                العهدة الافتتاحية بالدرج (ج.م) *
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="500"
                className="w-full bg-[#161c2e] border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 font-mono text-base font-bold outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-stone-400 mt-1">
                المبلغ النقدي المسلم كفكة في الدرج في بداية الوردية.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1.5">
                ملاحظات الاستلام (اختياري)
              </label>
              <textarea
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="مثال: استلام الدرج سليم مع فكة 500 جنيه..."
                rows={2}
                className="w-full bg-[#161c2e] border border-stone-800 rounded-xl p-3 text-stone-100 text-xs outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={handleStartShift}
                disabled={isOpening}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-black py-3 rounded-xl text-sm transition shadow-lg shadow-amber-500/20 active:scale-[0.99]"
              >
                {isOpening ? "جاري فتح الوردية..." : "✓ فتح الوردية وبدء العمل"}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-[#182033] hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-bold transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          /* CASE 2: SHIFT OPEN -> DETAILED CLOSING RECONCILIATION */
          <div className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-1">
            
            {/* Live Shift Stats Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0d121f] border border-[#1a233a] rounded-2xl p-3 text-center">
              <div>
                <p className="text-[10px] text-stone-400">العهدة الافتتاحية</p>
                <p className="font-mono font-black text-amber-400 text-sm">{initialCash.toFixed(2)} ج.م</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400">إجمالي المبيعات</p>
                <p className="font-mono font-black text-emerald-400 text-sm">{paidSales.toFixed(2)} ج.م</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400">الطلبات المكتملة</p>
                <p className="font-mono font-black text-sky-400 text-sm">{currentShift?.paidOrdersCount || 0} طلب</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400">المتوقع بالدرج</p>
                <p className="font-mono font-black text-white text-sm">{expectedCash.toFixed(2)} ج.م</p>
              </div>
            </div>

            {/* Step 1: Counted Actual Cash */}
            <div className="bg-[#141b2d] border border-[#222d4a] rounded-2xl p-4">
              <label className="block text-xs font-black text-amber-400 mb-1.5 flex items-center justify-between">
                <span>1. العد الفعلي للنقدية بالدرج (Actual Cash) *</span>
                <span className="text-[10px] text-stone-400">جرد الكاش الفعلي باليد</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                placeholder="أدخل إجمالي الفلوس الموجودة في الدرج..."
                className="w-full bg-[#0d121f] border border-amber-500/50 rounded-xl px-4 py-2.5 text-white font-mono text-lg font-black outline-none focus:border-amber-400"
              />

              {/* Shortage / Overage Live Indicator */}
              {actualCashInput !== "" && (
                <div
                  className={`mt-2.5 p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    shortageOverage === 0
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : shortageOverage < 0
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                      : "bg-sky-500/15 border-sky-500/40 text-sky-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {shortageOverage === 0 ? "✓" : shortageOverage < 0 ? "⚠️" : "ℹ️"}
                    </span>
                    <span>
                      {shortageOverage === 0
                        ? "الدرج مطابق تماماً للحسابات المتوقعة"
                        : shortageOverage < 0
                        ? `يوجد عجز نقدي بقيمة ${Math.abs(shortageOverage).toFixed(2)} ج.م`
                        : `يوجد زيادة نقدية بقيمة ${shortageOverage.toFixed(2)} ج.م`}
                    </span>
                  </div>
                  <span className="font-mono font-black text-sm">
                    {shortageOverage > 0 ? `+${shortageOverage.toFixed(2)}` : shortageOverage.toFixed(2)} ج.م
                  </span>
                </div>
              )}
            </div>

            {/* Step 2: Non-Cash Payments (Visa, Wallets, Management Checks) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#141b2d] border border-[#222d4a] rounded-2xl p-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  💳 مبيعات شبكة / فيزا (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  value={visaAmountInput}
                  onChange={(e) => setVisaAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0d121f] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-mono text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  📑 شيكات أو رصيد آجل (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  value={managementChecksInput}
                  onChange={(e) => setManagementChecksInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0d121f] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 font-mono text-xs outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Step 3: Expenses and Emergency Purchases */}
            <div className="bg-[#141b2d] border border-[#222d4a] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-400">
                  🛒 المصروفات والنثريات من الدرج (إجمالي: {totalExpenses.toFixed(2)} ج.م)
                </span>
              </div>

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  placeholder="بند المصروف (مثال: بصل، خضار، نظافة...)"
                  className="flex-1 bg-[#0d121f] border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200 outline-none focus:border-amber-500"
                />
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="المبلغ ج.م"
                  className="w-24 bg-[#0d121f] border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200 font-mono outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddExpense}
                  className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl transition"
                >
                  + إضافة
                </button>
              </div>

              {expenses.length > 0 && (
                <div className="space-y-1.5 mt-2 max-h-24 overflow-y-auto">
                  {expenses.map((exp, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-[#0d121f] px-3 py-1.5 rounded-lg text-xs border border-stone-800"
                    >
                      <span className="text-stone-300">{exp.item}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-rose-400 font-bold">-{exp.amount.toFixed(2)} ج.م</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExpense(i)}
                          className="text-stone-500 hover:text-rose-400 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 4: Management Withdrawals */}
            <div className="bg-[#141b2d] border border-[#222d4a] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400">
                  🏛️ مسحوبات الإدارة من الدرج (إجمالي: {totalWithdrawals.toFixed(2)} ج.م)
                </span>
              </div>

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={wdName}
                  onChange={(e) => setWdName(e.target.value)}
                  placeholder="اسم المستلم بالإدارة أو سبب السحب..."
                  className="flex-1 bg-[#0d121f] border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200 outline-none focus:border-amber-500"
                />
                <input
                  type="number"
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                  placeholder="المبلغ ج.م"
                  className="w-24 bg-[#0d121f] border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-200 font-mono outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddWithdrawal}
                  className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition"
                >
                  + إضافة
                </button>
              </div>

              {withdrawals.length > 0 && (
                <div className="space-y-1.5 mt-2 max-h-24 overflow-y-auto">
                  {withdrawals.map((wd, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-[#0d121f] px-3 py-1.5 rounded-lg text-xs border border-stone-800"
                    >
                      <span className="text-stone-300">{wd.item}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400 font-bold">-{wd.amount.toFixed(2)} ج.م</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveWithdrawal(i)}
                          className="text-stone-500 hover:text-amber-400 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 5: عهدة الدليفري والطيارين (Delivery & Rider Ledger Reconciliation) */}
            <div className="bg-[#141b2d] border border-[#222d4a] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base text-teal-400">🛵</span>
                  <h4 className="text-xs font-black text-teal-300">عهدة الدليفري والطيارين بالوردية</h4>
                </div>
                <span className="text-[10px] text-stone-400">تسويات النقدية خارج الدرج</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-[#0d121f] p-2.5 rounded-xl border border-emerald-500/30">
                  <p className="text-[10px] text-stone-400">نقدية وردها الطيارون للدرج</p>
                  <p className="font-mono font-black text-emerald-400 text-sm mt-0.5">
                    +{(currentShift?.riderRemittancesTotal || 0).toFixed(2)} ج.م
                  </p>
                </div>
                <div className="bg-[#0d121f] p-2.5 rounded-xl border border-amber-500/30">
                  <p className="text-[10px] text-stone-400">مبالغ لا تزال معلقة مع الطيارين</p>
                  <p className="font-mono font-black text-amber-400 text-sm mt-0.5">
                    {(currentShift?.riderPendingDebtTotal || 0).toFixed(2)} ج.م
                  </p>
                </div>
              </div>

              {/* Rider breakdown if any debts */}
              {currentShift?.riderDebtsBreakdown && currentShift.riderDebtsBreakdown.length > 0 && (
                <div className="bg-[#0d121f] p-2.5 rounded-xl border border-amber-500/20 space-y-1">
                  <p className="text-[10px] font-bold text-amber-300 mb-1">تفاصيل العهد المعلقة على كل طيار:</p>
                  {currentShift.riderDebtsBreakdown.map((r: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-stone-800 last:border-0">
                      <span className="text-stone-300">{r.riderName}</span>
                      <span className="font-mono font-bold text-amber-400">{r.pendingDebt.toFixed(2)} ج.م معلق</span>
                    </div>
                  ))}
                  <p className="text-[9px] text-stone-400 pt-1">
                    ⚠️ تنبيه: المبالغ المعلقة أعلاه لم تدخل درج الكاشير بعد، وتظل مسجلة كعهدة تشغيلية على الطيار حتى يتم توريدها.
                  </p>
                </div>
              )}
            </div>

            {/* Step 5: Receiver name & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  اسم مستلم الخزينة (المشرف / الإدارة)
                </label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="مثال: أ / بسيوني أو مشرف الوردية"
                  className="w-full bg-[#141b2d] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  ملاحظات تقفيل الوردية
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="أي ملاحظات خاصة بالتقفيل..."
                  className="w-full bg-[#141b2d] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Actions: End Shift & Print Z-Report */}
            {!canCloseShift && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-center text-xs text-amber-300 font-bold">
                ⚠️ تقفيل واعتماد الوردية نهائياً متاح فقط لمدير المطعم أو الأدمن. كاشير الوردية يمكنه مراجعة الأرقام فقط ولا يملك صلاحية الإغلاق.
              </div>
            )}
            <div className="flex gap-3 pt-3 border-t border-[#1c2438]">
              <button
                onClick={handleEndShift}
                disabled={isClosing || !canCloseShift}
                className={`flex-1 font-black py-3 rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 ${
                  canCloseShift
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 active:scale-[0.99]"
                    : "bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700"
                }`}
              >
                <span>🖨️</span>
                <span>{isClosing ? "جاري التقفيل والطباعة..." : canCloseShift ? "تقفيل الوردية وطباعة تقرير Z-Report" : "مغلق (يتطلب صلاحية مدير)"}</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-[#182033] hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-bold transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
