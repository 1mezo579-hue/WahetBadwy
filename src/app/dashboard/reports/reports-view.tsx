"use client";

import { useState } from "react";
import { ShiftStatus, OrderStatus, OrderType } from "@prisma/client";
import { refundOrDeleteOrder } from "@/actions/reports";
import { useRouter } from "next/navigation";
import {
  triggerSilentThermalPrint,
  silentPrintHtml,
  buildZReportHtml,
} from "@/utils/printer/silent-print";

interface ReportsViewProps {
  shifts: any[];
  allOrders?: any[];
  sales: {
    todaySales: number;
    todayOrdersCount: number;
    allTimeSales: number;
    allTimeOrdersCount: number;
    averageOrderValue: number;
    categoryBreakdown: Array<{
      id: string;
      nameAr: string;
      revenue: number;
      itemsSold: number;
    }>;
  };
  complimentaryOrders: any[];
  totalComplimentaryWaived: number;
  rawMaterials: any[];
}

function parseJsonArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

export default function ReportsView({
  shifts,
  allOrders = [],
  sales,
  complimentaryOrders,
  totalComplimentaryWaived,
  rawMaterials,
}: ReportsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "INVOICES" | "SHIFTS" | "CLOSING_SHEETS" | "SALES" | "INVENTORY" | "COMPLIMENTARY"
  >("INVOICES");

  const [shiftFilter, setShiftFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");

  // Invoices search and filters
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState<"ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY">("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"ALL" | "PAID" | "OPEN" | "CANCELLED">("ALL");

  // Re-print modal state
  const [printableOrder, setPrintableOrder] = useState<any | null>(null);

  // Bedouin Closing Sheet modal states
  const [closingVoucherShift, setClosingVoucherShift] = useState<any | null>(null);
  const [closingDetailsShift, setClosingDetailsShift] = useState<any | null>(null);

  // Refund / Delete modal state
  const [refundingOrder, setRefundingOrder] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredShifts = shifts.filter((s) => {
    if (shiftFilter === "ALL") return true;
    return s.status === shiftFilter;
  });

  const filteredOrders = allOrders.filter((order) => {
    // 1. Type filter
    if (orderTypeFilter !== "ALL" && order.type !== orderTypeFilter) return false;
    // 2. Status filter
    if (orderStatusFilter !== "ALL" && order.status !== orderStatusFilter) return false;
    // 3. Search query
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase().trim();
      const numMatch = order.orderNumber.toString().includes(q);
      const customerMatch =
        order.customer?.name?.toLowerCase().includes(q) ||
        order.customer?.phone?.includes(q);
      const tableMatch = order.table?.name?.toLowerCase().includes(q);
      const cashierMatch = order.user?.name?.toLowerCase().includes(q);
      if (!numMatch && !customerMatch && !tableMatch && !cashierMatch) return false;
    }
    return true;
  });

  const handlePrint = () => {
    if (printableOrder) {
      triggerSilentThermalPrint({
        title: "فاتورة سداد نقدي (PAID RECEIPT)",
        receiptType: "RECEIPT",
        tableName:
          printableOrder.table?.name ||
          (printableOrder.type === OrderType.TAKEAWAY ? "تيك أواي" : "دليفري"),
        orderNumber: printableOrder.orderNumber,
        orderType: printableOrder.type,
        customerName: printableOrder.customer?.name,
        customerPhone: printableOrder.customer?.phone,
        deliveryAddress: printableOrder.customer?.address || undefined,
        deliveryFee: printableOrder.deliveryFee || 0,
        items:
          printableOrder.items?.map((i: any) => ({
            nameAr: i.menuItem?.nameAr || "صنف",
            quantity: i.quantity,
            price: i.unitPrice || i.totalPrice / (i.quantity || 1),
            notes: i.notes,
          })) || [],
        subtotal: printableOrder.subtotal,
        discount: printableOrder.discount || 0,
        totalAmount: printableOrder.totalAmount,
        isComplimentary: printableOrder.isComplimentary,
        notes: printableOrder.notes,
        timestamp: new Date(printableOrder.createdAt),
        cashierName: printableOrder.user?.name || "كاشير مشويات بسيوني",
        isPaid: true,
      });
    } else {
      window.print();
    }
  };

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
          text: res.message || "تم حذف الفاتورة كمرتجع واستعادة رصيد المخزون بنجاح.",
        });
        setRefundingOrder(null);
        setRefundReason("");
        router.refresh();
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "فشلت عملية الحذف المرتجع" });
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            التقارير المالية والورديات وسجل الفواتير
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            سجل شامل لكافة الفواتير مع إمكانية إعادة الطباعة وحذف المرتجع، ومتابعة نقدية الورديات والمخزون.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-black">
            نظام نقاط البيع • مشويات بسيوني
          </span>
        </div>
      </div>

      {/* Feedback Toast Banner */}
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
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* Card 1: Today Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">مبيعات اليوم (اليومي)</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              💰
            </span>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-emerald-600">
              {sales.todaySales.toFixed(2)} ج.م
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {sales.todayOrdersCount} طلب مسدد اليوم
            </p>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي المبيعات (الكل)</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              📈
            </span>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-primary-900">
              {sales.allTimeSales.toFixed(2)} ج.م
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              متوسط الفاتورة: {sales.averageOrderValue.toFixed(2)} ج.م
            </p>
          </div>
        </div>

        {/* Card 3: Total Orders Logged */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي الفواتير المسجلة</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              🧾
            </span>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-slate-800">
              {allOrders.length} فاتورة
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              سجل كامل للفواتير النشطة والمسددة
            </p>
          </div>
        </div>

        {/* Card 4: Complimentary Waived */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي الضيافة المعفاة</span>
            <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              👑
            </span>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-purple-700">
              {totalComplimentaryWaived.toFixed(2)} ج.م
            </p>
            <p className="text-[11px] text-purple-600 font-bold mt-0.5">
              {complimentaryOrders.length} طلب طاولة مالك/مدير
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto print:hidden">
        <button
          onClick={() => setActiveTab("INVOICES")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === "INVOICES"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <span>🧾</span>
          <span>سجل الفواتير والمبيعات ({allOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("SHIFTS")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "SHIFTS"
              ? "bg-primary-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <span>⏱️</span>
          <span>سجل الورديات والتسليم ({shifts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("CLOSING_SHEETS")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === "CLOSING_SHEETS"
              ? "bg-sky-800 text-white shadow-sm ring-2 ring-sky-400"
              : "bg-white text-sky-900 hover:bg-sky-50 border border-sky-300"
          }`}
        >
          <span>📑</span>
          <span>أوراق التقفيل اليومية (مشويات بسيوني) ({shifts.filter((s) => s.status === ShiftStatus.CLOSED).length})</span>
        </button>

        <button
          onClick={() => setActiveTab("SALES")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "SALES"
              ? "bg-primary-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <span>📊</span>
          <span>المبيعات وتحليل الأقسام</span>
        </button>

        <button
          onClick={() => setActiveTab("INVENTORY")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "INVENTORY"
              ? "bg-primary-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <span>🥩</span>
          <span>استهلاك المخزون والمواد الخام ({rawMaterials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("COMPLIMENTARY")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeTab === "COMPLIMENTARY"
              ? "bg-purple-800 text-white shadow-sm"
              : "bg-white text-purple-700 hover:bg-purple-50 border border-purple-200"
          }`}
        >
          <span>👑</span>
          <span>سجل طلبات الضيافة الخاص ({complimentaryOrders.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INVOICES & ORDERS LEDGER (سجل الفواتير والعمليات) */}
      {/* ======================================================== */}
      {activeTab === "INVOICES" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 print:hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-black text-slate-800 text-base">
                سجل كافة الفواتير (إعادة طباعة • حذف كمرتجع واسترجاع المخزون)
              </h3>
              <p className="text-xs text-slate-500">
                يمكنك البحث بأي رقم فاتورة أو اسم/رقم العميل، وإعادة طباعة إيصال العميل الحراري، أو حذف أي فاتورة بالكامل كمرتجع.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="ALL">كل الأنواع</option>
                <option value="DINE_IN">صالة (طاولات)</option>
                <option value="TAKEAWAY">تيك أواي</option>
                <option value="DELIVERY">توصيل دليفري</option>
              </select>

              {/* Status Filter */}
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="ALL">كل الحالات</option>
                <option value="PAID">مسددة (PAID)</option>
                <option value="OPEN">مفتوحة (قيد الطلب)</option>
                <option value="CANCELLED">ملغية</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="🔍 ابحث برقم الفاتورة (مثلاً: 1001) أو اسم العميل، رقم الهاتف، أو اسم الطاولة..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-amber-500 focus:bg-white transition"
            />
            {invoiceSearch && (
              <button
                onClick={() => setInvoiceSearch("")}
                className="absolute left-4 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                مسح
              </button>
            )}
          </div>

          {/* Invoices Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                  <th className="py-3 px-3">رقم الفاتورة</th>
                  <th className="py-3 px-3">النوع</th>
                  <th className="py-3 px-3">الطاولة / العميل</th>
                  <th className="py-3 px-3">الأصناف والكميات</th>
                  <th className="py-3 px-3">رسوم التوصيل</th>
                  <th className="py-3 px-3">الإجمالي</th>
                  <th className="py-3 px-3">الكاشير</th>
                  <th className="py-3 px-3">الوقت والتاريخ</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      لا توجد فواتير مطابقة لخيارات البحث المحددة
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isPaid = order.status === OrderStatus.PAID;
                    const isOpen = order.status === OrderStatus.OPEN;

                    return (
                      <tr key={order.id} className="hover:bg-amber-50/20 transition">
                        {/* Order Number */}
                        <td className="py-3 px-3 font-mono font-black text-amber-900">
                          #{order.orderNumber}
                        </td>

                        {/* Order Type Badge */}
                        <td className="py-3 px-3">
                          {order.type === OrderType.DINE_IN && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                              🍽️ صالة
                            </span>
                          )}
                          {order.type === OrderType.TAKEAWAY && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              🛍️ تيك أواي
                            </span>
                          )}
                          {order.type === OrderType.DELIVERY && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              🛵 دليفري
                            </span>
                          )}
                        </td>

                        {/* Table / Customer */}
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {order.table && (
                            <span className="text-slate-900 font-black">
                              طاولة: {order.table.name}
                            </span>
                          )}
                          {order.customer && (
                            <div className="flex flex-col text-[11px]">
                              <span className="font-black text-slate-900">
                                {order.customer.name}
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">
                                {order.customer.phone}
                              </span>
                            </div>
                          )}
                          {!order.table && !order.customer && (
                            <span className="text-slate-400">طلب عام</span>
                          )}
                        </td>

                        {/* Items summary */}
                        <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={order.items?.map((i: any) => `${i.quantity}x ${i.menuItem?.nameAr || 'صنف'}`).join(" • ")}>
                          {order.items?.length > 0
                            ? order.items.map((i: any) => `${i.quantity}x ${i.menuItem?.nameAr || 'صنف'}`).join(" • ")
                            : "لا توجد أصناف"}
                        </td>

                        {/* Delivery fee */}
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {order.deliveryFee ? `${order.deliveryFee.toFixed(2)} ج.م` : "-"}
                        </td>

                        {/* Total Amount */}
                        <td className="py-3 px-3 font-mono font-black text-slate-900 text-sm">
                          {order.totalAmount.toFixed(2)} ج.م
                        </td>

                        {/* Cashier */}
                        <td className="py-3 px-3 text-slate-600 font-bold">
                          {order.user?.name || "كاشير"}
                        </td>

                        {/* Created At */}
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleString("ar-EG", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isPaid && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                              مسدد
                            </span>
                          )}
                          {isOpen && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                              مفتوح
                            </span>
                          )}
                          {!isPaid && !isOpen && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black">
                              {order.status}
                            </span>
                          )}
                        </td>

                        {/* Actions (Print & Refund/Delete) */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Re-print Button */}
                            <button
                              onClick={() => setPrintableOrder(order)}
                              title="إعادة طباعة الفاتورة للعميل"
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[11px] transition flex items-center gap-1 shadow-sm"
                            >
                              <span>🖨️</span>
                              <span>طباعة</span>
                            </button>

                            {/* Refund / Delete Order Button */}
                            <button
                              onClick={() => setRefundingOrder(order)}
                              title="حذف الفاتورة كمرتجع واستعادة رصيد المخزن"
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-[11px] transition flex items-center gap-1"
                            >
                              <span>🔄</span>
                              <span>مرتجع</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* RE-PRINT MODAL (معاينة وطباعة الفاتورة الحرارية) */}
      {/* ======================================================== */}
      {printableOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto print:p-0 print:max-w-none print:shadow-none print:rounded-none">
            {/* Header controls (hidden on print) */}
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <span>🖨️</span>
                <span>معاينة إيصال العميل الحراري</span>
              </h3>
              <button
                onClick={() => setPrintableOrder(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Thermal Receipt Visual Preview */}
            <div
              id="thermal-receipt-to-print"
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs text-slate-800 space-y-3 print:bg-white print:border-none print:p-0"
            >
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                <p className="font-black text-base text-slate-900 tracking-wider">
                  مشويات بسيوني - MASHWEYAT BASIONY
                </p>
                <p className="text-[11px] text-slate-600 font-bold">
                  مطعم مشويات ومأكولات فاخرة • إدارة أ/ أحمد بسيوني
                </p>
                <p className="text-[10px] text-slate-500">
                  خدمة العملاء والتوصيل: 01038029714
                </p>
                <p className="text-[10px] text-slate-500">
                  عبدالقادر - شارع المستعمرة أمام شارع 10 مباشرة قبل مسجد السلام
                </p>
              </div>

              {/* Order Info */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span className="font-bold">رقم الفاتورة:</span>
                  <span className="font-black">#{printableOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">التاريخ والوقت:</span>
                  <span>
                    {new Date(printableOrder.createdAt).toLocaleString("ar-EG", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">نوع الطلب:</span>
                  <span className="font-bold">
                    {printableOrder.type === OrderType.DINE_IN && "🍽️ صالة"}
                    {printableOrder.type === OrderType.TAKEAWAY && "🛍️ تيك أواي"}
                    {printableOrder.type === OrderType.DELIVERY && "🛵 دليفري"}
                  </span>
                </div>

                {printableOrder.table && (
                  <div className="flex justify-between">
                    <span className="font-bold">رقم / اسم الطاولة:</span>
                    <span className="font-black">{printableOrder.table.name}</span>
                  </div>
                )}

                {printableOrder.customer && (
                  <div className="pt-1 text-[10px] border-t border-slate-200 mt-1">
                    <p className="font-bold">العميل: {printableOrder.customer.name}</p>
                    <p>الهاتف: {printableOrder.customer.phone}</p>
                    {printableOrder.customer.address && (
                      <p>العنوان: {printableOrder.customer.address}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-1">
                  <span className="text-[10px] text-slate-500">الكاشير:</span>
                  <span className="text-[10px] font-bold text-slate-600">
                    {printableOrder.user?.name || "كاشير مشويات بسيوني"}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between font-bold text-[10px] text-slate-500 border-b pb-1">
                  <span>الصنف</span>
                  <div className="flex gap-4">
                    <span>الكمية</span>
                    <span>الإجمالي</span>
                  </div>
                </div>

                {printableOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-slate-800">
                      {item.menuItem?.nameAr || "صنف"}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="font-bold">{item.quantity}</span>
                      <span className="font-black font-mono">
                        {item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono">{printableOrder.subtotal.toFixed(2)} ج.م</span>
                </div>

                {printableOrder.deliveryFee > 0 && (
                  <div className="flex justify-between text-amber-900">
                    <span>خدمة التوصيل:</span>
                    <span className="font-mono">{printableOrder.deliveryFee.toFixed(2)} ج.م</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-300 pt-1">
                  <span>الإجمالي الصافي:</span>
                  <span className="font-mono">{printableOrder.totalAmount.toFixed(2)} ج.م</span>
                </div>

                {printableOrder.isComplimentary && (
                  <div className="text-center font-bold text-purple-700 text-[10px] bg-purple-50 p-1 rounded">
                    👑 معفى 100% (ضيافة إدارة مشويات بسيوني)
                  </div>
                )}
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-400">
                شكراً لزيارتكم • نتمنى لكم يوماً سعيداً
              </div>
            </div>

            {/* Print action buttons */}
            <div className="flex items-center gap-2 pt-2 print:hidden">
              <button
                onClick={handlePrint}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2"
              >
                <span>🖨️</span>
                <span>طباعة الإيصال فوراً</span>
              </button>
              <button
                onClick={() => setPrintableOrder(null)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* REFUND / VOID CONFIRMATION MODAL (حذف الفاتورة كمرتجع) */}
      {/* ======================================================== */}
      {refundingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-xl">
                ⚠️
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  تأكيد حذف الفاتورة كمرتجع
                </h3>
                <p className="text-xs text-slate-500">
                  فاتورة رقم #{refundingOrder.orderNumber} • بمبلغ {refundingOrder.totalAmount.toFixed(2)} ج.م
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 leading-relaxed space-y-1">
              <p className="font-black">تأثير الحذف على النظام:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                <li>سيتم حذف الفاتورة من حسابات ومبيعات اليوم.</li>
                <li>
                  <strong>استرجاع المخزون:</strong> ستتم إعادة كافة كميات المكونات الخام للأصناف إلى المخزن تلقائياً.
                </li>
                <li>إذا كانت طاولة صالة مشغولة بالطلب سيتم إتاحتها للزبائن فوراً.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سبب الارتجاع / الحذف (اختياري):
              </label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="مثال: خطأ من الزبون، إرجاع طلب، تغيير في الأصناف..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={isRefunding}
                onClick={handleConfirmRefund}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-2xl text-xs transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isRefunding ? (
                  <span>جاري الحذف واسترجاع المخزون...</span>
                ) : (
                  <>
                    <span>🔄🗑️</span>
                    <span>تأكيد الحذف كمرتجع</span>
                  </>
                )}
              </button>
              <button
                disabled={isRefunding}
                onClick={() => {
                  setRefundingOrder(null);
                  setRefundReason("");
                }}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* OFFICIAL BEDOUIN GRILL PRINTABLE CLOSING VOUCHER MODAL */}
      {/* ======================================================== */}
      {closingVoucherShift && (() => {
        const expItems = parseJsonArray(closingVoucherShift.expensesDetails);
        const withItems = parseJsonArray(closingVoucherShift.managementWithdrawalsDetails);
        const wasteItems = parseJsonArray(closingVoucherShift.staffWasteDetails);
        const shiftDate = new Date(closingVoucherShift.startTime);
        const gross = closingVoucherShift.grossSales ?? closingVoucherShift.orders?.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0) ?? 0;
        const disc = closingVoucherShift.discounts ?? 0;
        const visa = closingVoucherShift.visaAmount ?? 0;
        const otherBal = closingVoucherShift.otherBalance ?? 0;
        const exp = closingVoucherShift.expensesTotal ?? 0;
        const checks = closingVoucherShift.managementChecks ?? 0;
        const waste = closingVoucherShift.staffWasteTotal ?? 0;
        const withTotal = closingVoucherShift.managementWithdrawalsTotal ?? 0;
        const endBal = closingVoucherShift.endOfDayBalance ?? closingVoucherShift.expectedCash ?? 0;
        const shortage = closingVoucherShift.shortageOverage ?? 0;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white w-full max-w-xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto print:p-0 print:max-w-none print:shadow-none print:rounded-none">
              
              {/* Header controls (hidden on print) */}
              <div className="flex items-center justify-between border-b pb-3 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  <h3 className="font-black text-slate-800 text-sm">
                    ورقة تقفيل مشويات بسيوني • وردية #{closingVoucherShift.shiftNumber}
                  </h3>
                </div>
                <button
                  onClick={() => setClosingVoucherShift(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 text-base"
                >
                  ✕
                </button>
              </div>

              {/* Exact Paper Sheet Replica */}
              <div
                id="bedouin-closing-sheet-print"
                className="bg-white border-2 border-slate-800 p-4 sm:p-5 rounded-2xl text-right font-sans text-xs space-y-3 shadow-sm print:border-2 print:border-black print:p-3"
              >
                {/* Sky-Blue Header */}
                <div className="bg-sky-200 border-2 border-slate-800 rounded-xl p-3 text-center print:bg-sky-100">
                  <h2 className="text-2xl font-black text-slate-900 tracking-wide">
                    مشويات بسيوني
                  </h2>
                  <p className="text-sm font-black text-slate-800 tracking-widest mt-0.5">
                    مطعم وكافيه
                  </p>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 pt-1.5 border-t border-slate-400 mt-2">
                    <span>
                      إيراد يوم : <strong>{shiftDate.toLocaleDateString("ar-EG", { weekday: "long" })}</strong>
                    </span>
                    <span>
                      الموافق: <strong className="font-mono">{shiftDate.toLocaleDateString("ar-EG")}</strong>
                    </span>
                  </div>
                </div>

                {/* The 9 Official Voucher Rows with Directional Arrows */}
                <div className="space-y-1.5 font-bold text-xs sm:text-sm">
                  {/* 1. Gross Sales */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                    <span className="w-36 text-slate-900 font-black">إجمالى المبيعات</span>
                    <span className="text-sky-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-base px-3 py-1 border border-slate-800 rounded-lg bg-slate-50 min-w-[120px] text-center">
                      {gross.toFixed(2)}
                    </span>
                  </div>

                  {/* 2. Discounts */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                    <span className="w-36 text-slate-900 font-black">خصومات</span>
                    <span className="text-sky-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-base px-3 py-1 border border-slate-800 rounded-lg bg-slate-50 min-w-[120px] text-center text-rose-700">
                      {disc.toFixed(2)}
                    </span>
                  </div>

                  {/* 3. Visa */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                    <span className="w-36 text-slate-900 font-black">فيزا</span>
                    <span className="text-sky-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-base px-3 py-1 border border-slate-800 rounded-lg bg-slate-50 min-w-[120px] text-center text-blue-800">
                      {visa.toFixed(2)}
                    </span>
                  </div>

                  {/* 4. Other Balance */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                    <span className="w-36 text-slate-900 font-black">رصيد أخر</span>
                    <span className="text-sky-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-base px-3 py-1 border border-slate-800 rounded-lg bg-slate-50 min-w-[120px] text-center">
                      {otherBal.toFixed(2)}
                    </span>
                  </div>

                  {/* 5. Expenses */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                    <span className="w-36 text-slate-900 font-black">مصاريف</span>
                    <span className="text-sky-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-base px-3 py-1 border border-slate-800 rounded-lg bg-slate-50 min-w-[120px] text-center text-rose-800">
                      {exp.toFixed(2)}
                    </span>
                  </div>

                  {/* 6. Management Checks */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                    <span className="w-36 text-slate-900 font-black">شيكات إداره</span>
                    <span className="text-sky-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-base px-3 py-1 border border-slate-800 rounded-lg bg-slate-50 min-w-[120px] text-center">
                      {checks.toFixed(2)}
                    </span>
                  </div>

                  {/* 7. Staff Waste */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                    <span className="w-36 text-slate-900 font-black">توالف إصطاف</span>
                    <span className="text-sky-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-base px-3 py-1 border border-slate-800 rounded-lg bg-slate-50 min-w-[120px] text-center text-rose-700">
                      {waste.toFixed(2)}
                    </span>
                  </div>

                  {/* 8. Management Withdrawals */}
                  <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                    <span className="w-36 text-slate-900 font-black">مسحوبات اداره</span>
                    <span className="text-sky-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-base px-3 py-1 border border-slate-800 rounded-lg bg-slate-50 min-w-[120px] text-center text-purple-900">
                      {withTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* 9. End of Day Cash Balance */}
                  <div className="flex items-center justify-between pt-1.5 font-black bg-emerald-50 p-2 rounded-xl border-2 border-emerald-500">
                    <span className="w-36 text-emerald-950 font-black">رصيد أخر اليوم</span>
                    <span className="text-emerald-700 font-black text-base">←</span>
                    <span className="font-mono font-black text-lg px-3 py-1 border-2 border-emerald-900 rounded-lg bg-white min-w-[120px] text-center text-emerald-950">
                      {endBal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Receiver and Cashier Signatures */}
                <div className="flex items-center justify-between pt-2 border-t-2 border-slate-800 text-xs">
                  <div>
                    المستلم / <strong className="text-slate-900 mr-1 text-sm">{closingVoucherShift.receivedBy || "—"}</strong>
                  </div>
                  <div className="text-slate-600 font-bold">
                    الكاشير: <strong className="text-slate-900">{closingVoucherShift.user?.name || "كاشير"}</strong>
                  </div>
                </div>

                {/* Actual Counted & Shortage */}
                <div className="flex items-center justify-between pt-1.5 text-[11px] font-mono text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span>الفعلي بعد الجرد: {(closingVoucherShift.actualCash ?? 0).toFixed(2)} ج.م</span>
                  <span className={shortage < 0 ? "text-rose-600 font-black" : "text-emerald-700 font-black"}>
                    الفارق: {shortage > 0 ? "+" : ""}{shortage.toFixed(2)} ج.م
                  </span>
                </div>

                {/* Attached Details Tables on Print */}
                {(expItems.length > 0 || withItems.length > 0 || wasteItems.length > 0) && (
                  <div className="space-y-2 pt-2 border-t border-dashed border-slate-400 text-[11px]">
                    {expItems.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-black text-slate-800">🛒 بيان بنود المصاريف المنصرفة:</p>
                        <div className="space-y-0.5">
                          {expItems.map((e: any, idx: number) => (
                            <div key={idx} className="flex justify-between bg-slate-50 p-1 rounded font-mono">
                              <span>• {e.item} {e.notes ? `(${e.notes})` : ""}</span>
                              <span className="font-black text-rose-700">{Number(e.amount).toFixed(2)} ج.م</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {withItems.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-200">
                        <p className="font-black text-purple-900">💼 بيان مسحوبات الإدارة:</p>
                        <div className="space-y-0.5">
                          {withItems.map((w: any, idx: number) => (
                            <div key={idx} className="flex justify-between bg-purple-50/50 p-1 rounded font-mono">
                              <span>• {w.receiver} {w.notes ? `(${w.notes})` : ""}</span>
                              <span className="font-black text-purple-900">{Number(w.amount).toFixed(2)} ج.م</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {wasteItems.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-slate-200">
                        <p className="font-black text-rose-800">⚠️ بيان توالف الإصطاف:</p>
                        <div className="space-y-0.5">
                          {wasteItems.map((s: any, idx: number) => (
                            <div key={idx} className="flex justify-between bg-rose-50/50 p-1 rounded font-mono">
                              <span>• {s.item} {s.responsible ? `(المسؤول: ${s.responsible})` : ""}</span>
                              <span className="font-black text-rose-800">{Number(s.amount).toFixed(2)} ج.م</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons (hidden on print) */}
              <div className="flex items-center gap-2 pt-2 print:hidden">
                <button
                  onClick={() => {
                    silentPrintHtml(
                      buildZReportHtml(
                        {
                          stats: {
                            receivedBy: closingVoucherShift.receivedBy,
                            initialCash: closingVoucherShift.initialCash,
                            paidOrdersTotal:
                              closingVoucherShift.grossSales ??
                              closingVoucherShift.paidOrdersTotal ??
                              0,
                            paidOrdersCount: closingVoucherShift.paidOrdersCount ?? 0,
                            expensesTotal: closingVoucherShift.expensesTotal ?? 0,
                            managementWithdrawalsTotal:
                              closingVoucherShift.managementWithdrawalsTotal ?? 0,
                            endOfDayBalance:
                              closingVoucherShift.endOfDayBalance ??
                              closingVoucherShift.expectedCash ??
                              0,
                            expectedCash: closingVoucherShift.expectedCash ?? 0,
                            actualCash: closingVoucherShift.actualCash ?? 0,
                            shortageOverage: closingVoucherShift.shortageOverage ?? 0,
                          },
                        },
                        closingVoucherShift.user?.name || "كاشير مشويات بسيوني"
                      )
                    );
                  }}
                  className="flex-1 bg-sky-700 hover:bg-sky-800 text-white font-black py-2.5 rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2"
                >
                  <span>🖨️</span>
                  <span>طباعة ورقة التقفيل الرسمية (80mm)</span>
                </button>
                <button
                  onClick={() => setClosingVoucherShift(null)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* ITEMIZED DETAILS MODAL (تفاصيل المصاريف والمسحوبات والتوالف) */}
      {/* ======================================================== */}
      {closingDetailsShift && (() => {
        const expItems = parseJsonArray(closingDetailsShift.expensesDetails);
        const withItems = parseJsonArray(closingDetailsShift.managementWithdrawalsDetails);
        const wasteItems = parseJsonArray(closingDetailsShift.staffWasteDetails);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center text-lg">
                    🔍
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">
                      تفاصيل بنود ورقة تقفيل وردية #{closingDetailsShift.shiftNumber}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      الكاشير: {closingDetailsShift.user?.name || "كاشير"} • التاريخ: {new Date(closingDetailsShift.startTime).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setClosingDetailsShift(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 text-base"
                >
                  ✕
                </button>
              </div>

              {/* 1. Expenses Section */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                    <span>🛒</span>
                    <span>بنود المصاريف المنصرفة ({expItems.length})</span>
                  </span>
                  <span className="font-mono font-black text-rose-700 text-xs">
                    {(closingDetailsShift.expensesTotal || 0).toFixed(2)} ج.م
                  </span>
                </div>
                {expItems.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">لا توجد مصاريف مسجلة</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {expItems.map((e: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-xl border border-slate-100">
                        <div>
                          <span className="font-bold text-slate-800">{e.item}</span>
                          {e.notes && <span className="text-[10px] text-slate-400 mr-2 font-normal">({e.notes})</span>}
                        </div>
                        <span className="font-mono font-black text-rose-700">{Number(e.amount).toFixed(2)} ج.م</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Management Withdrawals */}
              <div className="space-y-2 bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200">
                <div className="flex items-center justify-between border-b border-purple-200 pb-1.5">
                  <span className="font-black text-purple-900 text-xs flex items-center gap-1.5">
                    <span>💼</span>
                    <span>مسحوبات الإدارة ({withItems.length})</span>
                  </span>
                  <span className="font-mono font-black text-purple-900 text-xs">
                    {(closingDetailsShift.managementWithdrawalsTotal || 0).toFixed(2)} ج.م
                  </span>
                </div>
                {withItems.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">لا توجد مسحوبات إدارة مسجلة</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {withItems.map((w: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-xl border border-purple-100">
                        <div>
                          <span className="font-bold text-slate-800">{w.receiver}</span>
                          {w.notes && <span className="text-[10px] text-slate-400 mr-2 font-normal">({w.notes})</span>}
                        </div>
                        <span className="font-mono font-black text-purple-900">{Number(w.amount).toFixed(2)} ج.م</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Staff Waste */}
              <div className="space-y-2 bg-rose-50/40 p-3.5 rounded-2xl border border-rose-200">
                <div className="flex items-center justify-between border-b border-rose-200 pb-1.5">
                  <span className="font-black text-rose-900 text-xs flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>توالف الإصطاف ({wasteItems.length})</span>
                  </span>
                  <span className="font-mono font-black text-rose-700 text-xs">
                    {(closingDetailsShift.staffWasteTotal || 0).toFixed(2)} ج.م
                  </span>
                </div>
                {wasteItems.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">لا توجد توالف مسجلة</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {wasteItems.map((s: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 rounded-xl border border-rose-100">
                        <div>
                          <span className="font-bold text-slate-800">{s.item}</span>
                          {s.responsible && <span className="text-[10px] text-slate-400 mr-2 font-normal">(المسؤول: {s.responsible})</span>}
                        </div>
                        <span className="font-mono font-black text-rose-700">{Number(s.amount).toFixed(2)} ج.م</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    const s = closingDetailsShift;
                    setClosingDetailsShift(null);
                    setClosingVoucherShift(s);
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-sky-700 hover:bg-sky-800 text-white font-black text-xs transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>🖨️</span>
                  <span>معاينة وطباعة ورقة التقفيل الرسمية</span>
                </button>
                <button
                  onClick={() => setClosingDetailsShift(null)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* TAB 2: Shifts Management & Handover Log */}
      {/* ======================================================== */}
      {activeTab === "SHIFTS" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-800 text-base">
                سجل الورديات وتسليم العهد النقدية (Shift Handover)
              </h3>
              <p className="text-xs text-slate-500">
                متابعة دقيقة للنقدية المتوقعة، النقدية الفعلية بعد الجرد، وتسجيل العجز والزيادة.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setShiftFilter("ALL")}
                className={`px-3 py-1 rounded-lg transition ${
                  shiftFilter === "ALL" ? "bg-white text-slate-800 shadow" : "text-slate-500"
                }`}
              >
                الكل ({shifts.length})
              </button>
              <button
                onClick={() => setShiftFilter("OPEN")}
                className={`px-3 py-1 rounded-lg transition ${
                  shiftFilter === "OPEN" ? "bg-white text-emerald-800 shadow" : "text-slate-500"
                }`}
              >
                نشطة ({shifts.filter((s) => s.status === ShiftStatus.OPEN).length})
              </button>
              <button
                onClick={() => setShiftFilter("CLOSED")}
                className={`px-3 py-1 rounded-lg transition ${
                  shiftFilter === "CLOSED" ? "bg-white text-slate-800 shadow" : "text-slate-500"
                }`}
              >
                مغلقة ({shifts.filter((s) => s.status === ShiftStatus.CLOSED).length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                  <th className="py-3 px-3">رقم الوردية</th>
                  <th className="py-3 px-3">الكاشير / الموظف</th>
                  <th className="py-3 px-3">وقت البدء</th>
                  <th className="py-3 px-3">وقت الإغلاق</th>
                  <th className="py-3 px-3">المدة</th>
                  <th className="py-3 px-3">الطلبات المسددة</th>
                  <th className="py-3 px-3">النقدية المتوقعة</th>
                  <th className="py-3 px-3">النقدية الفعلية (المعدودة)</th>
                  <th className="py-3 px-3">الفارق (عجز / زيادة)</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3 text-center">ورقة التقفيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      لا توجد ورديات مطابقة للتصفية
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map((shift) => {
                    const start = new Date(shift.startTime);
                    const end = shift.endTime ? new Date(shift.endTime) : null;
                    const diffHours = end
                      ? ((end.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(1)
                      : ((new Date().getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(1);

                    const shortage = shift.shortageOverage ?? 0;

                    return (
                      <tr key={shift.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-mono font-black text-slate-900">
                          #{shift.shiftNumber}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {shift.user?.name || shift.user?.username}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          {start.toLocaleString("ar-EG", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          {end
                            ? end.toLocaleString("ar-EG", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "— جارية الآن —"}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono">
                          {diffHours} س
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">
                          {shift.orders?.length || 0} طلب
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">
                          {shift.expectedCash.toFixed(2)} ج.م
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">
                          {shift.actualCash !== null ? `${shift.actualCash.toFixed(2)} ج.م` : "—"}
                        </td>
                        <td className="py-3 px-3 font-mono font-black">
                          {shift.actualCash === null ? (
                            <span className="text-slate-400">—</span>
                          ) : shortage === 0 ? (
                            <span className="text-emerald-600">مطابق تماماً (0.00)</span>
                          ) : shortage > 0 ? (
                            <span className="text-blue-600">+{shortage.toFixed(2)} ج.م (زيادة)</span>
                          ) : (
                            <span className="text-rose-600">{shortage.toFixed(2)} ج.م (عجز)</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {shift.status === ShiftStatus.OPEN ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                              نشطة الآن
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                              مغلقة
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {shift.status === ShiftStatus.CLOSED ? (
                            <button
                              onClick={() => setClosingVoucherShift(shift)}
                              className="px-2.5 py-1 bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-300 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1 mx-auto shadow-sm"
                              title="عرض وطباعة ورقة تقفيل مشويات بسيوني الرسمية"
                            >
                              <span>📋</span>
                              <span>ورقة التقفيل</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: Official Bedouin Closing Sheets (أوراق التقفيل اليومية) */}
      {/* ======================================================== */}
      {activeTab === "CLOSING_SHEETS" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <h3 className="font-black text-slate-800 text-base sm:text-lg">
                  أوراق التقفيل اليومية الرسمية (مشويات بسيوني مطعم وكافيه)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                سجل أوراق التقفيل المطابقة للورقة الورقية المعتمدة مع البنود الـ 9، تفاصيل المصاريف، مسحوبات الإدارة، وتوالف الإصطاف.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-xl bg-sky-50 text-sky-900 border border-sky-200 text-xs font-black">
                {shifts.filter((s) => s.status === ShiftStatus.CLOSED).length} وردية مقفلة
              </span>
            </div>
          </div>

          {/* Quick Aggregate Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">إجمالي المبيعات المؤرشفة</span>
              <p className="text-xl font-black font-mono text-slate-900">
                {shifts
                  .filter((s) => s.status === ShiftStatus.CLOSED)
                  .reduce((sum, s) => sum + (s.grossSales || s.expectedCash || 0), 0)
                  .toFixed(2)} ج.م
              </p>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 p-4 rounded-2xl border border-rose-200">
              <span className="text-[11px] font-bold text-rose-700 block mb-1">إجمالي المصاريف المنصرفة</span>
              <p className="text-xl font-black font-mono text-rose-900">
                {shifts
                  .filter((s) => s.status === ShiftStatus.CLOSED)
                  .reduce((sum, s) => sum + (s.expensesTotal || 0), 0)
                  .toFixed(2)} ج.م
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-2xl border border-purple-200">
              <span className="text-[11px] font-bold text-purple-700 block mb-1">إجمالي مسحوبات الإدارة</span>
              <p className="text-xl font-black font-mono text-purple-900">
                {shifts
                  .filter((s) => s.status === ShiftStatus.CLOSED)
                  .reduce((sum, s) => sum + (s.managementWithdrawalsTotal || 0), 0)
                  .toFixed(2)} ج.م
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 rounded-2xl border border-amber-200">
              <span className="text-[11px] font-bold text-amber-700 block mb-1">إجمالي توالف الإصطاف</span>
              <p className="text-xl font-black font-mono text-amber-900">
                {shifts
                  .filter((s) => s.status === ShiftStatus.CLOSED)
                  .reduce((sum, s) => sum + (s.staffWasteTotal || 0), 0)
                  .toFixed(2)} ج.م
              </p>
            </div>
          </div>

          {/* Table of Closing Sheets */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                  <th className="py-3 px-3">الوردية والتاريخ</th>
                  <th className="py-3 px-3">الكاشير / المستلم</th>
                  <th className="py-3 px-3">إجمالي المبيعات</th>
                  <th className="py-3 px-3">الخصومات / فيزا</th>
                  <th className="py-3 px-3">المصاريف</th>
                  <th className="py-3 px-3">مسحوبات إدارة</th>
                  <th className="py-3 px-3">توالف إصطاف</th>
                  <th className="py-3 px-3">رصيد أخر اليوم</th>
                  <th className="py-3 px-3">الفارق بالدرج</th>
                  <th className="py-3 px-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {shifts.filter((s) => s.status === ShiftStatus.CLOSED).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      لا توجد أوراق تقفيل مغلقة حتى الآن
                    </td>
                  </tr>
                ) : (
                  shifts
                    .filter((s) => s.status === ShiftStatus.CLOSED)
                    .map((shift) => {
                      const gross = shift.grossSales ?? shift.expectedCash ?? 0;
                      const disc = shift.discounts ?? 0;
                      const visa = shift.visaAmount ?? 0;
                      const exp = shift.expensesTotal ?? 0;
                      const withTotal = shift.managementWithdrawalsTotal ?? 0;
                      const waste = shift.staffWasteTotal ?? 0;
                      const endBal = shift.endOfDayBalance ?? shift.expectedCash ?? 0;
                      const shortage = shift.shortageOverage ?? 0;

                      return (
                        <tr key={shift.id} className="hover:bg-sky-50/30 transition">
                          <td className="py-3 px-3">
                            <span className="font-mono font-black text-slate-900 block">
                              وردية #{shift.shiftNumber}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(shift.startTime).toLocaleDateString("ar-EG")}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 block">
                              {shift.user?.name || "كاشير"}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              المستلم: <strong className="text-slate-700">{shift.receivedBy || "—"}</strong>
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono font-black text-slate-900 text-sm">
                            {gross.toFixed(2)} ج.م
                          </td>

                          <td className="py-3 px-3 font-mono text-[11px] space-y-0.5">
                            {disc > 0 && <span className="block text-rose-600">خصم: {disc.toFixed(2)}</span>}
                            {visa > 0 && <span className="block text-blue-600">فيزا: {visa.toFixed(2)}</span>}
                            {disc === 0 && visa === 0 && <span className="text-slate-400">—</span>}
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-rose-700 block">
                              {exp.toFixed(2)} ج.م
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-purple-800 block">
                              {withTotal.toFixed(2)} ج.م
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-amber-700 block">
                              {waste.toFixed(2)} ج.م
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono font-black text-emerald-800 text-sm">
                            {endBal.toFixed(2)} ج.م
                          </td>

                          <td className="py-3 px-3 font-mono font-bold">
                            {shift.actualCash === null ? (
                              <span className="text-slate-400">—</span>
                            ) : shortage === 0 ? (
                              <span className="text-emerald-600">مطابق (0.00)</span>
                            ) : shortage > 0 ? (
                              <span className="text-blue-600">+{shortage.toFixed(2)}</span>
                            ) : (
                              <span className="text-rose-600">{shortage.toFixed(2)}</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setClosingVoucherShift(shift)}
                                className="px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-black text-xs transition shadow-sm flex items-center gap-1"
                              >
                                <span>🖨️</span>
                                <span>طباعة الورقة</span>
                              </button>
                              <button
                                onClick={() => setClosingDetailsShift(shift)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                                title="عرض تفاصيل المصاريف والمسحوبات والتوالف"
                              >
                                <span>🔍</span>
                                <span>البنود</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: Category Sales Analysis */}
      {/* ======================================================== */}
      {activeTab === "SALES" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 print:hidden">
          <div>
            <h3 className="font-black text-slate-800 text-base">
              تحليل مبيعات الأقسام والتصنيفات
            </h3>
            <p className="text-xs text-slate-500">
              توزيع إجمالي الإيرادات وعدد الأصناف المباعة حسب كل تصنيف في المنيو.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sales.categoryBreakdown.map((cat) => {
              const percentage =
                sales.allTimeSales > 0 ? (cat.revenue / sales.allTimeSales) * 100 : 0;

              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 text-sm">
                      {cat.nameAr}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">
                      {cat.itemsSold} قطعة مباعة
                    </span>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs text-slate-500">الإيراد:</span>
                      <span className="text-base font-black font-mono text-primary-900">
                        {cat.revenue.toFixed(2)} ج.م
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block text-left">
                      {percentage.toFixed(1)}% من إجمالي المبيعات
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: Raw Material Inventory Consumption */}
      {/* ======================================================== */}
      {activeTab === "INVENTORY" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-800 text-base">
                مخزون واستهلاك المواد الخام (Raw Materials & Recipes)
              </h3>
              <p className="text-xs text-slate-500">
                متابعة دقيقة للأرصدة الحالية في المخزن والحد الأدنى للتنبيه بنقص الخامات وخصمها بالوصفات.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                  <th className="py-3 px-3">اسم المادة الخام</th>
                  <th className="py-3 px-3">الرصيد الحالي بالمخزن</th>
                  <th className="py-3 px-3">وحدة القياس</th>
                  <th className="py-3 px-3">الحد الأدنى للتنبيه</th>
                  <th className="py-3 px-3">سعر الوحدة</th>
                  <th className="py-3 px-3">الحالة والمؤشر</th>
                  <th className="py-3 px-3">الأصناف المرتبطة بها</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {rawMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لم يتم تسجيل أي مواد خام في النظام حتى الآن
                    </td>
                  </tr>
                ) : (
                  rawMaterials.map((mat) => {
                    const isLow = mat.currentStock <= mat.minStockLevel;

                    return (
                      <tr key={mat.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-black text-slate-900">
                          {mat.name}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-sm">
                          <span className={isLow ? "text-rose-600" : "text-slate-800"}>
                            {mat.currentStock.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-bold">
                          {mat.unit}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {mat.minStockLevel.toFixed(2)} {mat.unit}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {mat.costPerUnit ? `${mat.costPerUnit.toFixed(2)} ج.م` : "—"}
                        </td>
                        <td className="py-3 px-3">
                          {isLow ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                              ⚠️ نقص مخزون
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ✓ رصيد كافي
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {mat.recipeItems?.length > 0
                            ? mat.recipeItems.map((r: any) => r.menuItem.nameAr).join(" • ")
                            : "غير مربوطة بوصفة"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: Complimentary Orders Log */}
      {/* ======================================================== */}
      {activeTab === "COMPLIMENTARY" && (
        <div className="bg-purple-50/30 rounded-3xl border border-purple-200 shadow-sm p-6 space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">👑</span>
                <h3 className="font-black text-purple-950 text-base">
                  سجل طلبات الضيافة الخاص (Complimentary Orders Log)
                </h3>
              </div>
              <p className="text-xs text-purple-800 mt-1">
                الطلبات المسجلة لطاولة المالك (Owner Table) وطاولة المدير (Manager Table). يتم إعفاؤها 100% واستبعادها تلقائياً من النقدية المتوقعة للوردية.
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-purple-200 text-center shrink-0">
              <p className="text-[10px] text-purple-600 font-bold">إجمالي مبالغ الضيافة</p>
              <p className="text-xl font-black font-mono text-purple-900">
                {totalComplimentaryWaived.toFixed(2)} ج.م
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-purple-50/50 border-b border-purple-100 text-purple-900 font-black">
                  <th className="py-3 px-3">رقم الطلب</th>
                  <th className="py-3 px-3">الطاولة</th>
                  <th className="py-3 px-3">الأصناف المطلوبة</th>
                  <th className="py-3 px-3">المبلغ الأصلي (المعفى)</th>
                  <th className="py-3 px-3">المبلغ المحصل</th>
                  <th className="py-3 px-3">الكاشير</th>
                  <th className="py-3 px-3">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50 font-medium">
                {complimentaryOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد طلبات ضيافة مسجلة حتى الآن
                    </td>
                  </tr>
                ) : (
                  complimentaryOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-purple-50/30 transition">
                      <td className="py-3 px-3 font-mono font-black text-purple-900">
                        #{order.orderNumber}
                      </td>
                      <td className="py-3 px-3 font-black text-slate-800">
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[11px]">
                          {order.table?.name}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        {order.items.map((i: any) => `${i.quantity}x ${i.menuItem.nameAr}`).join(" • ")}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-400 line-through">
                        {order.subtotal.toFixed(2)} ج.م
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-purple-700">
                        0.00 ج.م (ضيافة 100%)
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-bold">
                        {order.user?.name || "الكاشير"}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(order.createdAt).toLocaleString("ar-EG", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
