"use client";

import { useState } from "react";
import { ShiftStatus, OrderStatus, OrderType } from "@prisma/client";
import { refundOrDeleteOrder } from "@/actions/reports";
import { useRouter } from "next/navigation";

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
    "INVOICES" | "SHIFTS" | "SALES" | "INVENTORY" | "COMPLIMENTARY"
  >("INVOICES");

  const [shiftFilter, setShiftFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");

  // Invoices search and filters
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState<"ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY">("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"ALL" | "PAID" | "OPEN" | "CANCELLED">("ALL");

  // Re-print modal state
  const [printableOrder, setPrintableOrder] = useState<any | null>(null);

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
    window.print();
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
            نظام نقاط البيع • واحة بدوي
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
                  واحة بدوي - WAHET BADAWY
                </p>
                <p className="text-[11px] text-slate-600 font-bold">
                  طعم زمان على أصوله • كافيه ومطعم بدوي
                </p>
                <p className="text-[10px] text-slate-500">
                  خدمة العملاء والتوصيل: 01558962994
                </p>
                <p className="text-[10px] text-slate-500">
                  عبد القادر - جامع السلام - المستعمرة
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
                    {printableOrder.user?.name || "كاشير واحة بدوي"}
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
                    👑 معفى 100% (ضيافة إدارة واحة بدوي)
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
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
