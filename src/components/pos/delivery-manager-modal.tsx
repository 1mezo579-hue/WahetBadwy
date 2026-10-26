"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getDeliveryOrders,
  assignRiderToOrder,
  updateDeliveryStatus,
  recordRiderRemittance,
  getRiderLedgerSummary,
  getActiveRidersList,
  RiderLedgerItem,
} from "@/actions/delivery";

interface DeliveryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: string;
  userRole?: string;
}

export default function DeliveryManagerModal({
  isOpen,
  onClose,
  currentUser = "الكاشير",
  userRole = "CASHIER",
}: DeliveryManagerModalProps) {
  const [activeTab, setActiveTab] = useState<"ORDERS" | "LEDGER">("ORDERS");
  const [isPending, startTransition] = useTransition();

  // Orders Tab State
  const [orders, setOrders] = useState<any[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterRider, setFilterRider] = useState<string>("ALL");
  const [filterRemittance, setFilterRemittance] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("ALL");
  const [availableRiders, setAvailableRiders] = useState<string[]>([]);

  // Assign Rider Modal State
  const [assignModalOrder, setAssignModalOrder] = useState<any | null>(null);
  const [selectedRiderToAssign, setSelectedRiderToAssign] = useState("");
  const [customRiderInput, setCustomRiderInput] = useState("");

  // Ledger Tab State
  const [ledgerRiders, setLedgerRiders] = useState<RiderLedgerItem[]>([]);
  const [ledgerTotals, setLedgerTotals] = useState({
    totalPendingDebt: 0,
    totalRemittedToday: 0,
    activeRidersCount: 0,
    unsettledOrdersCount: 0,
  });

  // Remittance Modal State
  const [showRemittanceModal, setShowRemittanceModal] = useState(false);
  const [remittanceTargetRider, setRemittanceTargetRider] = useState<string>("");
  const [remittanceAmount, setRemittanceAmount] = useState<string>("");
  const [remittanceSelectedOrders, setRemittanceSelectedOrders] = useState<string[]>([]);
  const [remittanceVarianceReason, setRemittanceVarianceReason] = useState("");
  const [remittanceNotes, setRemittanceNotes] = useState("");
  const [remittanceTargetOrdersList, setRemittanceTargetOrdersList] = useState<any[]>([]);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load Initial Data
  const refreshOrders = () => {
    startTransition(async () => {
      const res = await getDeliveryOrders({
        status: filterStatus,
        riderName: filterRider,
        remittanceStatus: filterRemittance,
        paymentMethod: filterPaymentMethod,
        query: searchQuery,
        limit: 100,
      });
      if (res.success) {
        setOrders(res.orders);
        setTotalOrders(res.totalOrders);
      }
    });
  };

  const refreshLedger = () => {
    startTransition(async () => {
      const res = await getRiderLedgerSummary();
      if (res.success) {
        setLedgerRiders(res.riders);
        setLedgerTotals(res.totals);
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      getActiveRidersList().then(setAvailableRiders).catch(console.error);
      if (activeTab === "ORDERS") {
        refreshOrders();
      } else {
        refreshLedger();
      }
    }
  }, [isOpen, activeTab, filterStatus, filterRider, filterRemittance, filterPaymentMethod]);

  if (!isOpen) return null;

  // Handle Assign Rider
  const handleConfirmAssignRider = async () => {
    if (!assignModalOrder) return;
    const finalRiderName = (customRiderInput.trim() || selectedRiderToAssign.trim());
    if (!finalRiderName) {
      setFeedback({ type: "error", text: "يرجى اختيار أو كتابة اسم الطيار" });
      return;
    }

    startTransition(async () => {
      const res = await assignRiderToOrder({
        orderId: assignModalOrder.id,
        riderName: finalRiderName,
        cashierName: currentUser,
      });

      if (res.success) {
        setFeedback({ type: "success", text: res.message || "تم إسناد الطلب للطيار بنجاح ✓" });
        setAssignModalOrder(null);
        setSelectedRiderToAssign("");
        setCustomRiderInput("");
        refreshOrders();
        refreshLedger();
      } else {
        setFeedback({ type: "error", text: res.error || "فشل إسناد الطلب للطيار" });
      }
    });
  };

  // Handle Update Status
  const handleQuickStatusChange = async (orderId: string, newStatus: string) => {
    startTransition(async () => {
      const res = await updateDeliveryStatus({
        orderId,
        status: newStatus as any,
        cashierName: currentUser,
      });
      if (res.success) {
        setFeedback({ type: "success", text: res.message || "تم إسناد الطلب للطيار بنجاح ✓" });
        refreshOrders();
        refreshLedger();
      } else {
        setFeedback({ type: "error", text: res.error || "فشل تحديث الحالة" });
      }
    });
  };

  // Open Remittance for specific rider
  const handleOpenRemittanceForRider = (riderName: string, preselectedOrderId?: string) => {
    setRemittanceTargetRider(riderName);
    const riderItem = ledgerRiders.find((r) => r.riderName.toLowerCase() === riderName.toLowerCase());
    const ordersList = riderItem ? riderItem.unsettledOrders : [];
    setRemittanceTargetOrdersList(ordersList);

    if (preselectedOrderId) {
      setRemittanceSelectedOrders([preselectedOrderId]);
      const targetOrd = ordersList.find((o) => o.orderId === preselectedOrderId);
      setRemittanceAmount(targetOrd ? targetOrd.pendingAmount.toString() : "");
    } else {
      setRemittanceSelectedOrders(ordersList.map((o) => o.orderId));
      const totalPending = ordersList.reduce((sum, o) => sum + o.pendingAmount, 0);
      setRemittanceAmount(totalPending > 0 ? totalPending.toString() : "");
    }

    setRemittanceVarianceReason("");
    setRemittanceNotes("");
    setShowRemittanceModal(true);
  };

  // Submit Remittance
  const handleConfirmRemittance = async () => {
    const amt = parseFloat(remittanceAmount);
    if (isNaN(amt) || amt <= 0) {
      setFeedback({ type: "error", text: "يرجى إدخال مبلغ صحيح أكبر من الصفر." });
      return;
    }

    startTransition(async () => {
      const res = await recordRiderRemittance({
        riderName: remittanceTargetRider,
        amountReceived: amt,
        orderIds: remittanceSelectedOrders,
        paymentMethod: "CASH",
        varianceReason: remittanceVarianceReason,
        notes: remittanceNotes,
        cashierName: currentUser,
      });

      if (res.success) {
        setFeedback({ type: "success", text: res.message || "تم إسناد الطلب للطيار بنجاح ✓" });
        setShowRemittanceModal(false);
        refreshOrders();
        refreshLedger();
      } else {
        setFeedback({ type: "error", text: res.error || "فشل تسجيل التوريد" });
      }
    });
  };

  // Calculate live expected for selected remittance orders
  const selectedOrdersTotalDue = remittanceTargetOrdersList
    .filter((o) => remittanceSelectedOrders.includes(o.orderId))
    .reduce((sum, o) => sum + o.pendingAmount, 0);
  const currentVariance = (parseFloat(remittanceAmount) || 0) - selectedOrdersTotalDue;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <div className="bg-[#0e1320] border border-[#1e2842] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-stone-100">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:px-6 bg-[#0a0e1a] border-b border-[#1c2438] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center text-xl shadow-lg">
              🛵
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-amber-400">
                إدارة طلبات الدليفري ودفتر عهدة الطيارين
              </h2>
              <p className="text-[11px] text-stone-400 font-medium">
                مشويات بسيوني — تتبع دورة الطلب والتسويات المالية المعلقة للكاشير
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs switcher */}
            <div className="bg-[#121829] p-1 rounded-2xl border border-stone-800 flex items-center gap-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab("ORDERS")}
                className={`px-3 py-1.5 rounded-xl transition ${
                  activeTab === "ORDERS"
                    ? "bg-amber-500 text-stone-950 font-black shadow-md shadow-amber-500/20"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                📋 طلبات الدليفري ({totalOrders})
              </button>
              <button
                onClick={() => setActiveTab("LEDGER")}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  activeTab === "LEDGER"
                    ? "bg-teal-500 text-stone-950 font-black shadow-md shadow-teal-500/20"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                <span>💼 عهدة الطيارين</span>
                {ledgerTotals.totalPendingDebt > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {ledgerTotals.totalPendingDebt.toFixed(0)} ج.م
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#161f36] hover:bg-stone-700 text-stone-300 flex items-center justify-center text-sm font-bold transition mr-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 ${
              feedback.type === "success"
                ? "bg-emerald-500/15 border-b border-emerald-500/40 text-emerald-300"
                : "bg-rose-500/15 border-b border-rose-500/40 text-rose-300"
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: DELIVERY ORDERS */}
        {activeTab === "ORDERS" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Filter Bar */}
            <div className="p-3 bg-[#111728] border-b border-[#1c2438] grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs shrink-0">
              {/* Search */}
              <div className="col-span-2 sm:col-span-1">
                <input
                  type="text"
                  placeholder="بحث برقم الطلب، العميل، الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && refreshOrders()}
                  className="w-full bg-[#0b0f19] border border-stone-700 rounded-xl px-3 py-1.5 text-stone-100 outline-none focus:border-amber-500 text-xs"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-stone-700 rounded-xl px-2.5 py-1.5 text-stone-200 outline-none focus:border-amber-500 text-xs"
                >
                  <option value="ALL">كل الحالات</option>
                  <option value="NEW">جديد</option>
                  <option value="IN_KITCHEN">قيد التجهيز</option>
                  <option value="READY">جاهز للتسليم</option>
                  <option value="WITH_RIDER">مع الطيار</option>
                  <option value="DELIVERED">تم التسليم</option>
                  <option value="CANCELLED">ملغي</option>
                </select>
              </div>

              {/* Rider Filter */}
              <div>
                <select
                  value={filterRider}
                  onChange={(e) => setFilterRider(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-stone-700 rounded-xl px-2.5 py-1.5 text-stone-200 outline-none focus:border-amber-500 text-xs"
                >
                  <option value="ALL">كل الطيارين</option>
                  {availableRiders.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remittance Filter */}
              <div>
                <select
                  value={filterRemittance}
                  onChange={(e) => setFilterRemittance(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-stone-700 rounded-xl px-2.5 py-1.5 text-stone-200 outline-none focus:border-amber-500 text-xs"
                >
                  <option value="ALL">كل حالات التوريد</option>
                  <option value="PENDING">معلق مع الطيار</option>
                  <option value="PARTIAL">توريد جزئي</option>
                  <option value="REMITTED">تم التوريد للدرج</option>
                  <option value="NOT_APPLICABLE">مدفوع إلكتروني</option>
                </select>
              </div>

              {/* Refresh Button */}
              <button
                onClick={refreshOrders}
                disabled={isPending}
                className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold rounded-xl px-3 py-1.5 transition text-xs flex items-center justify-center gap-1"
              >
                <span>🔄</span>
                <span>تحديث</span>
              </button>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  لا توجد طلبات دليفري مطابقة للفلاتر المحددة حالياً.
                </div>
              ) : (
                orders.map((ord) => {
                  const isWithRider = ord.deliveryStatus === "WITH_RIDER";
                  const isDelivered = ord.deliveryStatus === "DELIVERED";
                  const isCancelled = ord.workflowStatus === "CANCELLED";
                  const isPendingRemittance = ord.remittanceStatus === "PENDING" || ord.remittanceStatus === "PARTIAL";

                  return (
                    <div
                      key={ord.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition ${
                        isCancelled
                          ? "bg-rose-950/20 border-rose-900/40 opacity-75"
                          : isDelivered && !isPendingRemittance
                          ? "bg-[#111726]/60 border-emerald-900/40"
                          : isWithRider
                          ? "bg-[#131d33] border-teal-500/40 shadow-md shadow-teal-500/5"
                          : "bg-[#111726] border-[#1d273f]"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-stone-800/80">
                        {/* Order Number & Customer Info */}
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-amber-400 text-base bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                            #{ord.orderNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-stone-100 text-sm">{ord.customerName}</h4>
                              <span className="font-mono text-xs text-sky-400">{ord.customerPhone}</span>
                            </div>
                            <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                              <span>📍</span>
                              <span>{ord.deliveryAddress}</span>
                            </p>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Workflow status */}
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${
                              isCancelled
                                ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                                : isDelivered
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                : isWithRider
                                ? "bg-teal-500/20 border-teal-500/50 text-teal-300 animate-pulse"
                                : ord.deliveryStatus === "READY"
                                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                : "bg-sky-500/20 border-sky-500/50 text-sky-300"
                            }`}
                          >
                            {isCancelled
                              ? "ملغي"
                              : isDelivered
                              ? "تم التسليم للعميل"
                              : isWithRider
                              ? "مع الطيار للتوصيل"
                              : ord.deliveryStatus === "READY"
                              ? "جاهز للتسليم / وصل للكاشير"
                              : ord.deliveryStatus === "IN_KITCHEN"
                              ? "قيد التحضير بالمطبخ"
                              : "طلب جديد"}
                          </span>

                          {/* Remittance Status Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              ord.remittanceStatus === "REMITTED"
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                : ord.remittanceStatus === "NOT_APPLICABLE"
                                ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                                : ord.remittanceStatus === "PARTIAL"
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                : "bg-rose-500/15 border-rose-500/40 text-rose-300"
                            }`}
                          >
                            {ord.remittanceStatus === "REMITTED"
                              ? "✓ تم توريد المبلغ للدرج"
                              : ord.remittanceStatus === "NOT_APPLICABLE"
                              ? "💳 مدفوع إلكتروني"
                              : ord.remittanceStatus === "PARTIAL"
                              ? `⚠️ توريد جزئي (باقي ${ord.pendingRiderDebt} ج.م)`
                              : `⏳ عهدة معلقة مع الطيار (${ord.riderCashDue} ج.م)`}
                          </span>
                        </div>
                      </div>

                      {/* Items & Financial Details */}
                      <div className="py-2.5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {/* Items list */}
                        <div className="md:col-span-2 space-y-1">
                          <p className="text-[10px] text-stone-500 font-bold">الأصناف المطلوبة:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ord.items.map((it: any, i: number) => (
                              <span
                                key={i}
                                className="bg-[#182033] px-2 py-0.5 rounded-md text-[11px] text-stone-200 border border-stone-800"
                              >
                                {it.quantity}x {it.nameAr}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Financial figures */}
                        <div className="bg-[#0b0f19] p-2.5 rounded-xl border border-stone-800/80 flex flex-col justify-between text-[11px]">
                          <div className="flex justify-between text-stone-400">
                            <span>إجمالي الفاتورة:</span>
                            <span className="font-mono font-bold text-white">{ord.totalAmount} ج.م</span>
                          </div>
                          <div className="flex justify-between text-stone-400 mt-1">
                            <span>طريقة الدفع:</span>
                            <span className="font-bold text-amber-300">
                              {ord.paymentMethod === "CARD" ? "فيزا / شبكة" : ord.paymentMethod === "WALLET" ? "محفظة" : "نقدي عند الاستلام"}
                            </span>
                          </div>
                          <div className="flex justify-between text-teal-300 font-bold mt-1 pt-1 border-t border-stone-800">
                            <span>الطيار:</span>
                            <span>{ord.riderName || "لم يتم التحديد"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Bar */}
                      <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
                        {/* Time & History */}
                        <div className="text-[10px] text-stone-500 font-mono">
                          تسجيل: {new Date(ord.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                          {ord.expectedPickupTime && ` • موعد متوقع: ${ord.expectedPickupTime}`}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Assign Rider Button */}
                          <button
                            onClick={() => {
                              setAssignModalOrder(ord);
                              setSelectedRiderToAssign(ord.riderName || availableRiders[0] || "");
                            }}
                            className="px-2.5 py-1 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-bold text-[11px] transition flex items-center gap-1"
                          >
                            <span>🛵</span>
                            <span>{ord.riderName ? "تغيير الطيار" : "إسناد طيار"}</span>
                          </button>

                          {/* Quick Status Progression */}
                          {ord.deliveryStatus === "NEW" && (
                            <button
                              onClick={() => handleQuickStatusChange(ord.id, "IN_KITCHEN")}
                              className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-[11px]"
                            >
                              👨‍🍳 إرسال للمطبخ
                            </button>
                          )}
                          {ord.deliveryStatus === "IN_KITCHEN" && (
                            <button
                              onClick={() => handleQuickStatusChange(ord.id, "READY")}
                              className="px-2.5 py-1 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-bold text-[11px]"
                            >
                              ✓ جاهز عند الكاشير
                            </button>
                          )}
                          {(ord.deliveryStatus === "READY" || ord.deliveryStatus === "NEW") && ord.riderName && (
                            <button
                              onClick={() => handleQuickStatusChange(ord.id, "WITH_RIDER")}
                              className="px-2.5 py-1 rounded-xl bg-teal-500/25 hover:bg-teal-500/40 border border-teal-500/50 text-teal-300 font-bold text-[11px]"
                            >
                              🚀 تسليم للطيار
                            </button>
                          )}
                          {ord.deliveryStatus === "WITH_RIDER" && (
                            <button
                              onClick={() => handleQuickStatusChange(ord.id, "DELIVERED")}
                              className="px-2.5 py-1 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 font-bold text-[11px]"
                            >
                              📦 تأكيد تسليم العميل
                            </button>
                          )}

                          {/* Direct Remittance Button if debt pending */}
                          {isPendingRemittance && ord.riderName && (
                            <button
                              onClick={() => handleOpenRemittanceForRider(ord.riderName, ord.id)}
                              className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-black text-[11px] shadow-md shadow-amber-500/20"
                            >
                              💵 توريد {ord.pendingRiderDebt} ج.م للكاشير
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: RIDER CASH LEDGER (دفتر عهدة الطيارين) */}
        {activeTab === "LEDGER" && (
          <div className="flex-1 overflow-hidden flex flex-col p-3 sm:p-5 space-y-4">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div className="bg-[#141b2d] border border-rose-500/30 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-stone-400">عهدة معلقة مع الطيارين حالياً</p>
                <p className="font-mono font-black text-rose-400 text-lg mt-0.5">
                  {ledgerTotals.totalPendingDebt.toFixed(2)} ج.م
                </p>
                <p className="text-[9px] text-stone-500">مديونية تشغيلية خارج الدرج</p>
              </div>

              <div className="bg-[#141b2d] border border-emerald-500/30 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-stone-400">نقدية وردت فعلياً لدرج الكاشير اليوم</p>
                <p className="font-mono font-black text-emerald-400 text-lg mt-0.5">
                  {ledgerTotals.totalRemittedToday.toFixed(2)} ج.م
                </p>
                <p className="text-[9px] text-stone-500">مسجلة بالخزينة والوردية</p>
              </div>

              <div className="bg-[#141b2d] border border-[#222d4a] rounded-2xl p-3 text-center">
                <p className="text-[10px] text-stone-400">الطيارون النشطون</p>
                <p className="font-mono font-black text-amber-400 text-lg mt-0.5">
                  {ledgerTotals.activeRidersCount}
                </p>
                <p className="text-[9px] text-stone-500">مسجلون بالنظام</p>
              </div>

              <div className="bg-[#141b2d] border border-[#222d4a] rounded-2xl p-3 text-center">
                <p className="text-[10px] text-stone-400">طلبات بانتظار التوريد</p>
                <p className="font-mono font-black text-sky-400 text-lg mt-0.5">
                  {ledgerTotals.unsettledOrdersCount} طلب
                </p>
                <p className="text-[9px] text-stone-500">غير مسواة مالياً</p>
              </div>
            </div>

            {/* Riders Cards List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {ledgerRiders.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  لا توجد عهد أو حركات مسجلة للطيارين حالياً.
                </div>
              ) : (
                ledgerRiders.map((rider, i) => (
                  <div
                    key={i}
                    className="bg-[#121829] border border-[#1e2740] rounded-2xl p-4 transition hover:border-[#2e3b5e] space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-lg border border-teal-500/40">
                          🛵
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-stone-100 text-base">{rider.riderName}</h3>
                            <span className="bg-[#1a233a] text-stone-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {rider.totalOrdersCount} إجمالي الطلبات
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-400">
                            {rider.activeOrdersCount} طلب جاري • {rider.deliveredOrdersCount} تم تسليمه
                          </p>
                        </div>
                      </div>

                      {/* Rider Ledger Numbers */}
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="text-right">
                          <p className="text-[10px] text-stone-500">مطلوب تحصيله</p>
                          <p className="font-bold text-stone-300">{rider.totalCashDue.toFixed(2)} ج.م</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-stone-500">تم توريده للدرج</p>
                          <p className="font-bold text-emerald-400">+{rider.totalCashRemitted.toFixed(2)} ج.م</p>
                        </div>
                        <div className="text-right bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-xl">
                          <p className="text-[10px] text-rose-300 font-bold">المتبقي معه (عهدة)</p>
                          <p className="font-black text-rose-400 text-sm">
                            {rider.pendingCashDebt.toFixed(2)} ج.م
                          </p>
                        </div>

                        {/* Remittance Button */}
                        <button
                          onClick={() => handleOpenRemittanceForRider(rider.riderName)}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-black rounded-xl text-xs transition shadow-md shadow-amber-500/20"
                        >
                          💵 تسجيل توريد نقدية
                        </button>
                      </div>
                    </div>

                    {/* Unsettled Orders for this Rider */}
                    {rider.unsettledOrders.length > 0 && (
                      <div className="bg-[#0b0f19] p-3 rounded-xl border border-stone-800/80 space-y-2">
                        <p className="text-[11px] font-bold text-amber-400 flex items-center justify-between">
                          <span>الطلبات غير المسواة معلقة مع الطيار ({rider.unsettledOrders.length} طلب):</span>
                          <span className="text-[10px] text-stone-400">المبلغ معلق حتى استلام الكاشير</span>
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {rider.unsettledOrders.map((ord, idx) => (
                            <div
                              key={idx}
                              className="bg-[#141b2c] p-2.5 rounded-lg border border-stone-800 text-xs flex flex-col justify-between"
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className="font-mono text-amber-400">#{ord.orderNumber}</span>
                                <span className="font-mono text-rose-400 font-black">
                                  {ord.pendingAmount.toFixed(2)} ج.م معلق
                                </span>
                              </div>
                              <p className="text-[10px] text-stone-300 truncate mt-1">
                                {ord.customerName || "عميل"} • {ord.deliveryAddress || "بدون عنوان"}
                              </p>
                              <div className="mt-2 pt-1 border-t border-stone-800/60 flex items-center justify-between text-[10px]">
                                <span className="text-stone-500">
                                  {ord.deliveryStatus === "DELIVERED" ? "تم التسليم" : "مع الطيار"}
                                </span>
                                <button
                                  onClick={() => handleOpenRemittanceForRider(rider.riderName, ord.orderId)}
                                  className="text-amber-400 hover:text-amber-300 font-bold underline"
                                >
                                  توريد الطلب
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MODAL: ASSIGN RIDER */}
        {assignModalOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#121829] border border-teal-500/40 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <h3 className="font-black text-amber-400 text-sm flex items-center gap-2">
                  <span>🛵</span>
                  <span>إسناد طلب دليفري #{assignModalOrder.orderNumber} للطيار</span>
                </h3>
                <button
                  onClick={() => setAssignModalOrder(null)}
                  className="text-stone-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="bg-[#0b0f19] p-3 rounded-xl border border-stone-800 text-xs space-y-1">
                <p className="text-stone-300">
                  <span className="text-stone-500">العميل:</span> {assignModalOrder.customerName} (
                  {assignModalOrder.customerPhone})
                </p>
                <p className="text-stone-300">
                  <span className="text-stone-500">العنوان:</span> {assignModalOrder.deliveryAddress}
                </p>
                <p className="text-stone-300">
                  <span className="text-stone-500">المبلغ المطلوب تحصيله:</span>{" "}
                  <span className="font-mono font-bold text-amber-400">
                    {assignModalOrder.riderCashDue} ج.م
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-300">
                  اختر من قائمة الطيارين المعتمدين:
                </label>
                <select
                  value={selectedRiderToAssign}
                  onChange={(e) => {
                    setSelectedRiderToAssign(e.target.value);
                    setCustomRiderInput("");
                  }}
                  className="w-full bg-[#0b0f19] border border-stone-700 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-teal-500"
                >
                  <option value="">-- اختر طيار --</option>
                  {availableRiders.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <div className="pt-1">
                  <label className="block text-[10px] text-stone-400 mb-1">
                    أو كتابة اسم طيار خارجي/جديد:
                  </label>
                  <input
                    type="text"
                    value={customRiderInput}
                    onChange={(e) => {
                      setCustomRiderInput(e.target.value);
                      if (e.target.value) setSelectedRiderToAssign("");
                    }}
                    placeholder="مثال: كابتن علاء..."
                    className="w-full bg-[#0b0f19] border border-stone-700 rounded-xl px-3 py-1.5 text-stone-100 text-xs outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleConfirmAssignRider}
                  disabled={isPending}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-stone-950 font-black py-2.5 rounded-xl text-xs transition"
                >
                  ✓ تأكيد إسناد الطلب
                </button>
                <button
                  onClick={() => setAssignModalOrder(null)}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RECORD RIDER REMITTANCE (تسجيل توريد عهدة من الطيار) */}
        {showRemittanceModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#121829] border border-amber-500/40 rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💵</span>
                  <h3 className="font-black text-amber-400 text-sm">
                    تسجيل توريد عهدة نقدية من الطيار ({remittanceTargetRider})
                  </h3>
                </div>
                <button
                  onClick={() => setShowRemittanceModal(false)}
                  className="text-stone-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {/* Amount Input */}
                <div className="bg-[#0b0f19] p-3.5 rounded-2xl border border-amber-500/30">
                  <label className="block text-xs font-black text-amber-300 mb-1">
                    المبلغ المستلم فعلياً باليد لتوريده للدرج (ج.م) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={remittanceAmount}
                    onChange={(e) => setRemittanceAmount(e.target.value)}
                    placeholder="أدخل المبلغ المستلم من الطيار..."
                    className="w-full bg-[#141b2c] border border-stone-700 focus:border-amber-400 rounded-xl px-4 py-2.5 text-white font-mono text-lg font-black outline-none"
                    autoFocus
                  />

                  {/* Live Variance Calculation */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-stone-800">
                    <span className="text-stone-400">
                      المتوقع للطلبات المحددة: <b className="font-mono text-white">{selectedOrdersTotalDue.toFixed(2)} ج.م</b>
                    </span>
                    <span
                      className={`font-mono font-black ${
                        currentVariance === 0
                          ? "text-emerald-400"
                          : currentVariance < 0
                          ? "text-rose-400"
                          : "text-sky-400"
                      }`}
                    >
                      {currentVariance === 0
                        ? "✓ مطابق للمتوقع"
                        : currentVariance < 0
                        ? `عجز: ${currentVariance.toFixed(2)} ج.م`
                        : `فائض: +${currentVariance.toFixed(2)} ج.م`}
                    </span>
                  </div>
                </div>

                {/* Variance Explanation if discrepancy */}
                {currentVariance !== 0 && (
                  <div className="bg-rose-950/20 border border-rose-500/30 p-2.5 rounded-xl space-y-1">
                    <label className="block text-[11px] font-bold text-rose-300">
                      سبب وجود فرق تحصيل (عجز / زيادة):
                    </label>
                    <input
                      type="text"
                      value={remittanceVarianceReason}
                      onChange={(e) => setRemittanceVarianceReason(e.target.value)}
                      placeholder="مثال: خصم بإذن المدير، تأجيل جزء للغد، تباقي..."
                      className="w-full bg-[#0b0f19] border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs outline-none"
                    />
                  </div>
                )}

                {/* Target Orders Checkboxes */}
                {remittanceTargetOrdersList.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-stone-300">
                      <span>الطلبات التي يغطيها هذا التوريد:</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (remittanceSelectedOrders.length === remittanceTargetOrdersList.length) {
                            setRemittanceSelectedOrders([]);
                          } else {
                            setRemittanceSelectedOrders(remittanceTargetOrdersList.map((o) => o.orderId));
                          }
                        }}
                        className="text-amber-400 hover:underline text-[10px]"
                      >
                        {remittanceSelectedOrders.length === remittanceTargetOrdersList.length
                          ? "إلغاء تحديد الكل"
                          : "تحديد كل الطلبات"}
                      </button>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 bg-[#0b0f19] p-2 rounded-xl border border-stone-800">
                      {remittanceTargetOrdersList.map((ord) => {
                        const isSelected = remittanceSelectedOrders.includes(ord.orderId);
                        return (
                          <label
                            key={ord.orderId}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-[11px] border ${
                              isSelected
                                ? "bg-amber-500/15 border-amber-500/40 text-stone-100"
                                : "bg-[#121829] border-stone-800 text-stone-400 hover:text-stone-200"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRemittanceSelectedOrders([...remittanceSelectedOrders, ord.orderId]);
                                  } else {
                                    setRemittanceSelectedOrders(
                                      remittanceSelectedOrders.filter((id) => id !== ord.orderId)
                                    );
                                  }
                                }}
                                className="accent-amber-500 w-3.5 h-3.5"
                              />
                              <span className="font-mono font-bold text-amber-400">#{ord.orderNumber}</span>
                              <span className="truncate max-w-[150px]">{ord.customerName || "عميل"}</span>
                            </div>
                            <span className="font-mono font-bold text-stone-200">
                              {ord.pendingAmount.toFixed(2)} ج.م
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">ملاحظات إضافية على التوريد:</label>
                  <input
                    type="text"
                    value={remittanceNotes}
                    onChange={(e) => setRemittanceNotes(e.target.value)}
                    placeholder="أي ملاحظات تخص الوردية أو المستلم..."
                    className="w-full bg-[#0b0f19] border border-stone-800 rounded-xl px-3 py-1.5 text-stone-300 text-xs outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-stone-800 shrink-0">
                <button
                  onClick={handleConfirmRemittance}
                  disabled={isPending}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-black py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
                >
                  ✓ تأكيد استلام النقدية وإضافتها لدرج الكاشير
                </button>
                <button
                  onClick={() => setShowRemittanceModal(false)}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold"
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
