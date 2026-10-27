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
  
  // Distinguish cash vs non-cash expenses
  const cashExpenses = expenses.filter((e: any) => !e.paymentMethod || e.paymentMethod === "CASH");
  const cashExpensesTotal = cashExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
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
      const res = await startShift({
        userId,
        userName,
        initialCash: float,
        notes: openNotes,
      });

      if (!res.success) {
        setErrorMessage(res.error || "فشل فتح الوردية");
      } else {
        alert(res.message);
        onShiftUpdated(res.shift);
        onClose();
      }
    } catch (e: any) {
      setErrorMessage(e.message || "حدث خطأ أثناء فتح الوردية");
    } finally {
      setIsOpening(false);
    }
  };

  // Add Expense Item
  const handleAddExpense = () => {
    const amount = Number(expAmount);
    if (!expName.trim() || isNaN(amount) || amount <= 0) {
      alert("يرجى كتابة بند المصروف والمبلغ بشكل صحيح");
      return;
    }
    setExpenses([...expenses, { item: expName.trim(), amount }]);
    setExpName("");
    setExpAmount("");
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  // Add Withdrawal Item
  const handleAddWithdrawal = () => {
    const amount = Number(wdAmount);
    if (!wdName.trim() || isNaN(amount) || amount <= 0) {
      alert("يرجى كتابة اسم المستلم والمبلغ بشكل صحيح");
      return;
    }
    setWithdrawals([...withdrawals, { item: wdName.trim(), amount }]);
    setWdName("");
    setWdAmount("");
  };

  const handleRemoveWithdrawal = (index: number) => {
    setWithdrawals(withdrawals.filter((_, i) => i !== index));
  };

  // Handle Ending Shift & Print Z-Report
  const handleEndShift = async () => {
    if (!currentShift) return;

    if (actualCashInput === "") {
      setErrorMessage("يرجى إدخال المبلغ الفعلي المعدود باليد في الدرج");
      return;
    }

    const payload: EndShiftPayload = {
      shiftId: currentShift.id,
      actualCash,
      visaAmount,
      otherBalance,
      managementChecks,
      receivedBy: receivedBy.trim() || "الإدارة",
      notes: closeNotes,
      expenses,
      withdrawals,
    };

    setIsClosing(true);
    setErrorMessage(null);

    try {
      const res = await endShift(payload);

      if (!res.success) {
        setErrorMessage(res.error || "فشل تقفيل الوردية");
      } else {
        // Trigger Thermal Z-Report Print
        const shiftData = res.shift;
        const zReportHtml = buildZReportHtml({
          shiftNumber: shiftData.shiftNumber,
          startTime: new Date(shiftData.startTime),
          endTime: new Date(shiftData.endTime || Date.now()),
          cashierName: (shiftData as any).userName || (shiftData as any).user?.name || userName,
          initialCash: shiftData.initialCash,
          totalSales: (shiftData as any).totalSales || shiftData.grossSales || (shiftData as any).paidOrdersTotal || 0,
          paidOrdersTotal: (shiftData as any).paidOrdersTotal || shiftData.grossSales || 0,
          paidOrdersCount: (shiftData as any).paidOrdersCount || 0,
          cashSales: ((shiftData as any).paidOrdersTotal || shiftData.grossSales || 0) - visaAmount - otherBalance,
          visaSales: visaAmount,
          otherSales: otherBalance,
          cashExpensesTotal,
          expensesList: expenses,
          withdrawalsTotal: totalWithdrawals,
          withdrawalsList: withdrawals,
          expectedCash,
          actualCash,
          shortageOverage,
          receivedBy: payload.receivedBy,
          notes: payload.notes,
        });

        try {
          await silentPrintHtml(zReportHtml);
        } catch (printErr) {
          console.warn("Silent Z-report printing failed, falling back:", printErr);
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto font-sans" dir="rtl">
      <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-3xl w-full max-w-2xl p-6 shadow-2xl text-[#1F2937] my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9E0E7]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F0F4F8] border border-[#D9E2EC] flex items-center justify-center text-xl text-[#243B53]">
              💼
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1F2937]">
                {isShiftOpen ? `تقفيل الوردية والخزينة (#${currentShift.shiftNumber})` : "فتح وردية جديدة (تسليم العهدة)"}
              </h2>
              <p className="text-xs text-[#5B6472]">
                مشويات بسيوني — نظام الإدارة المالية وإغلاق اليوم
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#5B6472] hover:text-[#1F2937] flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-[#B42318] text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CASE 1: NO OPEN SHIFT -> START SHIFT FORM */}
        {!isShiftOpen ? (
          <div className="space-y-4 py-4">
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 text-xs text-[#946200]">
              <p className="font-bold mb-1">تنبيه بدء العمل:</p>
              <p className="text-[#5B6472]">
                لا توجد وردية مفتوحة حالياً للكاشير ({userName}). يرجى استلام العهدة النقدية للدرج وتأكيد فتح الوردية للبدء في إصدار الفواتير.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1.5">
                العهدة الافتتاحية بالدرج (ج.م) *
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="500"
                className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-[#1F2937] font-mono text-base font-bold outline-none focus:border-[#243B53]"
              />
              <p className="text-[11px] text-[#5B6472] mt-1">
                المبلغ النقدي المسلم كفكة في الدرج في بداية الوردية.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1.5">
                ملاحظات الاستلام (اختياري)
              </label>
              <textarea
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="مثال: استلام الدرج سليم مع فكة 500 جنيه..."
                rows={2}
                className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl p-3 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={handleStartShift}
                disabled={isOpening}
                className="flex-1 bg-[#237A57] hover:bg-[#1D6447] text-white font-black py-3 rounded-xl text-sm transition shadow-md active:scale-[0.99]"
              >
                {isOpening ? "جاري فتح الوردية..." : "✓ فتح الوردية وبدء العمل"}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#5B6472] rounded-xl text-xs font-bold transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          /* CASE 2: SHIFT OPEN -> DETAILED CLOSING RECONCILIATION */
          <div className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-1">
            
            {/* Live Shift Stats Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F4F6F8] border border-[#D9E0E7] rounded-2xl p-3 text-center">
              <div>
                <p className="text-[10px] text-[#5B6472]">العهدة الافتتاحية</p>
                <p className="font-mono font-black text-[#946200] text-sm">{initialCash.toFixed(2)} ج.م</p>
              </div>
              <div>
                <p className="text-[10px] text-[#5B6472]">إجمالي المبيعات</p>
                <p className="font-mono font-black text-[#237A57] text-sm">{paidSales.toFixed(2)} ج.م</p>
              </div>
              <div>
                <p className="text-[10px] text-[#5B6472]">الطلبات المكتملة</p>
                <p className="font-mono font-black text-[#243B53] text-sm">{currentShift?.paidOrdersCount || 0} طلب</p>
              </div>
              <div>
                <p className="text-[10px] text-[#5B6472]">المتوقع بالدرج</p>
                <p className="font-mono font-black text-[#1F2937] text-sm">{expectedCash.toFixed(2)} ج.م</p>
              </div>
            </div>

            {/* Step 1: Counted Actual Cash */}
            <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-2xl p-4 shadow-sm">
              <label className="block text-xs font-black text-[#243B53] mb-1.5 flex items-center justify-between">
                <span>1. العد الفعلي للنقدية بالدرج (Actual Cash) *</span>
                <span className="text-[10px] text-[#5B6472]">جرد الكاش الفعلي باليد</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                placeholder="أدخل إجمالي الفلوس الموجودة في الدرج..."
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-[#1F2937] font-mono text-lg font-black outline-none focus:border-[#243B53]"
              />

              {/* Shortage / Overage Live Indicator */}
              {actualCashInput !== "" && (
                <div
                  className={`mt-2.5 p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    shortageOverage === 0
                      ? "bg-[#EBF7F0] border-[#A7F3D0] text-[#237A57]"
                      : shortageOverage < 0
                      ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#B42318]"
                      : "bg-[#F0F7FA] border-[#BAE6FD] text-[#0369A1]"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FFFFFF] border border-[#D9E0E7] rounded-2xl p-4 shadow-sm">
              <div>
                <label className="block text-[11px] font-bold text-[#1F2937] mb-1">
                  💳 مبيعات شبكة / فيزا (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  value={visaAmountInput}
                  onChange={(e) => setVisaAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#1F2937] font-mono text-xs outline-none focus:border-[#243B53]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1F2937] mb-1">
                  📑 شيكات أو رصيد آجل (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  value={managementChecksInput}
                  onChange={(e) => setManagementChecksInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#1F2937] font-mono text-xs outline-none focus:border-[#243B53]"
                />
              </div>
            </div>

            {/* Step 3: Expenses and Emergency Purchases */}
            <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#B42318]">
                  🛒 المصروفات والنثريات من الدرج (إجمالي: {totalExpenses.toFixed(2)} ج.م)
                </span>
              </div>

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  placeholder="بند المصروف (مثال: بصل، خضار، نظافة...)"
                  className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] outline-none focus:border-[#243B53]"
                />
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="المبلغ ج.م"
                  className="w-24 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] font-mono outline-none focus:border-[#243B53]"
                />
                <button
                  type="button"
                  onClick={handleAddExpense}
                  className="px-3 py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] text-[#B42318] text-xs font-bold rounded-xl transition"
                >
                  + إضافة
                </button>
              </div>

              {expenses.length > 0 && (
                <div className="space-y-1.5 mt-2 max-h-24 overflow-y-auto">
                  {expenses.map((exp, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-[#F8FAFC] px-3 py-1.5 rounded-lg text-xs border border-[#E2E8F0]"
                    >
                      <span className="text-[#1F2937]">{exp.item}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#B42318] font-bold">-{exp.amount.toFixed(2)} ج.م</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExpense(i)}
                          className="text-[#94A3B8] hover:text-[#B42318] text-xs"
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
            <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#946200]">
                  🏛️ مسحوبات الإدارة من الدرج (إجمالي: {totalWithdrawals.toFixed(2)} ج.م)
                </span>
              </div>

              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={wdName}
                  onChange={(e) => setWdName(e.target.value)}
                  placeholder="اسم المستلم بالإدارة أو سبب السحب..."
                  className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] outline-none focus:border-[#243B53]"
                />
                <input
                  type="number"
                  value={wdAmount}
                  onChange={(e) => setWdAmount(e.target.value)}
                  placeholder="المبلغ ج.م"
                  className="w-24 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] font-mono outline-none focus:border-[#243B53]"
                />
                <button
                  type="button"
                  onClick={handleAddWithdrawal}
                  className="px-3 py-1.5 bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FDE68A] text-[#946200] text-xs font-bold rounded-xl transition"
                >
                  + إضافة
                </button>
              </div>

              {withdrawals.length > 0 && (
                <div className="space-y-1.5 mt-2 max-h-24 overflow-y-auto">
                  {withdrawals.map((wd, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-[#F8FAFC] px-3 py-1.5 rounded-lg text-xs border border-[#E2E8F0]"
                    >
                      <span className="text-[#1F2937]">{wd.item}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#946200] font-bold">-{wd.amount.toFixed(2)} ج.م</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveWithdrawal(i)}
                          className="text-[#94A3B8] hover:text-[#946200] text-xs"
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
            <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base text-[#3B82A0]">🛵</span>
                  <h4 className="text-xs font-black text-[#243B53]">عهدة الدليفري والطيارين بالوردية</h4>
                </div>
                <span className="text-[10px] text-[#5B6472]">تسويات النقدية خارج الدرج</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-[#EBF7F0] p-2.5 rounded-xl border border-[#A7F3D0]">
                  <p className="text-[10px] text-[#237A57]">نقدية وردها الطيارون للدرج</p>
                  <p className="font-mono font-black text-[#237A57] text-sm mt-0.5">
                    +{(currentShift?.riderRemittancesTotal || 0).toFixed(2)} ج.م
                  </p>
                </div>
                <div className="bg-[#FFFBEB] p-2.5 rounded-xl border border-[#FDE68A]">
                  <p className="text-[10px] text-[#946200]">مبالغ لا تزال معلقة مع الطيارين</p>
                  <p className="font-mono font-black text-[#946200] text-sm mt-0.5">
                    {(currentShift?.riderPendingDebtTotal || 0).toFixed(2)} ج.م
                  </p>
                </div>
              </div>

              {/* Rider breakdown if any debts */}
              {currentShift?.riderDebtsBreakdown && currentShift.riderDebtsBreakdown.length > 0 && (
                <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#D9E0E7] space-y-1">
                  <p className="text-[10px] font-bold text-[#946200] mb-1">تفاصيل العهد المعلقة على كل طيار:</p>
                  {currentShift.riderDebtsBreakdown.map((r: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-[#E2E8F0] last:border-0">
                      <span className="text-[#1F2937]">{r.riderName}</span>
                      <span className="font-mono font-bold text-[#946200]">{r.pendingDebt.toFixed(2)} ج.م معلق</span>
                    </div>
                  ))}
                  <p className="text-[9px] text-[#5B6472] pt-1">
                    ⚠️ تنبيه: المبالغ المعلقة أعلاه لم تدخل درج الكاشير بعد، وتظل مسجلة كعهدة تشغيلية على الطيار حتى يتم توريدها.
                  </p>
                </div>
              )}
            </div>

            {/* Step 6: Receiver name & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2937] mb-1">
                  اسم مستلم الخزينة (المشرف / الإدارة)
                </label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="مثال: أ / بسيوني أو مشرف الوردية"
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2937] mb-1">
                  ملاحظات تقفيل الوردية
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="أي ملاحظات خاصة بالتقفيل..."
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
                />
              </div>
            </div>

            {/* Actions: End Shift & Print Z-Report */}
            {!canCloseShift && (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-2.5 text-center text-xs text-[#946200] font-bold">
                ⚠️ تقفيل واعتماد الوردية نهائياً متاح فقط لمدير المطعم أو الأدمن. كاشير الوردية يمكنه مراجعة الأرقام فقط ولا يملك صلاحية الإغلاق.
              </div>
            )}
            <div className="flex gap-3 pt-3 border-t border-[#D9E0E7]">
              <button
                onClick={handleEndShift}
                disabled={isClosing || !canCloseShift}
                className={`flex-1 font-black py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2 ${
                  canCloseShift
                    ? "bg-[#237A57] hover:bg-[#1D6447] text-white active:scale-[0.99]"
                    : "bg-[#E2E8F0] text-[#94A3B8] cursor-not-allowed border border-[#CBD5E1]"
                }`}
              >
                <span>🖨️</span>
                <span>{isClosing ? "جاري التقفيل والطباعة..." : canCloseShift ? "تقفيل الوردية وطباعة تقرير Z-Report" : "مغلق (يتطلب صلاحية مدير)"}</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#5B6472] rounded-xl text-xs font-bold transition"
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
