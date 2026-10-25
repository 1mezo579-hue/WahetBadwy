"use client";

import { useState, useTransition } from "react";
import {
  updateGrillingOrderStatus,
  updateCookedWeight,
  confirmGrillingDelivery,
  recordOrderReprint,
  GrillingWorkflowStatus,
} from "@/actions/grilling-service";
import {
  buildGrillingKitchenTicketHtml,
  buildGrillingHandoverTicketHtml,
  buildThermalReceiptHtml,
  silentPrintHtml,
} from "@/utils/printer/silent-print";

interface GrillingTrackerModalProps {
  orders: any[];
  onClose: () => void;
  currentUser: string;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<string, { label: string; badgeClass: string; icon: string }> = {
  NEW: { label: "جديد", badgeClass: "bg-blue-950 text-blue-300 border-blue-500/40", icon: "🆕" },
  RECEIVED_CUSTOMER_MEAT: { label: "تم استلام الخامات", badgeClass: "bg-amber-950 text-amber-300 border-amber-500/40", icon: "🥩" },
  PREPARING: { label: "قيد التجهيز والتتبيل", badgeClass: "bg-purple-950 text-purple-300 border-purple-500/40", icon: "🔪" },
  GRILLING: { label: "قيد الشوي على الفحم", badgeClass: "bg-orange-950 text-orange-300 border-orange-500/40", icon: "🔥" },
  READY_FOR_PICKUP: { label: "جاهز للتسليم", badgeClass: "bg-cyan-950 text-cyan-300 border-cyan-500/40", icon: "📦" },
  DELIVERED: { label: "تم التسليم للعميل", badgeClass: "bg-emerald-950 text-emerald-300 border-emerald-500/40", icon: "✅" },
  CANCELLED: { label: "ملغي", badgeClass: "bg-rose-950 text-rose-300 border-rose-500/40", icon: "❌" },
};

export default function GrillingTrackerModal({
  orders,
  onClose,
  currentUser,
  onRefresh,
}: GrillingTrackerModalProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Cooked Weight State
  const [editingCookedOrder, setEditingCookedOrder] = useState<any | null>(null);
  const [cookedWeightInput, setCookedWeightInput] = useState<string>("");

  const filteredOrders = orders.filter((o) => {
    const status = o.workflowStatus || "NEW";
    const matchesStatus = filterStatus === "ALL" || status === filterStatus;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      String(o.orderNumber).includes(term) ||
      o.customerName?.toLowerCase().includes(term) ||
      o.customerPhone?.includes(term) ||
      o.meatType?.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = (orderId: string, nextStatus: GrillingWorkflowStatus) => {
    startTransition(async () => {
      const res = await updateGrillingOrderStatus(orderId, nextStatus, currentUser);
      if (res.error) {
        alert(res.error);
      } else {
        onRefresh();
      }
    });
  };

  const handleConfirmDelivery = (order: any) => {
    if (order.workflowStatus === "DELIVERED") {
      alert(`الطلب تم تسليمه مسبقاً بواسطة (${order.deliveredBy || "المسؤول"}). يمنع التسليم المزدوج.`);
      return;
    }

    const confirmDelivery = confirm(
      `هل تؤكد تسليم طلب المشويات رقم #${order.orderNumber} للعميل (${order.customerName})؟`
    );
    if (!confirmDelivery) return;

    startTransition(async () => {
      const res = await confirmGrillingDelivery(order.id, currentUser);
      if (res.error) {
        alert(res.error);
      } else {
        alert(res.message);
        onRefresh();
      }
    });
  };

  const handleSaveCookedWeight = () => {
    if (!editingCookedOrder) return;
    const weightNum = Number(cookedWeightInput);
    if (!weightNum || weightNum <= 0) {
      alert("يرجى إدخال وزن صحيح بالجرام");
      return;
    }

    startTransition(async () => {
      const res = await updateCookedWeight(editingCookedOrder.id, weightNum);
      if (res.error) {
        alert(res.error);
      } else {
        alert(
          `تم تسجيل الوزن بعد التسوية: ${res.cookedWeight} جم. نسبة الانكماش: ${res.shrinkagePercent} (${res.shrinkageGrams} جم هدر تسوية طبيعي).`
        );
        setEditingCookedOrder(null);
        setCookedWeightInput("");
        onRefresh();
      }
    });
  };

  const handleReprintSlip = async (order: any, type: "KITCHEN" | "HANDOVER" | "CUSTOMER") => {
    startTransition(async () => {
      const logRes = await recordOrderReprint(order.id, currentUser, `إعادة طباعة ${type}`);
      const reprintCount = logRes.reprintCount || (order.reprintCount || 0) + 1;

      const baseOptions = {
        tableName: "خامات العميل (شوي للغير)",
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        items: (order.items || []).map((i: any) => ({
          nameAr: i.menuItem?.nameAr || i.nameAr || "إضافة",
          quantity: i.quantity,
          price: i.unitPrice,
        })),
        subtotal: order.subtotal,
        totalAmount: order.totalAmount,
        notes: order.notes,
        cashierName: currentUser,
        isPaid: order.status === "PAID",
        orderKind: "CUSTOMER_GRILL" as const,
        meatType: order.meatType,
        customerMeatWeight: order.customerMeatWeight,
        cookedWeight: order.cookedWeight,
        grillingFee: order.grillingFee,
        expectedPickupTime: order.expectedPickupTime,
        receivedBy: order.receivedBy,
        deliveredBy: order.deliveredBy,
        reprintCount,
      };

      if (type === "KITCHEN") {
        const html = buildGrillingKitchenTicketHtml(baseOptions);
        await silentPrintHtml(html);
      } else if (type === "HANDOVER") {
        const html = buildGrillingHandoverTicketHtml(baseOptions);
        await silentPrintHtml(html);
      } else {
        const html = buildThermalReceiptHtml({
          ...baseOptions,
          title: "فاتورة سداد خدمة شوي للغير",
        });
        await silentPrintHtml(html);
      }

      onRefresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#101014] border border-orange-500/40 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-orange-950/80 via-stone-900 to-amber-950/60 border-b border-orange-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-base font-black text-white">
                لوحة متابعة استلام وتسليم مشويات خامات العميل
              </h2>
              <p className="text-xs text-orange-400 font-bold">
                متابعة دورة حياة الشوي من الاستلام حتى التسليم النهائي ومنع التكرار
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Filter Controls */}
        <div className="p-3 bg-[#14141a] border-b border-stone-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {["ALL", "RECEIVED_CUSTOMER_MEAT", "PREPARING", "GRILLING", "READY_FOR_PICKUP", "DELIVERED"].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${
                  filterStatus === st
                    ? "bg-orange-500 text-stone-950 font-black shadow"
                    : "bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800"
                }`}
              >
                {st === "ALL" ? "الكل" : STATUS_LABELS[st]?.label || st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="ابحث بالاسم أو الهاتف أو رقم الطلب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-stone-950 border border-stone-800 focus:border-orange-500 text-white font-medium text-xs px-3 py-1.5 rounded-xl outline-none w-56"
            />
            <button
              onClick={onRefresh}
              className="p-1.5 bg-stone-900 text-stone-300 hover:text-white rounded-xl border border-stone-800"
              title="تحديث القائمة"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Orders List Table */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-sm">
              لا توجد طلبات شوي خامات عميل مطابقة للبحث حالياً.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const statusMeta = STATUS_LABELS[order.workflowStatus || "NEW"] || STATUS_LABELS.NEW;
              const rawKg = ((order.customerMeatWeight || 0) / 1000).toFixed(2);
              const shrinkageGrams = order.cookedWeight && order.customerMeatWeight
                ? Math.max(0, order.customerMeatWeight - order.cookedWeight)
                : 0;
              const shrinkagePercent = order.cookedWeight && order.customerMeatWeight
                ? ((shrinkageGrams / order.customerMeatWeight) * 100).toFixed(1)
                : null;

              return (
                <div
                  key={order.id}
                  className="bg-[#141419] border border-stone-850 hover:border-orange-500/40 rounded-2xl p-3.5 space-y-3 transition shadow"
                >
                  {/* Top Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-orange-400">
                        #{order.orderNumber}
                      </span>
                      <span className="text-sm font-black text-white">
                        {order.customerName || "عميل خارجي"}
                      </span>
                      {order.customerPhone && (
                        <span className="text-xs font-mono text-stone-400 font-bold">
                          📞 {order.customerPhone}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.badgeClass}`}>
                        {statusMeta.icon} {statusMeta.label}
                      </span>
                      {order.reprintCount && order.reprintCount > 0 && (
                        <span className="text-[10px] bg-rose-950/60 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded-md font-mono">
                          نسخة #{order.reprintCount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-xs text-stone-400">رسوم الشوي:</span>
                      <span className="text-sm font-black text-amber-400">{order.grillingFee || 0} ج.م</span>
                      <span className="text-xs text-stone-500 mr-2">إجمالي: {order.totalAmount} ج.م</span>
                    </div>
                  </div>

                  {/* Details Line */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-stone-950 p-2.5 rounded-xl border border-stone-850">
                    <div>
                      <span className="text-stone-500 text-[10px] block">نوع الخامة:</span>
                      <strong className="text-stone-200">{order.meatType || "مشويات"}</strong>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[10px] block">الوزن النيء:</span>
                      <strong className="text-amber-400 font-mono">
                        {order.customerMeatWeight || 0} جم ({rawKg} كجم)
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[10px] block">الوزن بعد التسوية:</span>
                      {order.cookedWeight && order.cookedWeight > 0 ? (
                        <strong className="text-emerald-400 font-mono">
                          {order.cookedWeight} جم ({shrinkagePercent}% انكماش)
                        </strong>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingCookedOrder(order);
                            setCookedWeightInput(String(order.cookedWeight || ""));
                          }}
                          className="text-[10px] text-orange-400 hover:text-amber-300 underline font-bold"
                        >
                          + تسجيل الوزن بعد الشوي
                        </button>
                      )}
                    </div>
                    <div>
                      <span className="text-stone-500 text-[10px] block">موعد التسليم:</span>
                      <strong className="text-stone-300">{order.expectedPickupTime || "حسب الجاهزية"}</strong>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="text-[11px] text-stone-300 bg-stone-900/60 p-2 rounded-lg border border-stone-850">
                      <strong>تعليمات العميل:</strong> {order.notes}
                    </div>
                  )}

                  {/* Status Progression & Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-850">
                    {/* Status Workflow Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-stone-500 font-bold ml-1">تحديث الحالة:</span>
                      
                      {order.workflowStatus !== "PREPARING" && order.workflowStatus !== "GRILLING" && order.workflowStatus !== "READY_FOR_PICKUP" && order.workflowStatus !== "DELIVERED" && (
                        <button
                          onClick={() => handleStatusChange(order.id, "PREPARING")}
                          className="px-2 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-purple-300 border border-purple-500/30 text-[10px] font-bold"
                        >
                          🔪 بدء التجهيز
                        </button>
                      )}

                      {order.workflowStatus !== "GRILLING" && order.workflowStatus !== "READY_FOR_PICKUP" && order.workflowStatus !== "DELIVERED" && (
                        <button
                          onClick={() => handleStatusChange(order.id, "GRILLING")}
                          className="px-2 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-orange-300 border border-orange-500/30 text-[10px] font-bold"
                        >
                          🔥 على الشواية
                        </button>
                      )}

                      {order.workflowStatus !== "READY_FOR_PICKUP" && order.workflowStatus !== "DELIVERED" && (
                        <button
                          onClick={() => handleStatusChange(order.id, "READY_FOR_PICKUP")}
                          className="px-2 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold"
                        >
                          📦 جاهز للتسليم
                        </button>
                      )}

                      {order.workflowStatus !== "DELIVERED" ? (
                        <button
                          onClick={() => handleConfirmDelivery(order)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-[10px] font-black shadow"
                        >
                          ✅ تأكيد تسليم المشويات للعميل
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-lg">
                          تم التسليم بواسطة {order.deliveredBy || "المسؤول"}
                        </span>
                      )}
                    </div>

                    {/* Reprint Options */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleReprintSlip(order, "KITCHEN")}
                        className="px-2 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-[10px] font-bold flex items-center gap-1"
                        title="إعادة طباعة بون الشواية والمطبخ"
                      >
                        <span>🖨️</span>
                        <span>بون الشواية</span>
                      </button>

                      <button
                        onClick={() => handleReprintSlip(order, "HANDOVER")}
                        className="px-2 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-[10px] font-bold flex items-center gap-1"
                        title="إعادة طباعة بون التسليم والتغليف"
                      >
                        <span>📦</span>
                        <span>بون التغليف</span>
                      </button>

                      <button
                        onClick={() => handleReprintSlip(order, "CUSTOMER")}
                        className="px-2 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 text-[10px] font-bold flex items-center gap-1"
                        title="إعادة طباعة إيصال العميل"
                      >
                        <span>🧾</span>
                        <span>إيصال العميل</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cooked Weight Modal */}
        {editingCookedOrder && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80" dir="rtl">
            <div className="bg-[#14141a] border border-orange-500/40 rounded-2xl p-4 w-full max-w-sm space-y-3">
              <h3 className="text-sm font-black text-white">تسجيل الوزن بعد التسوية (Cooked Weight)</h3>
              <p className="text-xs text-stone-300">
                طلب #{editingCookedOrder.orderNumber} - {editingCookedOrder.meatType}
              </p>
              <div className="bg-stone-950 p-2.5 rounded-xl border border-stone-800 text-xs">
                <span>الوزن النيء المسجل: </span>
                <strong className="text-amber-400 font-mono">{editingCookedOrder.customerMeatWeight} جم</strong>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">الوزن بعد الشوي والتسوية (بالجرام):</label>
                <input
                  type="number"
                  placeholder="مثلاً: 1450"
                  value={cookedWeightInput}
                  onChange={(e) => setCookedWeightInput(e.target.value)}
                  className="w-full bg-stone-950 border border-orange-500/40 text-white font-mono font-bold text-sm px-3 py-2 rounded-xl outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCookedOrder(null)}
                  className="flex-1 py-2 bg-stone-900 text-stone-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveCookedWeight}
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-stone-950 font-black rounded-xl text-xs"
                >
                  حفظ الوزن
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
