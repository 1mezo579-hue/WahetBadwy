"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exportToCsv } from "@/utils/export-csv";
import { refundOrDeleteOrder } from "@/actions/reports";
import { voidExpense, importExpensesBatch, recordExpense } from "@/actions/expenses";
import { triggerSilentThermalPrint } from "@/utils/printer/silent-print";

interface ReportsViewProps {
  data: any;
}

export default function ReportsView({ data }: ReportsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    | "SALES"
    | "CHANNELS"
    | "ITEMS"
    | "PROFIT"
    | "INVENTORY"
    | "ORDERS"
    | "SHIFTS"
    | "EXPENSES"
    | "COMPLIMENTARY"
    | "AUDIT"
    | "STAFF"
  >("SALES");

  // Filters State
  const initialFrom = data.filters?.from || "";
  const initialTo = data.filters?.to || "";
  const initialChannel = data.filters?.channel || "ALL";
  const initialStatus = data.filters?.status || "ALL";

  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [channelFilter, setChannelFilter] = useState(initialChannel);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  // Orders local search
  const [orderSearch, setOrderSearch] = useState("");

  // Refund Modal State
  const [refundingOrder, setRefundingOrder] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Shift Details Modal
  const [selectedShift, setSelectedShift] = useState<any | null>(null);
  // Expense Filter & Management States
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseShiftFilter, setExpenseShiftFilter] = useState("ALL");
  const [expensePayFilter, setExpensePayFilter] = useState("ALL");
  const [expenseCatFilter, setExpenseCatFilter] = useState("ALL");
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<"ALL" | "ACTIVE" | "VOIDED">("ALL");

  // Expense Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Expense Void Modal State
  const [voidingExpense, setVoidingExpense] = useState<any | null>(null);
  const [voidExpenseReason, setVoidExpenseReason] = useState("");
  const [isVoidingExpense, setIsVoidingExpense] = useState(false);

  // Manual Add Expense Modal State
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [newExpAmount, setNewExpAmount] = useState("");
  const [newExpItem, setNewExpItem] = useState("");
  const [newExpCategory, setNewExpCategory] = useState("");
  const [newExpPayMethod, setNewExpPayMethod] = useState<"CASH" | "VISA" | "TRANSFER">("CASH");
  const [newExpReceiver, setNewExpReceiver] = useState("");
  const [newExpNotes, setNewExpNotes] = useState("");
  const [isAddingExp, setIsAddingExp] = useState(false);

  // CSV Import Helpers
  const handleParseAndImportCsv = async () => {
    if (!importCsvText.trim()) {
      setImportStatusMessage("يرجى إدخال أو لصق بيانات CSV أولاً.");
      return;
    }
    setIsImporting(true);
    setImportStatusMessage(null);
    try {
      const lines = importCsvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        setImportStatusMessage("الملف فارغ!");
        setIsImporting(false);
        return;
      }

      // Check if line 0 is a header
      let startIdx = 0;
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes("بند") || firstLine.includes("مبلغ") || firstLine.includes("item") || firstLine.includes("amount")) {
        startIdx = 1;
      }

      const rows: any[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map(p => p.trim().replace(/^["']|["']$/g, ""));
        if (parts.length >= 2) {
          // Format: item, amount, paymentMethod, categoryName, receiver, notes
          const item = parts[0] || "مصروف عام";
          const amount = parseFloat(parts[1]) || 0;
          const pay = parts[2] || "CASH";
          const cat = parts[3] || "";
          const receiver = parts[4] || "";
          const notes = parts[5] || "";

          if (amount > 0) {
            rows.push({
              item,
              amount,
              paymentMethod: pay,
              categoryName: cat,
              receiver,
              notes,
            });
          }
        }
      }

      if (rows.length === 0) {
        setImportStatusMessage("لم يتم العثور على أسطر صالحة للاستيراد. تأكد من الصيغة: البند,المبلغ,طريقة الدفع");
        setIsImporting(false);
        return;
      }

      const res = await importExpensesBatch(rows);
      if (res.success) {
        setFeedback({ type: "success", text: res.message || `تم استيراد ${res.importedCount} مصروف بنجاح!` });
        setIsImportModalOpen(false);
        setImportCsvText("");
        router.refresh();
      } else {
        setImportStatusMessage("فشل الاستيراد: " + (res.error || "خطأ غير معروف"));
      }
    } catch (e: any) {
      setImportStatusMessage("خطأ في معالجة الملف: " + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const templateContent = "\uFEFFالبند,المبلغ,طريقة الدفع,التصنيف,المستلم,ملاحظات\nلحوم بلدي ضاني,1500,CASH,المشتريات الغذائية ومواد الشواء,مورد اللحوم,طلب كباب وكفتة\nورق بكر حراري 80مم,450,VISA,التعبئة والتغليف والتسليم,شركة الورق,طباعة بونات\nمنظفات وصابون صالة,200,CASH,النظافة والصيانة والمستهلكات,مسؤول النظافة,مستهلكات يومية\n";
    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "نموذج_استيراد_مصروفات_مشويات_بسيوني.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Void Expense Handler
  const handleConfirmVoidExpense = async () => {
    if (!voidingExpense) return;
    setIsVoidingExpense(true);
    try {
      const res = await voidExpense(voidingExpense.id, voidExpenseReason);
      if (res.success) {
        setFeedback({ type: "success", text: res.message || "تم إلغاء المصروف بنجاح." });
        setVoidingExpense(null);
        setVoidExpenseReason("");
        router.refresh();
      } else {
        setFeedback({ type: "error", text: res.error || "فشل إلغاء المصروف." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: "حدث خطأ: " + err.message });
    } finally {
      setIsVoidingExpense(false);
    }
  };

  // Add Manual Expense Handler
  const handleCreateManualExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newExpAmount);
    if (!amt || amt <= 0 || !newExpItem.trim()) {
      alert("يرجى إدخال بند المصروف والمبلغ بشكل صحيح.");
      return;
    }
    setIsAddingExp(true);
    try {
      const res = await recordExpense({
        amount: amt,
        item: newExpItem.trim(),
        categoryName: newExpCategory.trim() || "مصروفات عامة",
        paymentMethod: newExpPayMethod,
        receiver: newExpReceiver.trim(),
        notes: newExpNotes.trim(),
      });
      if (res.success) {
        setFeedback({ type: "success", text: res.message || "تم تسجيل المصروف بنجاح." });
        setIsAddExpenseOpen(false);
        setNewExpAmount("");
        setNewExpItem("");
        setNewExpCategory("");
        setNewExpReceiver("");
        setNewExpNotes("");
        router.refresh();
      } else {
        alert("فشل تسجيل المصروف: " + res.error);
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setIsAddingExp(false);
    }
  };


  // Apply Filters to URL
  const handleApplyFilters = () => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (channelFilter !== "ALL") params.set("channel", channelFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      router.push(`/dashboard/reports?${params.toString()}`);
    });
  };

  // Quick Preset Filters
  const handlePresetFilter = (preset: "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "ALL") => {
    const now = new Date();
    let f = "";
    let t = now.toISOString().split("T")[0];

    if (preset === "TODAY") {
      f = t;
    } else if (preset === "YESTERDAY") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      f = y.toISOString().split("T")[0];
      t = f;
    } else if (preset === "THIS_WEEK") {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      f = w.toISOString().split("T")[0];
    } else if (preset === "THIS_MONTH") {
      const m = new Date();
      m.setDate(1);
      f = m.toISOString().split("T")[0];
    } else if (preset === "ALL") {
      f = "";
      t = "";
    }

    setFromDate(f);
    setToDate(t);

    startTransition(() => {
      const params = new URLSearchParams();
      if (f) params.set("from", f);
      if (t) params.set("to", t);
      if (channelFilter !== "ALL") params.set("channel", channelFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      router.push(`/dashboard/reports?${params.toString()}`);
    });
  };

  // Refund / Delete Order
  const handleConfirmRefund = async () => {
    if (!refundingOrder) return;
    setIsRefunding(true);
    setFeedback(null);
    try {
      const res = await refundOrDeleteOrder(refundingOrder.id, refundReason);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text: res.message || "تم حذف الفاتورة كمرتجع واستعادة رصيد المواد الخام بنجاح.",
        });
        setRefundingOrder(null);
        setRefundReason("");
        router.refresh();
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "فشلت عملية المرتجع" });
    } finally {
      setIsRefunding(false);
    }
  };

  // Thermal Reprint Helper
  const handleReprintOrder = (order: any) => {
    triggerSilentThermalPrint({
      title: "إعادة طباعة فاتورة (REPRINT)",
      receiptType: "RECEIPT",
      tableName: order.tableName,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      customerName: order.customerName !== "-" ? order.customerName : undefined,
      customerPhone: order.customerPhone !== "-" ? order.customerPhone : undefined,
      deliveryFee: order.deliveryFee || 0,
      items: [
        {
          nameAr: order.itemsSummary || "أصناف الطلب",
          quantity: order.itemsCount || 1,
          price: order.totalAmount,
        },
      ],
      subtotal: order.subtotal,
      discount: order.discount || 0,
      totalAmount: order.totalAmount,
      isComplimentary: order.isComplimentary,
      timestamp: new Date(order.createdAt),
      cashierName: order.cashierName,
      isPaid: order.status === "PAID",
      notes: "إعادة طباعة رسمية من سجل التقارير",
    });
  };

  // Destructure Data Blocks
  const sales = data.salesSummary || {
    totalSales: 0,
    totalPaidOrders: 0,
    allOrdersCount: 0,
    averageOrderValue: 0,
    totalDiscounts: 0,
    totalDeliveryFees: 0,
    dailyBreakdown: [],
  };
  const channels = data.channelBreakdown || {};
  const itemsPerf = data.itemsPerformance || { all: [], top10: [], least10: [] };
  const profits = data.profitReport || {
    items: [],
    totalRevenueFromCostedItems: 0,
    totalEstimatedFoodCost: 0,
    totalEstimatedGrossProfit: 0,
    overallEstimatedMarginPercent: 0,
    unrecordedCostItemsCount: 0,
  };
  const inventory = data.inventoryReport || { items: [], totalInventoryValue: 0, lowStockAlerts: [] };
  const expenses = data.expensesReport || { expenses: [], totalRecordedExpenses: 0 };
  const shifts = data.shiftsReport || [];
  const orders = data.ordersReport || { orders: [], totalOrders: 0, paidCount: 0, openCount: 0 };
  const complimentary = data.complimentaryReport || { orders: [], totalWaived: 0, count: 0 };
  const auditLogs = data.auditReport?.logs || [];
  const staff = data.staffReport || [];
  const grilling = data.grillingReport || {
    totalGrillingRevenue: 0,
    normalFoodSales: sales.totalSales,
    totalCustomerMeatWeightGrams: 0,
    totalCustomerMeatWeightKg: 0,
    totalCustomerOrdersCount: 0,
    paidCustomerOrdersCount: 0,
    averageGrillingFee: 0,
    orders: [],
  };

  // Filtered orders for table search
  const filteredOrdersList = orders.orders.filter((o: any) => {
    if (!orderSearch.trim()) return true;
    const q = orderSearch.toLowerCase().trim();
    return (
      String(o.orderNumber).includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q) ||
      o.tableName?.toLowerCase().includes(q) ||
      o.cashierName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-950 to-orange-950 text-white p-6 rounded-3xl border border-stone-800 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center text-3xl font-black shadow-inner">
            📊
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">
                منظومة التقارير المالية والإحصائية
              </h1>
              <span className="text-xs font-mono font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2.5 py-0.5 rounded-full">
                مشويات بسيوني
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              متابعة دقيقة للمبيعات، القنوات، تكلفة الوجبات، الأرباح، النواقص، الخزينة، وسجل التدقيق الإداري.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold transition flex items-center gap-2 shadow-sm"
          >
            <span>🖨️</span>
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar & Presets */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 print:hidden">
        {/* Preset Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 ml-2">فترات سريعة:</span>
            {[
              { id: "TODAY", label: "اليوم" },
              { id: "YESTERDAY", label: "أمس" },
              { id: "THIS_WEEK", label: "آخر 7 أيام" },
              { id: "THIS_MONTH", label: "هذا الشهر" },
              { id: "ALL", label: "جميع الفترات" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetFilter(p.id as any)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-orange-50 hover:text-orange-700 text-slate-700 transition"
              >
                {p.label}
              </button>
            ))}
          </div>

          {isPending && (
            <div className="flex items-center gap-2 text-xs font-bold text-orange-600 animate-pulse">
              <span>⏳</span>
              <span>جاري تحديث البيانات...</span>
            </div>
          )}
        </div>

        {/* Date Inputs & Channel Select */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">من تاريخ</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">قناة البيع</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
            >
              <option value="ALL">جميع القنوات</option>
              <option value="TAKEAWAY">تيك أواي (سفري)</option>
              <option value="DELIVERY">دليفري (توصيل)</option>
              <option value="DINE_IN">صالة داخلي</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">حالة الطلب</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="PAID">مدفوع ومحصل (PAID)</option>
              <option value="OPEN">مفتوح / جاري (OPEN)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleApplyFilters}
              disabled={isPending}
              className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/20"
            >
              <span>🔍</span>
              <span>تطبيق</span>
            </button>
            <button
              onClick={() => handlePresetFilter("ALL")}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
              title="إعادة ضبط الفلاتر"
            >
              ↺
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold border print:hidden ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.type === "success" ? "✅" : "⚠️"}</span>
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* 3. Navigation Tabs (The 10 Required Reports) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-none print:hidden">
        {[
          { id: "SALES", label: "المبيعات والإيرادات", icon: "📈", count: sales.totalPaidOrders },
          { id: "CHANNELS", label: "القنوات (سفري/دليفري/صالة)", icon: "🛵" },
          { id: "ITEMS", label: "أداء الأصناف", icon: "🍖", count: itemsPerf.all.length },
          { id: "PROFIT", label: "التكاليف وهامش الربح", icon: "💰" },
          { id: "INVENTORY", label: "المخزون والنواقص", icon: "📦", count: inventory.lowStockAlerts.length },
          { id: "ORDERS", label: "سجل الفواتير والطلبات", icon: "🧾", count: orders.totalOrders },
          { id: "SHIFTS", label: "الخزنة والورديات", icon: "💵", count: shifts.length },
          { id: "EXPENSES", label: "المصروفات والسحوبات", icon: "💸", count: expenses.expenses.length },
          { id: "COMPLIMENTARY", label: "الضيافة والـ VIP", icon: "👑", count: complimentary.count },
          { id: "AUDIT", label: "سجل التدقيق والأمان", icon: "🛡️", count: auditLogs.length },
          { id: "STAFF", label: "الموظفين وساعات العمل", icon: "👥", count: staff.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/30"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SALES & REVENUE REPORT */}
      {/* ======================================================== */}
      {activeTab === "SALES" && (
        <div className="space-y-6">
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">إجمالي المبيعات المحصلة</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">
                {sales.totalSales.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
              </div>
              <p className="text-[11px] text-slate-400">إجمالي الطلبات المدفوعة في الفترة المحددة</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">عدد الطلبات المكتملة</span>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {sales.totalPaidOrders} <span className="text-xs font-bold text-slate-500">طلب</span>
              </div>
              <p className="text-[11px] text-slate-400">من إجمالي {sales.allOrdersCount} طلب مسجل</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">متوسط قيمة الطلب (AOV)</span>
              <div className="text-2xl font-black text-orange-600 font-mono">
                {sales.averageOrderValue.toFixed(2)} <span className="text-xs font-bold">ج.م</span>
              </div>
              <p className="text-[11px] text-slate-400">معدل إنفاق العميل في الطلب الواحد</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">إجمالي الخصومات الممنوحة</span>
              <div className="text-2xl font-black text-rose-600 font-mono">
                {sales.totalDiscounts.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
              </div>
              <p className="text-[11px] text-slate-400">خصومات ترويجية وخفض أسعار</p>
            </div>
          </div>

          {/* Daily Sales Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">تفاصيل المبيعات اليومية</h3>
                <p className="text-xs text-slate-500 mt-0.5">توزيع الإيراد وعدد الشيكات يوماً بيوم</p>
              </div>
              <button
                onClick={() =>
                  exportToCsv(
                    "تقرير_المبيعات_اليومية_مشويات_بسيوني",
                    ["التاريخ", "عدد الطلبات", "إجمالي الإيراد (ج.م)", "إجمالي الخصومات", "متوسط الفاتورة"],
                    sales.dailyBreakdown.map((d: any) => [
                      d.date,
                      d.count,
                      d.revenue,
                      d.discounts,
                      d.count > 0 ? (d.revenue / d.count).toFixed(2) : 0,
                    ])
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>تصدير Excel (CSV)</span>
              </button>
            </div>

            {sales.dailyBreakdown.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <span className="text-4xl block">📈</span>
                <p className="text-sm font-bold text-slate-700">لا توجد عمليات بيع مسجلة في هذه الفترة</p>
                <p className="text-xs text-slate-400">
                  النظام مهيأ وجاهز. ستظهر المبيعات فور تحصيل أول فاتورة في الوردية.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">التاريخ</th>
                      <th className="p-3.5">عدد الطلبات</th>
                      <th className="p-3.5">إجمالي الإيراد</th>
                      <th className="p-3.5">إجمالي الخصم</th>
                      <th className="p-3.5">متوسط الفاتورة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {sales.dailyBreakdown.map((row: any) => (
                      <tr key={row.date} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-bold text-slate-800">{row.date}</td>
                        <td className="p-3.5 font-mono text-slate-700">{row.count} طلب</td>
                        <td className="p-3.5 font-mono font-black text-emerald-700">
                          {row.revenue.toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 font-mono text-rose-600">{row.discounts.toLocaleString()} ج.م</td>
                        <td className="p-3.5 font-mono text-orange-600">
                          {row.count > 0 ? (row.revenue / row.count).toFixed(2) : 0} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CHANNELS BREAKDOWN (Takeaway / Delivery / Dine-in) */}
      {/* ======================================================== */}
      {activeTab === "CHANNELS" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Takeaway */}
            <div className="bg-white p-6 rounded-3xl border-2 border-orange-200 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-3xl">🥡</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800">
                  سفري (تيك أواي)
                </span>
              </div>
              <div className="text-3xl font-black text-slate-800 font-mono">
                {channels.TAKEAWAY?.revenue?.toLocaleString() || 0} <span className="text-xs font-bold">ج.م</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span>عدد الطلبات: <b>{channels.TAKEAWAY?.count || 0}</b></span>
                <span>الحصة: <b>{(channels.TAKEAWAY?.percentage || 0).toFixed(1)}%</b></span>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-3xl">🛵</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                  توصيل (دليفري)
                </span>
              </div>
              <div className="text-3xl font-black text-slate-800 font-mono">
                {channels.DELIVERY?.revenue?.toLocaleString() || 0} <span className="text-xs font-bold">ج.م</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span>عدد الطلبات: <b>{channels.DELIVERY?.count || 0}</b></span>
                <span>الحصة: <b>{(channels.DELIVERY?.percentage || 0).toFixed(1)}%</b></span>
              </div>
              <div className="text-[11px] text-blue-700 bg-blue-50 p-2 rounded-xl">
                رسوم التوصيل المحصلة: <b>{(channels.DELIVERY?.deliveryFees || 0).toLocaleString()} ج.م</b>
              </div>
            </div>

            {/* Dine-In */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-3xl">🪑</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  صالة داخلي
                </span>
              </div>
              <div className="text-3xl font-black text-slate-800 font-mono">
                {channels.DINE_IN?.revenue?.toLocaleString() || 0} <span className="text-xs font-bold">ج.م</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span>عدد الطلبات: <b>{channels.DINE_IN?.count || 0}</b></span>
                <span>الحصة: <b>{(channels.DINE_IN?.percentage || 0).toFixed(1)}%</b></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ITEMS PERFORMANCE */}
      {/* ======================================================== */}
      {activeTab === "ITEMS" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">تقرير أداء وحركة مبيعات الأصناف</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  الكميات المباعة والإيراد المالي مرتبة تنازلياً من الأكثر مبيعاً
                </p>
              </div>
              <button
                onClick={() =>
                  exportToCsv(
                    "تقرير_حركة_الاصناف_مشويات_بسيوني",
                    ["اسم الصنف", "القسم", "سعر البيع", "الكمية المباعة", "إجمالي الإيراد"],
                    itemsPerf.all.map((item: any) => [
                      item.nameAr,
                      item.categoryNameAr,
                      item.price,
                      item.quantitySold,
                      item.totalRevenue,
                    ])
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>تصدير Excel (CSV)</span>
              </button>
            </div>

            {itemsPerf.all.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <span className="text-4xl block">🍖</span>
                <p className="text-sm font-bold text-slate-700">لا توجد مبيعات أصناف في الفترة المحددة</p>
                <p className="text-xs text-slate-400">ستظهر الأصناف فور تنفيذ أول طلب كاشير.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">اسم الصنف</th>
                      <th className="p-3.5">القسم</th>
                      <th className="p-3.5">سعر الوحدة</th>
                      <th className="p-3.5">الكمية المباعة</th>
                      <th className="p-3.5">إجمالي الإيراد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {itemsPerf.all.map((it: any, idx: number) => (
                      <tr key={it.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3.5 font-bold text-slate-800">{it.nameAr}</td>
                        <td className="p-3.5 text-slate-600">{it.categoryNameAr}</td>
                        <td className="p-3.5 font-mono">{it.price} ج.م</td>
                        <td className="p-3.5 font-mono font-bold text-orange-600">{it.quantitySold}</td>
                        <td className="p-3.5 font-mono font-black text-emerald-700">
                          {it.totalRevenue.toLocaleString()} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PROFIT & MARGINS REPORT */}
      {/* ======================================================== */}
      {activeTab === "PROFIT" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">إيرادات الأصناف المحددة التكلفة</span>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {profits.totalRevenueFromCostedItems.toLocaleString()} <span className="text-xs">ج.م</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">تكلفة المواد الخام التقديرية (Food Cost)</span>
              <div className="text-2xl font-black text-amber-700 font-mono">
                {profits.totalEstimatedFoodCost.toLocaleString()} <span className="text-xs">ج.م</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">إجمالي الربح التقديري (Gross Profit)</span>
              <div className="text-2xl font-black text-emerald-600 font-mono">
                {profits.totalEstimatedGrossProfit.toLocaleString()} <span className="text-xs">ج.م</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-bold">
                هامش الربح: {profits.overallEstimatedMarginPercent.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Warning Banner for Unrecorded Costs */}
          {profits.unrecordedCostItemsCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚠️</span>
                <span>
                  يوجد <b>{profits.unrecordedCostItemsCount}</b> صنف مباع لم يتم تسجيل وصفة المكونات وتكاليف المواد الخام
                  له بعد. لم يتم احتساب أرباح تقديرية وهمية لها حفاظاً على دقة البيانات المالية.
                </span>
              </div>
              <a
                href="/dashboard/menu"
                className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-xl transition shrink-0"
              >
                تحديد وصفات المنيو
              </a>
            </div>
          )}

          {/* Cost & Margin Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">تفاصيل تكلفة الأصناف وهوامش الربح</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مقارنة سعر البيع بتكلفة المواد الخام الفعلية المحسوبة من وصفة التحضير
                </p>
              </div>
              <button
                onClick={() =>
                  exportToCsv(
                    "تقرير_الارباح_والتكاليف_مشويات_بسيوني",
                    ["اسم الصنف", "سعر البيع", "تكلفة المكونات", "هامش الربح للوحدة", "نسبة الهامش", "إجمالي الربح"],
                    profits.items.map((it: any) => [
                      it.nameAr,
                      it.price,
                      it.hasCostData ? it.unitCost.toFixed(2) : "غير محددة",
                      it.hasCostData ? it.unitMargin.toFixed(2) : "غير محددة",
                      it.hasCostData ? `${it.marginPercent.toFixed(1)}%` : "-",
                      it.hasCostData ? it.totalProfit.toFixed(2) : "-",
                    ])
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>تصدير Excel (CSV)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">الصنف</th>
                    <th className="p-3.5">سعر البيع</th>
                    <th className="p-3.5">تكلفة المكونات</th>
                    <th className="p-3.5">هامش الوحدة</th>
                    <th className="p-3.5">نسبة الهامش</th>
                    <th className="p-3.5">الكمية المباعة</th>
                    <th className="p-3.5">إجمالي الربح التقديري</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {profits.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        لا توجد أصناف مباعة في الفترة المحددة.
                      </td>
                    </tr>
                  ) : (
                    profits.items.map((it: any) => (
                      <tr key={it.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-bold text-slate-800">{it.nameAr}</td>
                        <td className="p-3.5 font-mono">{it.price} ج.م</td>
                        <td className="p-3.5 font-mono">
                          {it.hasCostData ? (
                            <span className="text-amber-700 font-bold">{it.unitCost.toFixed(2)} ج.م</span>
                          ) : (
                            <span className="text-slate-400 italic">غير محددة</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono">
                          {it.hasCostData ? (
                            <span className="text-emerald-700 font-bold">{it.unitMargin.toFixed(2)} ج.م</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono">
                          {it.hasCostData ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold">
                              {it.marginPercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono">{it.quantitySold}</td>
                        <td className="p-3.5 font-mono font-black text-emerald-700">
                          {it.hasCostData ? `${it.totalProfit.toLocaleString()} ج.م` : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: INVENTORY & STOCK */}
      {/* ======================================================== */}
      {activeTab === "INVENTORY" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">القيمة الإجمالية للمخزون الحالي</span>
              <div className="text-2xl font-black text-slate-800 font-mono">
                {inventory.totalInventoryValue.toLocaleString()} <span className="text-xs">ج.م</span>
              </div>
              <p className="text-[11px] text-slate-400">إجمالي الأرصدة المتوفرة × تكلفة الوحدة</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500">تنبيهات النواقص (تحت حد الأمان)</span>
              <div className="text-2xl font-black text-rose-600 font-mono">
                {inventory.lowStockAlerts.length} <span className="text-xs">خامات</span>
              </div>
              <p className="text-[11px] text-slate-400">مواد خام تحتاج إلى إعادة طلب فوري</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">أرصدة الخامات والمخازن</h3>
                <p className="text-xs text-slate-500 mt-0.5">متابعة دقيقة للأرصدة الفعلية وحدود إعادة الطلب</p>
              </div>
              <button
                onClick={() =>
                  exportToCsv(
                    "تقرير_المخزون_مشويات_بسيوني",
                    ["اسم المادة الخام", "الوحدة", "الرصيد الحالي", "حد إعادة الطلب", "تكلفة الوحدة", "القيمة الإجمالية"],
                    inventory.items.map((i: any) => [
                      i.name,
                      i.unit,
                      i.currentStock,
                      i.minStockLevel,
                      i.costPerUnit,
                      i.totalValue,
                    ])
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>تصدير Excel (CSV)</span>
              </button>
            </div>

            {inventory.items.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <span className="text-4xl block">📦</span>
                <p className="text-sm font-bold text-slate-700">لا توجد مواد خام مسجلة في المخزن حالياً</p>
                <p className="text-xs text-slate-400">
                  يمكنك إضافة الخامات من صفحة: لوحة التحكم &gt; المشتريات والمواد الخام.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">اسم الخامة</th>
                      <th className="p-3.5">الوحدة</th>
                      <th className="p-3.5">الرصيد الحالي</th>
                      <th className="p-3.5">حد الأمان</th>
                      <th className="p-3.5">تكلفة الوحدة</th>
                      <th className="p-3.5">القيمة الإجمالية</th>
                      <th className="p-3.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {inventory.items.map((i: any) => (
                      <tr key={i.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-bold text-slate-800">{i.name}</td>
                        <td className="p-3.5 text-slate-600">{i.unit}</td>
                        <td className="p-3.5 font-mono font-bold text-slate-800">{i.currentStock}</td>
                        <td className="p-3.5 font-mono text-slate-500">{i.minStockLevel}</td>
                        <td className="p-3.5 font-mono">{i.costPerUnit} ج.م</td>
                        <td className="p-3.5 font-mono font-black text-slate-900">{i.totalValue.toLocaleString()} ج.م</td>
                        <td className="p-3.5">
                          {i.isLow ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                              ⚠️ ناقص (إعادة طلب)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              ✓ متوفر
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: ORDERS & INVOICES LOG */}
      {/* ======================================================== */}
      {activeTab === "ORDERS" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="بحث برقم الشيك، العميل، الطاولة، أو الكاشير..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
                />
              </div>

              <button
                onClick={() =>
                  exportToCsv(
                    "سجل_فواتير_مشويات_بسيوني",
                    ["رقم الشيك", "القناة", "الموقع/العميل", "الكاشير", "الحالة", "المبلغ الإجمالي", "التاريخ والوقت"],
                    filteredOrdersList.map((o: any) => [
                      `#${o.orderNumber}`,
                      o.orderType,
                      o.tableName || o.customerName,
                      o.cashierName,
                      o.status,
                      o.totalAmount,
                      new Date(o.createdAt).toLocaleString("ar-EG"),
                    ])
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>📥</span>
                <span>تصدير Excel (CSV)</span>
              </button>
            </div>

            {filteredOrdersList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <span className="text-4xl block">🧾</span>
                <p className="text-sm font-bold text-slate-700">لا توجد فواتير مطابقة لبحثك في الفترة المحددة</p>
                <p className="text-xs text-slate-400">ستظهر الفواتير هنا فور تحصيلها من شاشة الكاشير.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">رقم الشيك</th>
                      <th className="p-3.5">القناة</th>
                      <th className="p-3.5">الموقع / العميل</th>
                      <th className="p-3.5">الأصناف</th>
                      <th className="p-3.5">الكاشير</th>
                      <th className="p-3.5">الإجمالي</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5">التاريخ والوقت</th>
                      <th className="p-3.5 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredOrdersList.map((o: any) => (
                      <tr key={o.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-mono font-black text-slate-900">#{o.orderNumber}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              o.orderType === "TAKEAWAY"
                                ? "bg-orange-100 text-orange-800"
                                : o.orderType === "DELIVERY"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {o.orderType === "TAKEAWAY" ? "سفري" : o.orderType === "DELIVERY" ? "دليفري" : "صالة"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800">{o.tableName}</div>
                          {o.customerPhone !== "-" && (
                            <div className="text-[10px] text-slate-400 font-mono">{o.customerPhone}</div>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600 max-w-xs truncate" title={o.itemsSummary}>
                          {o.itemsSummary}
                        </td>
                        <td className="p-3.5 text-slate-700">{o.cashierName}</td>
                        <td className="p-3.5 font-mono font-black text-emerald-700">
                          {o.totalAmount.toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5">
                          {o.status === "PAID" ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              مدفوع
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              مفتوح
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-500">
                          {new Date(o.createdAt).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleReprintOrder(o)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-orange-700 transition"
                              title="إعادة طباعة حرارية"
                            >
                              🖨️
                            </button>
                            <button
                              onClick={() => setRefundingOrder(o)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                              title="حذف كمرتجع واستعادة المخزون"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: SHIFTS & CASH DRAWER */}
      {/* ======================================================== */}
      {activeTab === "SHIFTS" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">سجل تسليم وتقفيل الورديات</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مطابقة النقدية، المصروفات، مدفوعات الفيزا، وتدقيق العجز والزيادة
                </p>
              </div>
              <button
                onClick={() =>
                  exportToCsv(
                    "سجل_تقفيل_الورديات_مشويات_بسيوني",
                    ["الوردية", "الكاشير", "الحالة", "العهدة الافتتاحية", "المبيعات", "المصروفات", "المتوقع", "الفعلي", "العجز/الزيادة"],
                    shifts.map((s: any) => [
                      `#${s.shiftNumber}`,
                      s.cashierName,
                      s.status,
                      s.initialCash,
                      s.grossSales,
                      s.expensesTotal,
                      s.expectedCash,
                      s.actualCash ?? "-",
                      s.shortageOverage,
                    ])
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>تصدير Excel (CSV)</span>
              </button>
            </div>

            {shifts.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <span className="text-4xl block">💵</span>
                <p className="text-sm font-bold text-slate-700">لا توجد ورديات مسجلة في الفترة المحددة</p>
                <p className="text-xs text-slate-400">ستظهر الوردية فور فتحها من شاشة الكاشير.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">الوردية</th>
                      <th className="p-3.5">الكاشير</th>
                      <th className="p-3.5">وقت الفتح</th>
                      <th className="p-3.5">العهدة</th>
                      <th className="p-3.5">المبيعات</th>
                      <th className="p-3.5">الفيزا</th>
                      <th className="p-3.5">المصروفات</th>
                      <th className="p-3.5">المتوقع في الدرج</th>
                      <th className="p-3.5">الفعلي المحصي</th>
                      <th className="p-3.5">العجز / الزيادة</th>
                      <th className="p-3.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {shifts.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-mono font-black text-slate-900">#{s.shiftNumber}</td>
                        <td className="p-3.5 font-bold text-slate-800">{s.cashierName}</td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-500">
                          {new Date(s.startTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-3.5 font-mono text-slate-700">{s.initialCash} ج.م</td>
                        <td className="p-3.5 font-mono font-bold text-emerald-700">{s.grossSales.toLocaleString()} ج.م</td>
                        <td className="p-3.5 font-mono text-blue-700">{s.visaAmount.toLocaleString()} ج.م</td>
                        <td className="p-3.5 font-mono text-rose-600">{s.expensesTotal.toLocaleString()} ج.م</td>
                        <td className="p-3.5 font-mono font-bold text-slate-900">
                          {s.expectedCash.toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 font-mono font-bold text-slate-800">
                          {s.actualCash !== null ? `${s.actualCash.toLocaleString()} ج.م` : "-"}
                        </td>
                        <td className="p-3.5 font-mono font-bold">
                          {s.status === "CLOSED" ? (
                            s.shortageOverage < 0 ? (
                              <span className="text-rose-600">عجز: {s.shortageOverage} ج.م</span>
                            ) : s.shortageOverage > 0 ? (
                              <span className="text-emerald-600">زيادة: +{s.shortageOverage} ج.م</span>
                            ) : (
                              <span className="text-slate-600">مطابق تماماً</span>
                            )
                          ) : (
                            <span className="text-slate-400">وردية جارية</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {s.status === "CLOSED" ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold">
                              مقفلة
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold animate-pulse">
                              مفتوحة الآن
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 8: EXPENSES & CASH DRAWER OUTFLOWS */}
      {/* ======================================================== */}
      {activeTab === "EXPENSES" && (() => {
        // Compute local filtered list
        const filteredExpenses = (expenses.expenses || []).filter((e: any) => {
          // Search query
          if (expenseSearch.trim()) {
            const q = expenseSearch.toLowerCase();
            const matchItem = (e.item || "").toLowerCase().includes(q);
            const matchCat = (e.category || "").toLowerCase().includes(q);
            const matchResp = (e.cashierName || e.responsible || "").toLowerCase().includes(q);
            const matchRec = (e.receiver || "").toLowerCase().includes(q);
            const matchNotes = (e.notes || "").toLowerCase().includes(q);
            if (!matchItem && !matchCat && !matchResp && !matchRec && !matchNotes) return false;
          }
          // Shift filter
          if (expenseShiftFilter !== "ALL") {
            const shiftStr = String(e.shiftNumber || "");
            if (!shiftStr.includes(expenseShiftFilter.replace("#", ""))) return false;
          }
          // Payment method filter
          if (expensePayFilter !== "ALL") {
            if (expensePayFilter === "CASH" && !e.paymentMethod?.includes("نقدي")) return false;
            if (expensePayFilter === "VISA" && !e.paymentMethod?.includes("فيزا")) return false;
            if (expensePayFilter === "TRANSFER" && !e.paymentMethod?.includes("تحويل")) return false;
          }
          // Category filter
          if (expenseCatFilter !== "ALL") {
            if ((e.category || "") !== expenseCatFilter) return false;
          }
          // Status filter
          if (expenseStatusFilter === "ACTIVE" && e.isVoided) return false;
          if (expenseStatusFilter === "VOIDED" && !e.isVoided) return false;

          return true;
        });

        const activeCount = filteredExpenses.filter((e: any) => !e.isVoided).length;
        const activeTotal = filteredExpenses.filter((e: any) => !e.isVoided).reduce((sum: number, e: any) => sum + e.amount, 0);
        const cashTotal = filteredExpenses.filter((e: any) => !e.isVoided && e.paymentMethod?.includes("نقدي")).reduce((sum: number, e: any) => sum + e.amount, 0);
        const electronicTotal = activeTotal - cashTotal;
        const voidedCount = filteredExpenses.filter((e: any) => e.isVoided).length;

        // Distinct shifts from shifts report for dropdown
        const availableShifts = Array.from(new Set((data.shiftsReport || []).map((s: any) => "#" + s.shiftNumber)));

        return (
          <div className="space-y-6 animate-fade-in">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500">إجمالي المصروفات (الفترة المحددة)</span>
                <div className="text-2xl font-black text-rose-600 font-mono">
                  {activeTotal.toLocaleString()} <span className="text-xs">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400">{activeCount} إذن صرف نشط وموثق</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500">نقدية من الدرج (كاش)</span>
                <div className="text-2xl font-black text-amber-600 font-mono">
                  {cashTotal.toLocaleString()} <span className="text-xs">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400">تخصم فوراً من الرصيد المتوقع لدرج الخزنة</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500">إلكتروني (فيزا / تحويل بنكي)</span>
                <div className="text-2xl font-black text-blue-600 font-mono">
                  {electronicTotal.toLocaleString()} <span className="text-xs">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400">لا تؤثر على نقدية الدرج المادية</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500">سجل الملغيات والتدقيق</span>
                <div className="text-2xl font-black text-slate-600 font-mono">
                  {voidedCount} <span className="text-xs">ملغي</span>
                </div>
                <p className="text-[11px] text-slate-400">إذونات صرف تم إلغاؤها واستعادة أرصدتها</p>
              </div>
            </div>

            {/* Filter and Control Bar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="flex-1 relative">
                  <span className="absolute right-3.5 top-2.5 text-slate-400 text-sm">🔍</span>
                  <input
                    type="text"
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    placeholder="بحث في المصروفات بالبيان، المستلم، أو المسؤول..."
                    className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  {expenseSearch && (
                    <button
                      onClick={() => setExpenseSearch("")}
                      className="absolute left-3 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Action Buttons: Export, Import, Add */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setIsAddExpenseOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-orange-600/20"
                  >
                    <span>➕</span>
                    <span>تسجيل مصروف</span>
                  </button>

                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>📤</span>
                    <span>استيراد Excel / CSV</span>
                  </button>

                  <button
                    onClick={() =>
                      exportToCsv(
                        "سجل_مصروفات_مشويات_بسيوني",
                        ["التاريخ", "الوردية", "المسؤول", "بند المصروف", "طريقة الدفع", "المبلغ (ج.م)", "المستلم", "ملاحظات", "الحالة"],
                        filteredExpenses.map((e: any) => [
                          e.date,
                          e.shiftNumber || "-",
                          e.cashierName || e.responsible || "الإدارة",
                          e.category ? `${e.item} (${e.category})` : e.item,
                          e.paymentMethod || "نقدي",
                          e.amount,
                          e.receiver || "-",
                          e.notes || "-",
                          e.isVoided ? `ملغي: ${e.voidReason || ""}` : "معتمد",
                        ])
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>📥</span>
                    <span>تصدير Excel (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Sub-Filters: Shift, Payment, Category, Status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs">
                {/* Shift Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">فلترة بالوردية:</label>
                  <select
                    value={expenseShiftFilter}
                    onChange={(e) => setExpenseShiftFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                  >
                    <option value="ALL">كل الورديات</option>
                    {availableShifts.map((s: any, idx: number) => (
                      <option key={idx} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">طريقة الدفع:</label>
                  <select
                    value={expensePayFilter}
                    onChange={(e) => setExpensePayFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                  >
                    <option value="ALL">كل الطرق</option>
                    <option value="CASH">نقدي (درج الكاشير)</option>
                    <option value="VISA">فيزا / كارت إلكتروني</option>
                    <option value="TRANSFER">تحويل بنكي / محفظة</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">بند وتصنيف المصروف:</label>
                  <select
                    value={expenseCatFilter}
                    onChange={(e) => setExpenseCatFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                  >
                    <option value="ALL">كل التصنيفات</option>
                    {(expenses.categoriesCatalog || []).map((cat: any) => (
                      <option key={cat.id} value={cat.nameAr}>{cat.nameAr}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">حالة المصروف التدقيقية:</label>
                  <select
                    value={expenseStatusFilter}
                    onChange={(e) => setExpenseStatusFilter(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                  >
                    <option value="ALL">الكل (معتمد + ملغي)</option>
                    <option value="ACTIVE">النشط والمعتمد فقط</option>
                    <option value="VOIDED">الملغي فقط</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Top Expense Categories Breakdown */}
            {expenses.topCategories && expenses.topCategories.length > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-slate-700">أعلى بنود المصروفات تكلفة في الفترة:</h4>
                <div className="flex flex-wrap gap-2">
                  {expenses.topCategories.map((c: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                      <span className="font-bold text-slate-800">{c.name}:</span>
                      <span className="font-mono font-black text-rose-600">{c.total.toLocaleString()} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses Ledger Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-800">بيان المصروفات النثرية والخامات</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إجمالي النتائج المعروضة: <b>{filteredExpenses.length}</b> مصروف
                  </p>
                </div>
              </div>

              {filteredExpenses.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <span className="text-4xl block">💸</span>
                  <p className="text-sm font-bold text-slate-700">لا توجد مصروفات تطابق خيارات الفلترة المحددة</p>
                  <p className="text-xs text-slate-400">
                    يمكنك تغيير خيارات الفلترة، أو تسجيل مصروف جديد عبر عمو بسيوني أو زر «تسجيل مصروف» بالأعلى!
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">الحالة</th>
                        <th className="p-3.5">التاريخ</th>
                        <th className="p-3.5">الوردية</th>
                        <th className="p-3.5">المسؤول</th>
                        <th className="p-3.5">بند المصروف / التصنيف</th>
                        <th className="p-3.5">طريقة الدفع</th>
                        <th className="p-3.5">المبلغ</th>
                        <th className="p-3.5">المستلم</th>
                        <th className="p-3.5">ملاحظات</th>
                        <th className="p-3.5 text-center">إجراءات المراجعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredExpenses.map((e: any, idx: number) => (
                        <tr key={idx} className={`hover:bg-slate-50/60 transition ${e.isVoided ? "bg-rose-50/30 opacity-70" : ""}`}>
                          <td className="p-3.5">
                            {e.isVoided ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                ملغي ✕
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                معتمد ✓
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-slate-800">{e.date}</td>
                          <td className="p-3.5 font-mono text-slate-700">{e.shiftNumber || "-"}</td>
                          <td className="p-3.5 text-slate-700">{e.cashierName || e.responsible || "الإدارة"}</td>
                          <td className="p-3.5">
                            <span className={`font-bold block ${e.isVoided ? "line-through text-slate-400" : "text-slate-800"}`}>
                              {e.item}
                            </span>
                            {e.category && (
                              <span className="text-[10px] text-slate-500 font-normal">📁 {e.category}</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                e.paymentMethod?.includes("فيزا")
                                  ? "bg-blue-100 text-blue-700"
                                  : e.paymentMethod?.includes("تحويل")
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {e.paymentMethod || "نقدي"}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono font-black text-rose-600">
                            <span className={e.isVoided ? "line-through text-slate-400" : ""}>
                              {e.amount.toLocaleString()} ج.م
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">{e.receiver || "-"}</td>
                          <td className="p-3.5 text-slate-500">
                            {e.isVoided && e.voidReason ? (
                              <span className="text-rose-600 font-bold block text-[11px]">
                                سبب الإلغاء: {e.voidReason}
                              </span>
                            ) : (
                              e.notes || "-"
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {!e.isVoided ? (
                              <button
                                onClick={() => setVoidingExpense(e)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition"
                                title="إلغاء هذا المصروف واستعادة الرصيد"
                              >
                                إلغاء المصروف
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">ملغي ومسجل</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Expense Categories Directory (دليل بنود المصروفات المعتمد) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-800">دليل بنود المصروفات المعتمد (10 مجموعات)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">الدليل المنظم الذي يتعرف عليه عمو بسيوني ذكياً بالمحادثة</p>
                </div>
                <span className="text-xs bg-orange-100 text-orange-800 font-bold px-3 py-1 rounded-full border border-orange-200">
                  {(expenses.categoriesCatalog || []).length} بند نشط ومتاح
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(expenses.categoriesCatalog || []).map((cat: any) => (
                  <div key={cat.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-800">{cat.nameAr}</div>
                      <div className="text-[10px] text-slate-500">{cat.groupAr}</div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${cat.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                      {cat.active ? "مفعل" : "معطل"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* TAB 9: COMPLIMENTARY & VIP ORDERS */}
      {/* ======================================================== */}
      {activeTab === "COMPLIMENTARY" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm max-w-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-500">إجمالي قيمة طلبات الضيافة المعفاة</span>
            <div className="text-2xl font-black text-purple-700 font-mono">
              {complimentary.totalWaived.toLocaleString()} <span className="text-xs">ج.م</span>
            </div>
            <p className="text-[11px] text-slate-400">معفاة 100% بإذن الإدارة ولا تدخل في نقدية الدرج</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">سجل طلبات الضيافة والـ VIP</h3>
              <p className="text-xs text-slate-500 mt-0.5">توثيق كامل للطلبات المعفاة لضمان الشفافية والرقابة</p>
            </div>

            {complimentary.orders.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <span className="text-4xl block">👑</span>
                <p className="text-sm font-bold text-slate-700">لا توجد طلبات ضيافة مسجلة في هذه الفترة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">رقم الشيك</th>
                      <th className="p-3.5">الموقع</th>
                      <th className="p-3.5">المسؤول</th>
                      <th className="p-3.5">الأصناف</th>
                      <th className="p-3.5">القيمة المعفاة</th>
                      <th className="p-3.5">التاريخ والوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {complimentary.orders.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-mono font-black text-slate-900">#{c.orderNumber}</td>
                        <td className="p-3.5 font-bold text-purple-900">{c.tableName}</td>
                        <td className="p-3.5 text-slate-700">{c.responsible}</td>
                        <td className="p-3.5 text-slate-600">{c.items}</td>
                        <td className="p-3.5 font-mono font-bold text-purple-700">{c.subtotal.toLocaleString()} ج.م</td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-500">
                          {new Date(c.createdAt).toLocaleString("ar-EG")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 10: SECURITY AUDIT LOG */}
      {/* ======================================================== */}
      {activeTab === "AUDIT" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">سجل التدقيق والأمان الإداري الدائم</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  توثيق دقيق لكافة العمليات الحساسة (قفل النظام، الخروج الإجباري، المرتجعات، تصفير البيانات)
                </p>
              </div>
              <button
                onClick={() =>
                  exportToCsv(
                    "سجل_التدقيق_الامني_مشويات_بسيوني",
                    ["الحدث", "المنفّذ", "التاريخ والوقت", "التفاصيل"],
                    auditLogs.map((l: any) => [l.actionAr || l.action, l.performedBy || l.userName, l.timestamp, l.details])
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>تصدير Excel (CSV)</span>
              </button>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <span className="text-4xl block">🛡️</span>
                <p className="text-sm font-bold text-slate-700">لا توجد أحداث أمنية مسجلة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">العملية / الإجراء</th>
                      <th className="p-3.5">المنفّذ</th>
                      <th className="p-3.5">التاريخ والوقت</th>
                      <th className="p-3.5">التفاصيل التوضيحية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-bold text-slate-800">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.action === "LOCK_SYSTEM"
                                ? "bg-rose-100 text-rose-800"
                                : log.action === "UNLOCK_SYSTEM"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.action === "FORCE_LOGOUT_ALL"
                                ? "bg-amber-100 text-amber-800"
                                : log.action === "REFUND_ORDER"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {log.actionAr || log.action}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700 font-bold">{log.performedBy || log.userName}</td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                        <td className="p-3.5 text-slate-600">{log.details || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 11: STAFF & ATTENDANCE */}
      {/* ======================================================== */}
      {activeTab === "STAFF" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800">كشف ساعات العمل والرواتب لطاقم العمل</h3>
                <p className="text-xs text-slate-500 mt-0.5">متابعة عدد ساعات الحضور وتكاليف الأجور التقديرية</p>
              </div>
              <button
                onClick={() =>
                  exportToCsv(
                    "سجل_حضور_ورواتب_الموظفين_مشويات_بسيوني",
                    ["الاسم", "الوظيفة", "الهاتف", "ساعات العمل", "الأجر بالساعة", "الراتب الشهري", "التكلفة التقديرية"],
                    staff.map((st: any) => [
                      st.name,
                      st.role,
                      st.phone,
                      st.totalHoursWorked,
                      st.hourlyRate,
                      st.monthlySalary,
                      st.estimatedWages,
                    ])
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>تصدير Excel (CSV)</span>
              </button>
            </div>

            {staff.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <span className="text-4xl block">👥</span>
                <p className="text-sm font-bold text-slate-700">لا يوجد موظفون مسجلون حالياً</p>
                <p className="text-xs text-slate-400">
                  يمكنك إضافة طاقم العمل من صفحة: لوحة التحكم &gt; الموظفين والورديات.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">الاسم</th>
                      <th className="p-3.5">المسمى الوظيفي</th>
                      <th className="p-3.5">الهاتف</th>
                      <th className="p-3.5">إجمالي الساعات</th>
                      <th className="p-3.5">سعر الساعة</th>
                      <th className="p-3.5">الراتب الشهري</th>
                      <th className="p-3.5">الأجر المستحق (ساعات)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {staff.map((st: any) => (
                      <tr key={st.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-bold text-slate-800">{st.name}</td>
                        <td className="p-3.5 text-slate-600">{st.role}</td>
                        <td className="p-3.5 font-mono text-slate-500">{st.phone}</td>
                        <td className="p-3.5 font-mono font-bold text-orange-600">{st.totalHoursWorked} ساعة</td>
                        <td className="p-3.5 font-mono">{st.hourlyRate} ج.م</td>
                        <td className="p-3.5 font-mono text-slate-700">{st.monthlySalary.toLocaleString()} ج.م</td>
                        <td className="p-3.5 font-mono font-black text-emerald-700">
                          {st.estimatedWages.toLocaleString()} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* EXCEL / CSV IMPORT MODAL */}
      {/* ======================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-emerald-800 flex items-center gap-2">
                <span>📤</span>
                <span>استيراد مصروفات من ملف Excel / CSV</span>
              </h3>
              <button
                onClick={() => { setIsImportModalOpen(false); setImportStatusMessage(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <p className="font-bold">تعليمات الاستيراد السريع:</p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                يمكنك رفع ملف CSV أو لصق محتواه مباشرة أدناه. يجب أن يحتوي كل سطر على:
                <br />
                <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-emerald-900">
                  البند, المبلغ, طريقة الدفع, التصنيف, المستلم, ملاحظات
                </code>
              </p>
              <button
                onClick={handleDownloadCsvTemplate}
                className="text-xs font-bold text-emerald-700 underline hover:text-emerald-900 flex items-center gap-1"
              >
                <span>📥 تحميل نموذج Excel (CSV) التجريبي المعتمد</span>
              </button>
            </div>

            {/* File Upload & Textarea */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رفع ملف CSV من الجهاز:</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const txt = evt.target?.result as string;
                        if (txt) setImportCsvText(txt);
                      };
                      reader.readAsText(file, "utf-8");
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-0 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">أو الصق نص البيانات هنا:</label>
                <textarea
                  value={importCsvText}
                  onChange={(e) => setImportCsvText(e.target.value)}
                  rows={5}
                  placeholder="لحوم بلدي ضاني, 1500, CASH, المشتريات الغذائية, مورد اللحوم, كباب وكفتة&#10;منظفات صالة, 250, CASH, النظافة, مسؤول النظافة, صابون ومعقم"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
            </div>

            {importStatusMessage && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
                {importStatusMessage}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleParseAndImportCsv}
                disabled={isImporting || !importCsvText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs transition shadow-md shadow-emerald-600/20"
              >
                {isImporting ? "جاري معالجة واستيراد البيانات..." : "بدء استيراد المصروفات الآن"}
              </button>
              <button
                onClick={() => { setIsImportModalOpen(false); setImportStatusMessage(null); }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VOID EXPENSE MODAL */}
      {/* ======================================================== */}
      {voidingExpense && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-rose-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>إلغاء إذن صرف مصروف</span>
              </h3>
              <button
                onClick={() => setVoidingExpense(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
              <div>بند المصروف: <b>{voidingExpense.item}</b></div>
              <div>المبلغ: <b>{voidingExpense.amount} ج.م</b></div>
              <div>طريقة الدفع: <b>{voidingExpense.paymentMethod || "نقدي"}</b></div>
              <div>الوردية: <b>{voidingExpense.shiftNumber || "عام"}</b></div>
              <p className="pt-2 text-[11px] text-rose-700 leading-relaxed">
                إذا كان المصروف مسجلاً كنقدي من الوردية الحالية المفتوحة، فسيتم تلقائياً استرجاع القيمة إلى رصيد الدرج المتوقع وتحديث دفاتر الوردية وتوثيق العملية في سجل الأمان.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سبب الإلغاء (اختياري):</label>
              <input
                type="text"
                value={voidExpenseReason}
                onChange={(e) => setVoidExpenseReason(e.target.value)}
                placeholder="مثال: تسجيل مكرر، أو خطأ في قيمة المبلغ..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleConfirmVoidExpense}
                disabled={isVoidingExpense}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs transition shadow-md shadow-rose-600/20"
              >
                {isVoidingExpense ? "جاري الإلغاء..." : "تأكيد إلغاء المصروف واستعادة الرصيد"}
              </button>
              <button
                onClick={() => setVoidingExpense(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK RECORD EXPENSE MODAL */}
      {/* ======================================================== */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>➕</span>
                <span>تسجيل مصروف جديد</span>
              </h3>
              <button
                onClick={() => setIsAddExpenseOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">البيان / تفاصيل المصروف *</label>
                <input
                  type="text"
                  required
                  value={newExpItem}
                  onChange={(e) => setNewExpItem(e.target.value)}
                  placeholder="مثال: فحم مشويات درجة أولى، أو منظفات صالة..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">المبلغ (ج.م) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={newExpAmount}
                    onChange={(e) => setNewExpAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">طريقة السداد *</label>
                  <select
                    value={newExpPayMethod}
                    onChange={(e) => setNewExpPayMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                  >
                    <option value="CASH">نقدي (درج الكاشير)</option>
                    <option value="VISA">فيزا / بطاقة</option>
                    <option value="TRANSFER">تحويل بنكي / محفظة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">التصنيف من دليل البنود:</label>
                <select
                  value={newExpCategory}
                  onChange={(e) => setNewExpCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                >
                  <option value="">-- اختار التصنيف --</option>
                  {(expenses.categoriesCatalog || []).map((c: any) => (
                    <option key={c.id} value={c.nameAr}>{c.nameAr} ({c.groupAr})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">المستلم (الجهة / الشخص):</label>
                  <input
                    type="text"
                    value={newExpReceiver}
                    onChange={(e) => setNewExpReceiver(e.target.value)}
                    placeholder="مثال: مورد اللحوم"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات إضافية:</label>
                  <input
                    type="text"
                    value={newExpNotes}
                    onChange={(e) => setNewExpNotes(e.target.value)}
                    placeholder="اختياري..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isAddingExp}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black text-xs transition shadow-md shadow-orange-600/20"
                >
                  {isAddingExp ? "جاري الحفظ..." : "حفظ واعتماد المصروف"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* REFUND / DELETE ORDER MODAL */}
      {/* ======================================================== */}
      {refundingOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-rose-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>حذف الفاتورة كمرتجع واستعادة المخزون</span>
              </h3>
              <button
                onClick={() => setRefundingOrder(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
              <div>
                رقم الفاتورة: <b>#{refundingOrder.orderNumber}</b>
              </div>
              <div>
                المبلغ الإجمالي: <b>{refundingOrder.totalAmount} ج.م</b>
              </div>
              <div>
                الموقع / الطاولة: <b>{refundingOrder.tableName}</b>
              </div>
              <p className="pt-2 text-[11px] text-rose-700">
                سيتم حذف الفاتورة نهائياً واسترجاع كميات المواد الخام تلقائياً إلى رصيد المخزن، وتوثيق العملية في سجل
                التدقيق.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سبب المرتجع / الإلغاء *</label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
                placeholder="مثال: خطأ في إدخال الطلب، أو رغبة العميل في الإلغاء..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-rose-500 outline-none resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleConfirmRefund}
                disabled={isRefunding || !refundReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs transition shadow-md shadow-rose-600/20"
              >
                {isRefunding ? "جاري تنفيذ المرتجع..." : "تأكيد المرتجع واستعادة المخزون"}
              </button>
              <button
                onClick={() => setRefundingOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
