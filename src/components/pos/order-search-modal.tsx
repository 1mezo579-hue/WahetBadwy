"use client";

import React, { useState, useEffect, useTransition } from "react";
import { fastSearchOrders, FastOrderSearchResult } from "@/actions/order-search";
import { cancelOrVoidWithManagerApproval, getOrderForReprint } from "@/actions/pos";
import { applyHospitalityWithManagerApproval } from "@/actions/hospitality";
import { triggerSilentThermalPrint } from "@/utils/printer/silent-print";

interface OrderSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: string;
  userRole?: string;
}

export default function OrderSearchModal({
  isOpen,
  onClose,
  currentUser = "الكاشير",
  userRole = "CASHIER",
}: OrderSearchModalProps) {
  const [isPending, startTransition] = useTransition();

  // Search filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [results, setResults] = useState<FastOrderSearchResult[]>([]);
  const [totalFound, setTotalFound] = useState(0);

  // Selected Order for Details
  const [selectedOrder, setSelectedOrder] = useState<FastOrderSearchResult | null>(null);

  // Manager Approval Modal State (for VOID Item, Cancel Order, or Hospitality)
  const [actionModalType, setActionModalType] = useState<"VOID_ITEM" | "CANCEL_ORDER" | "HOSPITALITY" | null>(null);
  const [targetItemId, setTargetItemId] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [managerUsername, setManagerUsername] = useState("admin");
  const [managerPassword, setManagerPassword] = useState("");
  const [hospitalityType, setHospitalityType] = useState<"FULL" | "ITEM" | "DISCOUNT">("FULL");
  const [hospitalityDiscountAmount, setHospitalityDiscountAmount] = useState<string>("");

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Run search
  const handleSearch = () => {
    startTransition(async () => {
      const res = await fastSearchOrders({
        query: searchQuery,
        orderType: filterType as any,
        status: filterStatus as any,
        limit: 50,
      });
      if (res.success) {
        setResults(res.orders);
        setTotalFound(res.totalFound);
      } else {
        setFeedback({ type: "error", text: res.error || "فشل البحث عن الطلبات" });
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      handleSearch();
    }
  }, [isOpen, filterType, filterStatus]);

  if (!isOpen) return null;

  // Handle Reprint
  const handleReprintOrder = async (orderId: string) => {
    startTransition(async () => {
      const res = await getOrderForReprint(orderId, currentUser);
      if (res.success && res.order) {
        // Trigger thermal print
        triggerSilentThermalPrint({
          orderNumber: res.order.orderNumber,
          orderType: res.order.orderType,
          tableName: res.order.table?.name || (res.order.orderType === "DELIVERY" ? "طلب دليفري" : "تيك أواي"),
          customerName: res.order.customerName || res.order.customer?.name || undefined,
          customerPhone: res.order.customerPhone || res.order.customer?.phone || undefined,
          deliveryAddress: res.order.deliveryAddress || res.order.customer?.address || undefined,
          deliveryFee: res.order.deliveryFee || undefined,
          items: (res.order.items || []).map((i: any) => ({
            nameAr: i.menuItem?.nameAr || "صنف",
            quantity: i.quantity,
            price: i.unitPrice,
            notes: i.notes,
          })),
          subtotal: res.order.subtotal,
          discount: res.order.discount || undefined,
          totalAmount: res.order.totalAmount,
          paymentMethod: res.order.paymentMethod || undefined,
          cashierName: currentUser,
          timestamp: new Date(res.order.createdAt),
          receiptType: "REPRINT",
          title: "فاتورة إعادة طباعة (REPRINT)",
        });

        setFeedback({
          type: "success",
          text: `تم إرسال إعادة طباعة الطلب #${res.order.orderNumber} للطابعة الحرارية ✓`,
        });
      } else {
        setFeedback({
          type: "error",
          text: res.error || "فشل جلب بيانات الطلب للطباعة",
        });
      }
    });
  };

  // Submit Manager Approval Action
  const handleSubmitManagerAction = async () => {
    if (!selectedOrder) return;
    if (!actionReason.trim()) {
      alert("يرجى إدخال سبب العملية (إلزامي للرقابة والتدقيق)");
      return;
    }
    if (!managerPassword.trim()) {
      alert("يرجى إدخال كلمة مرور أو PIN المدير للاعتماد");
      return;
    }

    startTransition(async () => {
      if (actionModalType === "HOSPITALITY") {
        const res = await applyHospitalityWithManagerApproval({
          orderId: selectedOrder.id,
          orderItemId: targetItemId || undefined,
          type: hospitalityType,
          amount: parseFloat(hospitalityDiscountAmount) || undefined,
          reason: actionReason,
          cashierName: currentUser,
          managerUsername,
          managerPassword,
        });

        if (res.success) {
          setFeedback({ type: "success", text: res.message || "تم اعتماد بند الضيافة بنجاح ✓" });
          setActionModalType(null);
          setActionReason("");
          setManagerPassword("");
          handleSearch();
          setSelectedOrder(null);
        } else {
          setFeedback({ type: "error", text: res.error || "فشل اعتماد الضيافة" });
        }
      } else {
        // VOID ITEM or CANCEL FULL ORDER
        const res = await cancelOrVoidWithManagerApproval({
          orderId: selectedOrder.id,
          actionType: actionModalType === "VOID_ITEM" ? "VOID_ORDER_ITEM" : "CANCEL_FULL_ORDER",
          orderItemId: targetItemId || undefined,
          reason: actionReason,
          cashierName: currentUser,
          managerUsername,
          managerPassword,
        });

        if (res.success) {
          setFeedback({ type: "success", text: res.message || "تم اعتماد العملية بنجاح ✓" });
          setActionModalType(null);
          setActionReason("");
          setManagerPassword("");
          handleSearch();
          setSelectedOrder(null);
        } else {
          setFeedback({ type: "error", text: res.error || "فشل تنفيذ العملية" });
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 font-sans" dir="rtl">
      <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-[#1F2937]">
        
        {/* HEADER */}
        <div className="p-4 sm:px-6 bg-[#243B53] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1A2C3F] border border-[#334E68] text-[#FDE68A] flex items-center justify-center text-xl shadow">
              🔍
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                بحث سريع عن الطلبات والفواتير (POS Order Search)
              </h2>
              <p className="text-[11px] text-[#D9E2EC] font-medium">
                بحث شامل برقم الفاتورة، هاتف العميل المصري (010, 011, 012, 015, +20)، اسم العميل، والطيار
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#1A2C3F] hover:bg-[#102A43] text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 ${
              feedback.type === "success"
                ? "bg-[#EBF7F0] border-b border-[#A7F3D0] text-[#237A57]"
                : "bg-[#FEF2F2] border-b border-[#FCA5A5] text-[#B42318]"
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-[#5B6472] hover:text-[#1F2937] text-xs">
              ✕
            </button>
          </div>
        )}

        {/* SEARCH BAR & FILTERS */}
        <div className="p-3 bg-[#F4F6F8] border-b border-[#D9E0E7] grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs shrink-0">
          <div className="sm:col-span-2">
            <input
              type="text"
              placeholder="اكتب رقم الفاتورة (#123)، هاتف العميل، اسم العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#1F2937] outline-none focus:border-[#243B53] text-xs"
              autoFocus
            />
          </div>

          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-2.5 py-2 text-[#1F2937] outline-none focus:border-[#243B53] text-xs"
            >
              <option value="ALL">كل القنوات (صالة / سفري / دليفري / شوي)</option>
              <option value="DINE_IN">صالة</option>
              <option value="TAKEAWAY">تيك أواي (سفري)</option>
              <option value="DELIVERY">دليفري (توصيل)</option>
              <option value="CUSTOMER_GRILL">شوي للغير (خامة العميل)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-2 py-2 text-[#1F2937] outline-none focus:border-[#243B53] text-xs"
            >
              <option value="ALL">كل الحالات</option>
              <option value="PAID">مسدد</option>
              <option value="OPEN">مفتوح / غير مسدد</option>
              <option value="CANCELLED">ملغي</option>
            </select>

            <button
              onClick={handleSearch}
              disabled={isPending}
              className="px-4 py-2 bg-[#243B53] hover:bg-[#1A2C3F] text-white font-black rounded-xl text-xs transition shadow-sm"
            >
              بحث
            </button>
          </div>
        </div>

        {/* RESULTS LIST & DETAILS SPLIT */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[#D9E0E7]">
          
          {/* LEFT: RESULTS LIST */}
          <div className="overflow-y-auto p-3 space-y-2 bg-[#F8FAFC]">
            <p className="text-[10px] text-[#5B6472] px-1 font-bold">
              نتائج البحث ({totalFound} طلب تم العثور عليه):
            </p>

            {results.length === 0 ? (
              <div className="text-center py-12 text-[#94A3B8] text-xs">
                {isPending ? "جاري البحث..." : "لا توجد طلبات مطابقة للبحث."}
              </div>
            ) : (
              results.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                const isCancelled = ord.paymentStatus === "CANCELLED";

                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`p-3 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? "bg-[#FFFFFF] border-2 border-[#243B53] shadow-md"
                        : "bg-[#FFFFFF] border-[#D9E0E7] hover:border-[#CBD5E1]"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#E2E8F0]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-[#243B53] text-sm">
                          #{ord.orderNumber}
                        </span>
                        <span className="bg-[#F0F4F8] text-[#243B53] px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {ord.orderTypeAr}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                          isCancelled
                            ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#B42318]"
                            : ord.paymentStatus === "PAID"
                            ? "bg-[#EBF7F0] border-[#A7F3D0] text-[#237A57]"
                            : "bg-[#FFFBEB] border-[#FDE68A] text-[#946200]"
                        }`}
                      >
                        {ord.paymentStatusAr}
                      </span>
                    </div>

                    <div className="pt-2 text-xs flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[#1F2937] text-xs">
                          {ord.customerName || ord.tableName || "عميل بدون اسم"}
                        </p>
                        {ord.customerPhone && (
                          <p className="font-mono text-[11px] text-[#3B82A0] mt-0.5">
                            {ord.customerPhone}
                          </p>
                        )}
                        <p className="text-[10px] text-[#5B6472] font-mono mt-0.5">
                          {ord.createdAtFormatted}
                        </p>
                      </div>

                      <div className="text-left">
                        <p className="font-mono font-black text-[#1F2937] text-sm">
                          {ord.totalAmount.toFixed(2)} ج.م
                        </p>
                        <p className="text-[10px] text-[#5B6472] mt-0.5">
                          {ord.items.length} أصناف
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* RIGHT: SELECTED ORDER FULL DETAILS & ACTIONS */}
          <div className="overflow-y-auto p-4 flex flex-col justify-between bg-[#FFFFFF]">
            {selectedOrder ? (
              <div className="space-y-4">
                
                {/* Details Header */}
                <div className="bg-[#F8FAFC] border border-[#D9E0E7] rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-[#243B53] text-lg">
                        طلب #{selectedOrder.orderNumber}
                      </span>
                      <span className="bg-[#F0F4F8] text-[#243B53] text-xs px-2 py-0.5 rounded-lg font-bold">
                        {selectedOrder.orderTypeAr}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {selectedOrder.reprintCount > 0 && (
                        <span className="text-[10px] bg-[#E2E8F0] text-[#5B6472] px-2 py-0.5 rounded-md font-mono">
                          طُبع {selectedOrder.reprintCount} مرة
                        </span>
                      )}
                      <span
                        className={`text-xs font-black px-2.5 py-0.5 rounded-lg border ${
                          selectedOrder.paymentStatus === "CANCELLED"
                            ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#B42318]"
                            : selectedOrder.paymentStatus === "PAID"
                            ? "bg-[#EBF7F0] border-[#A7F3D0] text-[#237A57]"
                            : "bg-[#FFFBEB] border-[#FDE68A] text-[#946200]"
                        }`}
                      >
                        {selectedOrder.paymentStatusAr}
                      </span>
                    </div>
                  </div>

                  {/* Customer / Rider Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <p className="text-[10px] text-[#5B6472]">اسم العميل:</p>
                      <p className="font-bold text-[#1F2937]">{selectedOrder.customerName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#5B6472]">رقم الهاتف:</p>
                      <p className="font-mono font-bold text-[#3B82A0]">{selectedOrder.customerPhone || "—"}</p>
                    </div>
                    {selectedOrder.deliveryAddress && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-[#5B6472]">عنوان التوصيل:</p>
                        <p className="text-[#1F2937]">{selectedOrder.deliveryAddress}</p>
                      </div>
                    )}
                    {selectedOrder.riderName && (
                      <div className="col-span-2 bg-[#EBF7F0] p-2 rounded-xl border border-[#A7F3D0] flex justify-between items-center text-[#237A57]">
                        <span>الطيار المسؤول: <b>{selectedOrder.riderName}</b></span>
                        <span className="font-mono">
                          العهدة: {selectedOrder.riderCashDue} ج.م (مورد: {selectedOrder.riderCashRemitted} ج.م)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items List with Individual VOID option */}
                <div className="bg-[#F8FAFC] border border-[#D9E0E7] rounded-2xl p-3.5 space-y-2">
                  <p className="text-xs font-bold text-[#1F2937]">محتويات الفاتورة والأصناف:</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedOrder.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between bg-[#FFFFFF] p-2 rounded-xl border border-[#D9E0E7] text-xs shadow-sm"
                      >
                        <div>
                          <p className="font-bold text-[#1F2937]">
                            {it.quantity}x {it.nameAr}
                          </p>
                          <p className="text-[10px] text-[#5B6472] font-mono">
                            {it.unitPrice.toFixed(2)} ج.م للواحد
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-[#237A57] text-xs">
                            {it.totalPrice.toFixed(2)} ج.م
                          </span>

                          {/* Cashier can request void item -> opens Manager Approval */}
                          {selectedOrder.paymentStatus !== "CANCELLED" && (
                            <button
                              onClick={() => {
                                setTargetItemId(it.id);
                                setActionModalType("VOID_ITEM");
                                setActionReason("");
                              }}
                              className="px-2 py-0.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] text-[#B42318] rounded-lg text-[10px] font-bold transition"
                              title="حذف صنف باعتماد المدير"
                            >
                              حذف صنف
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="pt-2 border-t border-[#D9E0E7] space-y-1 text-xs">
                    <div className="flex justify-between text-[#5B6472]">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono">{selectedOrder.subtotal.toFixed(2)} ج.م</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-[#B42318] font-bold">
                        <span>الخصم / الضيافة:</span>
                        <span className="font-mono">-{selectedOrder.discount.toFixed(2)} ج.م</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#1F2937] font-black text-sm pt-1 border-t border-[#D9E0E7]">
                      <span>إجمالي الفاتورة:</span>
                      <span className="font-mono text-[#237A57] text-base">{selectedOrder.totalAmount.toFixed(2)} ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Manager Action Buttons */}
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* 1. Reprint Receipt (No manager required) */}
                    <button
                      onClick={() => handleReprintOrder(selectedOrder.id)}
                      disabled={isPending}
                      className="px-3 py-2.5 bg-[#F0F4F8] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#243B53] font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <span>🖨️</span>
                      <span>إعادة طباعة الفاتورة</span>
                    </button>

                    {/* 2. Apply Hospitality (Manager approved) */}
                    <button
                      onClick={() => {
                        setActionModalType("HOSPITALITY");
                        setTargetItemId(null);
                        setActionReason("");
                      }}
                      disabled={selectedOrder.paymentStatus === "CANCELLED"}
                      className="px-3 py-2.5 bg-[#FAF5FF] hover:bg-[#F3E8FF] border border-[#E9D5FF] text-[#7E22CE] font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <span>🎁</span>
                      <span>بند ضيافة / عزومة</span>
                    </button>
                  </div>

                  {/* 3. Cancel Entire Order (Manager approved) */}
                  {selectedOrder.paymentStatus !== "CANCELLED" && (
                    <button
                      onClick={() => {
                        setActionModalType("CANCEL_ORDER");
                        setTargetItemId(null);
                        setActionReason("");
                      }}
                      className="w-full px-3 py-2.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] text-[#B42318] font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <span>🛑</span>
                      <span>إلغاء الفاتورة بالكامل (اعتماد المدير)</span>
                    </button>
                  )}
                </div>

              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-[#94A3B8] text-xs">
                اختر طلباً من القائمة لعرض تفاصيله وإجراءات الطباعة أو الإلغاء
              </div>
            )}
          </div>
        </div>

        {/* MODAL: MANAGER APPROVAL (VOID ITEM / CANCEL ORDER / HOSPITALITY) */}
        {actionModalType && selectedOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-2">
                <h3 className="font-black text-[#243B53] text-sm flex items-center gap-2">
                  <span>🔒</span>
                  <span>
                    {actionModalType === "VOID_ITEM"
                      ? `حذف صنف من الطلب #${selectedOrder.orderNumber}`
                      : actionModalType === "CANCEL_ORDER"
                      ? `إلغاء الطلب #${selectedOrder.orderNumber} بالكامل`
                      : `اعتماد بند ضيافة/عزومة للطلب #${selectedOrder.orderNumber}`}
                  </span>
                </h3>
                <button
                  onClick={() => setActionModalType(null)}
                  className="text-[#5B6472] hover:text-[#1F2937] text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Hospitality specific options */}
              {actionModalType === "HOSPITALITY" && (
                <div className="space-y-2 bg-[#FAF5FF] p-3 rounded-2xl border border-[#E9D5FF] text-xs">
                  <label className="block text-[11px] font-bold text-[#7E22CE]">نوع الضيافة:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setHospitalityType("FULL")}
                      className={`p-2 rounded-xl text-xs font-bold border transition ${
                        hospitalityType === "FULL"
                          ? "bg-[#7E22CE] text-white border-[#7E22CE]"
                          : "bg-[#FFFFFF] text-[#1F2937] border-[#D9E0E7]"
                      }`}
                    >
                      عزومة كاملة (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHospitalityType("DISCOUNT")}
                      className={`p-2 rounded-xl text-xs font-bold border transition ${
                        hospitalityType === "DISCOUNT"
                          ? "bg-[#7E22CE] text-white border-[#7E22CE]"
                          : "bg-[#FFFFFF] text-[#1F2937] border-[#D9E0E7]"
                      }`}
                    >
                      خصم جزئي معتمد
                    </button>
                  </div>

                  {hospitalityType === "DISCOUNT" && (
                    <div className="pt-2">
                      <label className="block text-[10px] text-[#5B6472] mb-1">
                        قيمة الخصم المعتمد (ج.م):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={hospitalityDiscountAmount}
                        onChange={(e) => setHospitalityDiscountAmount(e.target.value)}
                        placeholder="أدخل المبلغ..."
                        className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-3 py-1.5 text-[#1F2937] font-mono text-xs outline-none focus:border-[#7E22CE]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#1F2937]">
                  سبب الإجراء (إلزامي للتدقيق والرقابة المالية): *
                </label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="مثال: خطأ في إدخال الصنف، تعويض عميل، قرار إداري..."
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
                  autoFocus
                />
              </div>

              {/* Manager Credentials */}
              <div className="space-y-2 bg-[#F8FAFC] p-3 rounded-2xl border border-[#D9E0E7] text-xs">
                <p className="text-[11px] font-bold text-[#243B53] flex items-center gap-1">
                  <span>🛡️</span>
                  <span>اعتماد المدير المسؤول (Server-Side Verification):</span>
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#5B6472] mb-0.5">اسم المدير:</label>
                    <input
                      type="text"
                      value={managerUsername}
                      onChange={(e) => setManagerUsername(e.target.value)}
                      placeholder="admin أو basiouny"
                      className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-2.5 py-1.5 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#5B6472] mb-0.5">كلمة مرور المدير / PIN:</label>
                    <input
                      type="password"
                      value={managerPassword}
                      onChange={(e) => setManagerPassword(e.target.value)}
                      placeholder="كلمة المرور..."
                      className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-2.5 py-1.5 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSubmitManagerAction}
                  disabled={isPending}
                  className="flex-1 bg-[#B42318] hover:bg-[#991B1B] text-white font-black py-2.5 rounded-xl text-xs transition shadow-md"
                >
                  ✓ تأكيد وتنفيذ العملية
                </button>
                <button
                  onClick={() => setActionModalType(null)}
                  className="px-4 py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#5B6472] rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
