"use client";

import { useState } from "react";
import { ShiftStatus } from "@prisma/client";

interface ReportsViewProps {
  shifts: any[];
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
  sales,
  complimentaryOrders,
  totalComplimentaryWaived,
  rawMaterials,
}: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<
    "SHIFTS" | "SALES" | "INVENTORY" | "COMPLIMENTARY"
  >("SHIFTS");

  const [shiftFilter, setShiftFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");

  const filteredShifts = shifts.filter((s) => {
    if (shiftFilter === "ALL") return true;
    return s.status === shiftFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            التقارير المالية والورديات والمخزون
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            متابعة شاملة لإيرادات المبيعات، عجز وزيادة الورديات، واستهلاك المواد الخام، وسجل الضيافة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-primary-50 text-primary-800 border border-primary-200 text-xs font-black">
            نظام نقاط البيع • واحة بدوي
          </span>
        </div>
      </div>

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Card 3: Shifts Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي الورديات</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              ⏱️
            </span>
          </div>
          <div>
            <p className="text-2xl font-black font-mono text-slate-800">
              {shifts.length} وردية
            </p>
            <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
              {shifts.filter((s) => s.status === ShiftStatus.OPEN).length} وردية نشطة حالياً
            </p>
          </div>
        </div>

        {/* Card 4: Complimentary Waived (CRITICAL REQUIREMENT 5) */}
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
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
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

      {/* TAB 1: Shifts Management & Handover Log */}
      {activeTab === "SHIFTS" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
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
                الكل
              </button>
              <button
                onClick={() => setShiftFilter("OPEN")}
                className={`px-3 py-1 rounded-lg transition ${
                  shiftFilter === "OPEN" ? "bg-emerald-600 text-white shadow" : "text-slate-500"
                }`}
              >
                نشطة 🟢
              </button>
              <button
                onClick={() => setShiftFilter("CLOSED")}
                className={`px-3 py-1 rounded-lg transition ${
                  shiftFilter === "CLOSED" ? "bg-slate-800 text-white shadow" : "text-slate-500"
                }`}
              >
                مقفلة
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                  <th className="py-3 px-3">رقم الوردية</th>
                  <th className="py-3 px-3">الكاشير</th>
                  <th className="py-3 px-3">وقت البدء</th>
                  <th className="py-3 px-3">وقت الإغلاق</th>
                  <th className="py-3 px-3">العهدة الافتتاحية</th>
                  <th className="py-3 px-3">المتوقع (درج)</th>
                  <th className="py-3 px-3">الفعلي (جرد)</th>
                  <th className="py-3 px-3">العجز / الزيادة</th>
                  <th className="py-3 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      لا توجد ورديات مسجلة مطابقة للفلتر
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map((shift) => {
                    const isClosed = shift.status === ShiftStatus.CLOSED;
                    const diff = shift.shortageOverage ?? 0;

                    let diffBadge = "text-slate-400";
                    let diffText = "قيد التشغيل";

                    if (isClosed) {
                      if (diff === 0) {
                        diffBadge = "text-emerald-700 bg-emerald-50 border-emerald-200";
                        diffText = "0.00 (متطابق ✓)";
                      } else if (diff < 0) {
                        diffBadge = "text-rose-700 bg-rose-50 border-rose-200";
                        diffText = `${diff.toFixed(2)} ج.م (عجز ⚠️)`;
                      } else {
                        diffBadge = "text-blue-700 bg-blue-50 border-blue-200";
                        diffText = `+${diff.toFixed(2)} ج.م (زيادة)`;
                      }
                    }

                    return (
                      <tr key={shift.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 font-mono font-black text-slate-800">
                          #{shift.shiftNumber}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-700">
                          {shift.user?.name}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {new Date(shift.startTime).toLocaleString("ar-EG", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {shift.endTime
                            ? new Date(shift.endTime).toLocaleString("ar-EG", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "— (نشطة)"}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {shift.initialCash.toFixed(2)} ج.م
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-primary-900">
                          {shift.expectedCash.toFixed(2)} ج.م
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {shift.actualCash != null
                            ? `${shift.actualCash.toFixed(2)} ج.م`
                            : "—"}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold">
                          {isClosed ? (
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[11px] ${diffBadge}`}
                            >
                              {diffText}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">قيد العمل</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              shift.status === ShiftStatus.OPEN
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {shift.status === ShiftStatus.OPEN ? "مفتوحة 🟢" : "مقفلة ⚪"}
                          </span>
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

      {/* TAB 2: Sales & Category Breakdown */}
      {activeTab === "SALES" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-black text-slate-800 text-base">
              تحليل مبيعات الأقسام (Category Analytics)
            </h3>
            <p className="text-xs text-slate-500">
              حجم الإيرادات وعدد الأصناف المباعة في كل قسم (المأكولات، الباريستا، الشيشة).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {sales.categoryBreakdown.map((cat) => (
                <div
                  key={cat.id}
                  className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-800 text-sm">{cat.nameAr}</h4>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                      {cat.itemsSold} قطعة مباعة
                    </span>
                  </div>
                  <div>
                    <p className="text-xl font-black font-mono text-primary-900">
                      {cat.revenue.toFixed(2)} ج.م
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      إجمالي مبيعات القسم المحصلة
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Inventory Consumption */}
      {activeTab === "INVENTORY" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-black text-slate-800 text-base">
              تقرير استهلاك المخزون والمواد الخام
            </h3>
            <p className="text-xs text-slate-500">
              يتم خصم الكميات تلقائياً فور تسجيل أي طلب بناءً على هندسة الوصفات (Recipe Engineering).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                  <th className="py-3 px-3">اسم المادة الخام</th>
                  <th className="py-3 px-3">الرصيد الحالي</th>
                  <th className="py-3 px-3">الوحدة</th>
                  <th className="py-3 px-3">الحد الأدنى للتنبيه</th>
                  <th className="py-3 px-3">سعر الوحدة</th>
                  <th className="py-3 px-3">القيمة الإجمالية للرصيد</th>
                  <th className="py-3 px-3">حالة الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {rawMaterials.map((rm) => {
                  const isLow = rm.currentStock <= rm.minStockLevel;
                  const totalValue = rm.currentStock * rm.costPerUnit;

                  return (
                    <tr key={rm.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-black text-slate-800">{rm.name}</td>
                      <td className="py-3 px-3 font-mono font-bold text-base text-slate-900">
                        {rm.currentStock.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{rm.unit}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {rm.minStockLevel} {rm.unit}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {rm.costPerUnit.toFixed(2)} ج.م
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-primary-900">
                        {totalValue.toFixed(2)} ج.م
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isLow
                              ? "bg-rose-100 text-rose-800 border-rose-300 animate-pulse"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {isLow ? "⚠️ رصيد منخفض" : "كافٍ ومستقر ✓"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CRITICAL REQUIREMENT 5: Separate Complimentary Orders Log */}
      {activeTab === "COMPLIMENTARY" && (
        <div className="bg-white rounded-3xl border border-purple-200 shadow-sm p-6 space-y-4">
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
