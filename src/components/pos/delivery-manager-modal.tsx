"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getDeliveryOrders,
  assignRiderToOrder,
  updateDeliveryStatus,
  recordRiderRemittance,
  getRiderLedgerSummary,
  getActiveRidersList,
  DeliveryOrderListItem,
  RiderLedgerSummary,
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
  const [isPending, startTransition] = useTransition();

  // Tabs: "ORDERS" (طلبات الدليفري) | "LEDGER" (دفتر عهدة الطيارين)
  const [activeTab, setActiveTab] = useState<"ORDERS" | "LEDGER">("ORDERS");

  // Orders State
  const [orders, setOrders] = useState<DeliveryOrderListItem[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterRider, setFilterRider] = useState<string>("ALL");
  const [filterRemittance, setFilterRemittance] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Ledger State
  const [ledgerRiders, setLedgerRiders] = useState<RiderLedgerSummary["riders"]>([]);
  const [ledgerTotals, setLedgerTotals] = useState<RiderLedgerSummary["totals"]>({
    totalPendingDebt: 0,
    totalRemittedToday: 0,
    activeRidersCount: 0,
    unsettledOrdersCount: 0,
  });

  // Available Riders
  const [availableRiders, setAvailableRiders] = useState<string[]>([]);

  // Assign Rider Modal State
  const [assignModalOrder, setAssignModalOrder] = useState<DeliveryOrderListItem | null>(null);
  const [selectedRiderToAssign, setSelectedRiderToAssign] = useState<string>("");
  const [customRiderInput, setCustomRiderInput] = useState<string>("");

  // Record Remittance Modal State
  const [showRemittanceModal, setShowRemittanceModal] = useState<boolean>(false);
  const [remittanceTargetRider, setRemittanceTargetRider] = useState<string>("");
  const [remittanceTargetOrdersList, setRemittanceTargetOrdersList] = useState<
    RiderLedgerSummary["riders"][0]["unsettledOrders"]
  >([]);
  const [remittanceSelectedOrders, setRemittanceSelectedOrders] = useState<string[]>([]);
  const [remittanceAmount, setRemittanceAmount] = useState<string>("");
  const [remittanceVarianceReason, setRemittanceVarianceReason] = useState<string>("");
  const [remittanceNotes, setRemittanceNotes] = useState<string>("");

  // Notification / Feedback banner
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load Riders
  const refreshRiders = async () => {
    const list = await getActiveRidersList();
    setAvailableRiders(list);
  };

  // Load Orders
  const refreshOrders = () => {
    startTransition(async () => {
      const res = await getDeliveryOrders({
        status: filterStatus as any,
        riderName: filterRider,
        remittanceStatus: filterRemittance as any,
        search: searchQuery,
      });
      if (res.success) {
        setOrders(res.orders);
        setTotalOrders(res.total);
      }
    });
  };

  // Load Ledger
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
      refreshRiders();
      refreshOrders();
      refreshLedger();
    }
  }, [isOpen, filterStatus, filterRider, filterRemittance]);

  if (!isOpen) return null;

  // Handle Quick Status Change
  const handleQuickStatusChange = async (orderId: string, newStatus: string) => {
    startTransition(async () => {
      const res = await updateDeliveryStatus({
        orderId,
        status: newStatus,
        cashierName: currentUser,
      });
      if (res.success) {
        setFeedback({ type: "success", text: res.message || "تم تحديث حالة التوصيل بنجاح ✓" });
        refreshOrders();
        refreshLedger();
      } else {
        setFeedback({ type: "error", text: res.error || "فشل تحديث الحالة" });
      }
    });
  };

  // Handle Assign Rider Confirm
  const handleConfirmAssignRider = async () => {
    if (!assignModalOrder) return;
    const finalRider = customRiderInput.trim() || selectedRiderToAssign.trim();
    if (!finalRider) {
      alert("يرجى اختيار أو إدخال اسم الطيار");
      return;
    }

    startTransition(async () => {
      const res = await assignRiderToOrder({
        orderId: assignModalOrder.id,
        riderName: finalRider,
        cashierName: currentUser,
      });

      if (res.success) {
        setFeedback({ type: "success", text: res.message || "تم إسناد الطلب للطيار بنجاح ✓" });
        setAssignModalOrder(null);
        setCustomRiderInput("");
        setSelectedRiderToAssign("");
        refreshOrders();
        refreshLedger();
      } else {
        setFeedback({ type: "error", text: res.error || "فشل إسناد الطيار" });
      }
    });
  };

  // Open Remittance Modal for a specific rider
  const handleOpenRemittanceForRider = (riderName: string | null | undefined, preselectedOrderId?: string) => {
    if (!riderName) return;
    const riderData = ledgerRiders.find((r) => r.riderName === riderName);
    if (!riderData || riderData.unsettledOrders.length === 0) {
      alert(`لا توجد طلبات معلقة تتطلب توريداً نقدياً للطيار (${riderName})`);
      return;
    }

    setRemittanceTargetRider(riderName);
    setRemittanceTargetOrdersList(riderData.unsettledOrders);

    if (preselectedOrderId) {
      setRemittanceSelectedOrders([preselectedOrderId]);
      const matched = riderData.unsettledOrders.find((o) => o.orderId === preselectedOrderId);
      setRemittanceAmount(matched ? matched.pendingAmount.toString() : "0");
    } else {
      // Select all unsettled orders by default
      const allIds = riderData.unsettledOrders.map((o) => o.orderId);
      setRemittanceSelectedOrders(allIds);
      setRemittanceAmount(riderData.pendingCashDebt.toString());
    }

    setRemittanceVarianceReason("");
    setRemittanceNotes("");
    setShowRemittanceModal(true);
  };

  // Confirm Remittance Execution
  const handleConfirmRemittance = async () => {
    const parsedAmount = parseFloat(remittanceAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("يرجى إدخال مبلغ نقدية صحيح وموجب");
      return;
    }

    if (remittanceSelectedOrders.length === 0) {
      alert("يرجى تحديد طلب واحد على الأقل لتسوية التوريد له");
      return;
    }

    startTransition(async () => {
      const res = await recordRiderRemittance({
        riderName: remittanceTargetRider,
        orderIds: remittanceSelectedOrders,
        amountReceived: parsedAmount,
        remittedAmount: parsedAmount,
        varianceReason: remittanceVarianceReason,
        notes: remittanceNotes,
        cashierName: currentUser,
      });

      if (res.success) {
        setFeedback({ type: "success", text: res.message || "تم تسجيل التوريد بنجاح ✓" });
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 font-sans" dir="rtl">
      <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-[#1F2937]">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:px-6 bg-[#243B53] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1A2C3F] border border-[#334E68] text-[#3B82A0] flex items-center justify-center text-xl shadow">
              🛵
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                إدارة طلبات الدليفري ودفتر عهدة الطيارين
              </h2>
              <p className="text-[11px] text-[#D9E2EC] font-medium">
                مشويات بسيوني — تتبع دورة الطلب والتسويات المالية المعلقة للكاشير
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs switcher */}
            <div className="bg-[#1A2C3F] p-1 rounded-2xl border border-[#334E68] flex items-center gap-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab("ORDERS")}
                className={`px-3 py-1.5 rounded-xl transition ${
                  activeTab === "ORDERS"
                    ? "bg-[#FFFFFF] text-[#243B53] font-black shadow-sm"
                    : "text-[#D9E2EC] hover:text-white"
                }`}
              >
                📋 طلبات الدليفري ({totalOrders})
              </button>
              <button
                onClick={() => setActiveTab("LEDGER")}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  activeTab === "LEDGER"
                    ? "bg-[#FFFFFF] text-[#243B53] font-black shadow-sm"
                    : "text-[#D9E2EC] hover:text-white"
                }`}
              >
                <span>💼 عهدة الطيارين</span>
                {ledgerTotals.totalPendingDebt > 0 && (
                  <span className="bg-[#B42318] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {ledgerTotals.totalPendingDebt.toFixed(0)} ج.م
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#1A2C3F] hover:bg-[#102A43] text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition mr-1"
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

        {/* TAB 1: DELIVERY ORDERS */}
        {activeTab === "ORDERS" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Filter Bar */}
            <div className="p-3 bg-[#F4F6F8] border-b border-[#D9E0E7] grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs shrink-0">
              {/* Search */}
              <div className="col-span-2 sm:col-span-1">
                <input
                  type="text"
                  placeholder="بحث برقم الطلب، العميل، الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && refreshOrders()}
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-3 py-1.5 text-[#1F2937] outline-none focus:border-[#243B53] text-xs"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-2.5 py-1.5 text-[#1F2937] outline-none focus:border-[#243B53] text-xs"
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
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-2.5 py-1.5 text-[#1F2937] outline-none focus:border-[#243B53] text-xs"
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
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-2.5 py-1.5 text-[#1F2937] outline-none focus:border-[#243B53] text-xs"
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
                className="bg-[#243B53] hover:bg-[#1A2C3F] text-white font-bold rounded-xl px-3 py-1.5 transition text-xs flex items-center justify-center gap-1 shadow-sm"
              >
                <span>🔄</span>
                <span>تحديث</span>
              </button>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#F8FAFC]">
              {orders.length === 0 ? (
                <div className="text-center py-12 text-[#94A3B8] text-xs">
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
                      className={`p-3.5 sm:p-4 rounded-2xl border transition shadow-sm ${
                        isCancelled
                          ? "bg-[#FEF2F2] border-[#FCA5A5] opacity-75"
                          : isDelivered && !isPendingRemittance
                          ? "bg-[#FFFFFF] border-[#D9E0E7]"
                          : isWithRider
                          ? "bg-[#FFFFFF] border-2 border-[#3B82A0]"
                          : "bg-[#FFFFFF] border-[#D9E0E7]"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#E2E8F0]">
                        {/* Order Number & Customer Info */}
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-[#243B53] text-base bg-[#F0F4F8] border border-[#CBD5E1] px-2.5 py-1 rounded-xl">
                            #{ord.orderNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-[#1F2937] text-sm">{ord.customerName}</h4>
                              <span className="font-mono text-xs text-[#3B82A0]">{ord.customerPhone}</span>
                            </div>
                            <p className="text-[11px] text-[#5B6472] flex items-center gap-1 mt-0.5">
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
                                ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#B42318]"
                                : isDelivered
                                ? "bg-[#EBF7F0] border-[#A7F3D0] text-[#237A57]"
                                : isWithRider
                                ? "bg-[#F0F7FA] border-[#BAE6FD] text-[#0369A1]"
                                : ord.deliveryStatus === "READY"
                                ? "bg-[#FFFBEB] border-[#FDE68A] text-[#946200]"
                                : "bg-[#F0F4F8] border-[#CBD5E1] text-[#243B53]"
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
                                ? "bg-[#EBF7F0] border-[#A7F3D0] text-[#237A57]"
                                : ord.remittanceStatus === "NOT_APPLICABLE"
                                ? "bg-[#FAF5FF] border-[#E9D5FF] text-[#7E22CE]"
                                : ord.remittanceStatus === "PARTIAL"
                                ? "bg-[#FFFBEB] border-[#FDE68A] text-[#946200]"
                                : "bg-[#FEF2F2] border-[#FCA5A5] text-[#B42318]"
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
                          <p className="text-[10px] text-[#5B6472] font-bold">الأصناف المطلوبة:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ord.items.map((it: any, i: number) => (
                              <span
                                key={i}
                                className="bg-[#F8FAFC] px-2 py-0.5 rounded-md text-[11px] text-[#1F2937] border border-[#E2E8F0]"
                              >
                                {it.quantity}x {it.nameAr}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Financial figures */}
                        <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#D9E0E7] flex flex-col justify-between text-[11px]">
                          <div className="flex justify-between text-[#5B6472]">
                            <span>إجمالي الفاتورة:</span>
                            <span className="font-mono font-bold text-[#1F2937]">{ord.totalAmount} ج.م</span>
                          </div>
                          <div className="flex justify-between text-[#5B6472] mt-1">
                            <span>طريقة الدفع:</span>
                            <span className="font-bold text-[#243B53]">
                              {ord.paymentMethod === "CARD" ? "فيزا / شبكة" : ord.paymentMethod === "WALLET" ? "محفظة" : "نقدي عند الاستلام"}
                            </span>
                          </div>
                          <div className="flex justify-between text-[#3B82A0] font-bold mt-1 pt-1 border-t border-[#E2E8F0]">
                            <span>الطيار:</span>
                            <span>{ord.riderName || "لم يتم التحديد"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Bar */}
                      <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
                        {/* Time & History */}
                        <div className="text-[10px] text-[#5B6472] font-mono">
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
                            className="px-2.5 py-1 rounded-xl bg-[#F0F7FA] hover:bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] font-bold text-[11px] transition flex items-center gap-1"
                          >
                            <span>🛵</span>
                            <span>{ord.riderName ? "تغيير الطيار" : "إسناد طيار"}</span>
                          </button>

                          {/* Quick Status Progression */}
                          {ord.deliveryStatus === "NEW" && (
                            <button
                              onClick={() => handleQuickStatusChange(ord.id, "IN_KITCHEN")}
                              className="px-2.5 py-1 rounded-xl bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FDE68A] text-[#946200] font-bold text-[11px]"
                            >
                              👨‍🍳 إرسال للمطبخ
                            </button>
                          )}
                          {ord.deliveryStatus === "IN_KITCHEN" && (
                            <button
                              onClick={() => handleQuickStatusChange(ord.id, "READY")}
                              className="px-2.5 py-1 rounded-xl bg-[#F0F7FA] hover:bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] font-bold text-[11px]"
                            >
                              ✓ جاهز عند الكاشير
                            </button>
                          )}
                          {(ord.deliveryStatus === "READY" || ord.deliveryStatus === "NEW") && ord.riderName && (
                            <button
                              onClick={() => handleQuickStatusChange(ord.id, "WITH_RIDER")}
                              className="px-2.5 py-1 rounded-xl bg-[#EBF7F0] hover:bg-[#D1FAE5] border border-[#A7F3D0] text-[#237A57] font-bold text-[11px]"
                            >
                              🚀 تسليم للطيار
                            </button>
                          )}
                          {ord.deliveryStatus === "WITH_RIDER" && (
                            <button
                              onClick={() => handleQuickStatusChange(ord.id, "DELIVERED")}
                              className="px-2.5 py-1 rounded-xl bg-[#EBF7F0] hover:bg-[#D1FAE5] border border-[#A7F3D0] text-[#237A57] font-bold text-[11px]"
                            >
                              📦 تأكيد تسليم العميل
                            </button>
                          )}

                          {/* Direct Remittance Button if debt pending */}
                          {isPendingRemittance && ord.riderName && (
                            <button
                              onClick={() => handleOpenRemittanceForRider(ord.riderName, ord.id)}
                              className="px-3 py-1 rounded-xl bg-[#237A57] hover:bg-[#1D6447] text-white font-black text-[11px] shadow-sm"
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
          <div className="flex-1 overflow-hidden flex flex-col p-3 sm:p-5 space-y-4 bg-[#F8FAFC]">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div className="bg-[#FFFFFF] border border-[#FCA5A5] rounded-2xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-[#5B6472]">عهدة معلقة مع الطيارين حالياً</p>
                <p className="font-mono font-black text-[#B42318] text-lg mt-0.5">
                  {ledgerTotals.totalPendingDebt.toFixed(2)} ج.م
                </p>
                <p className="text-[9px] text-[#5B6472]">مديونية تشغيلية خارج الدرج</p>
              </div>

              <div className="bg-[#FFFFFF] border border-[#A7F3D0] rounded-2xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-[#5B6472]">نقدية وردت فعلياً لدرج الكاشير اليوم</p>
                <p className="font-mono font-black text-[#237A57] text-lg mt-0.5">
                  {ledgerTotals.totalRemittedToday.toFixed(2)} ج.م
                </p>
                <p className="text-[9px] text-[#5B6472]">مسجلة بالخزينة والوردية</p>
              </div>

              <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-2xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-[#5B6472]">الطيارون النشطون</p>
                <p className="font-mono font-black text-[#243B53] text-lg mt-0.5">
                  {ledgerTotals.activeRidersCount}
                </p>
                <p className="text-[9px] text-[#5B6472]">مسجلون بالنظام</p>
              </div>

              <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-2xl p-3 text-center shadow-sm">
                <p className="text-[10px] text-[#5B6472]">طلبات بانتظار التوريد</p>
                <p className="font-mono font-black text-[#3B82A0] text-lg mt-0.5">
                  {ledgerTotals.unsettledOrdersCount} طلب
                </p>
                <p className="text-[9px] text-[#5B6472]">غير مسواة مالياً</p>
              </div>
            </div>

            {/* Riders Cards List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {ledgerRiders.length === 0 ? (
                <div className="text-center py-12 text-[#94A3B8] text-xs">
                  لا توجد عهد أو حركات مسجلة للطيارين حالياً.
                </div>
              ) : (
                ledgerRiders.map((rider, i) => (
                  <div
                    key={i}
                    className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-2xl p-4 transition hover:border-[#CBD5E1] shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#F0F7FA] text-[#0369A1] flex items-center justify-center font-black text-lg border border-[#BAE6FD]">
                          🛵
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-[#1F2937] text-base">{rider.riderName}</h3>
                            <span className="bg-[#F0F4F8] text-[#243B53] text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {rider.totalOrdersCount} إجمالي الطلبات
                            </span>
                          </div>
                          <p className="text-[11px] text-[#5B6472]">
                            {rider.activeOrdersCount} طلب جاري • {rider.deliveredOrdersCount} تم تسليمه
                          </p>
                        </div>
                      </div>

                      {/* Rider Ledger Numbers */}
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div className="text-right">
                          <p className="text-[10px] text-[#5B6472]">مطلوب تحصيله</p>
                          <p className="font-bold text-[#1F2937]">{rider.totalCashDue.toFixed(2)} ج.م</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[#5B6472]">تم توريده للدرج</p>
                          <p className="font-bold text-[#237A57]">+{rider.totalCashRemitted.toFixed(2)} ج.م</p>
                        </div>
                        <div className="text-right bg-[#FEF2F2] border border-[#FCA5A5] px-3 py-1 rounded-xl">
                          <p className="text-[10px] text-[#B42318] font-bold">المتبقي معه (عهدة)</p>
                          <p className="font-black text-[#B42318] text-sm">
                            {rider.pendingCashDebt.toFixed(2)} ج.م
                          </p>
                        </div>

                        {/* Remittance Button */}
                        <button
                          onClick={() => handleOpenRemittanceForRider(rider.riderName)}
                          className="px-3.5 py-2 bg-[#237A57] hover:bg-[#1D6447] text-white font-black rounded-xl text-xs transition shadow-sm"
                        >
                          💵 تسجيل توريد نقدية
                        </button>
                      </div>
                    </div>

                    {/* Unsettled Orders for this Rider */}
                    {rider.unsettledOrders.length > 0 && (
                      <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#D9E0E7] space-y-2">
                        <p className="text-[11px] font-bold text-[#243B53] flex items-center justify-between">
                          <span>الطلبات غير المسواة معلقة مع الطيار ({rider.unsettledOrders.length} طلب):</span>
                          <span className="text-[10px] text-[#5B6472]">المبلغ معلق حتى استلام الكاشير</span>
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {rider.unsettledOrders.map((ord, idx) => (
                            <div
                              key={idx}
                              className="bg-[#FFFFFF] p-2.5 rounded-lg border border-[#D9E0E7] text-xs flex flex-col justify-between shadow-sm"
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className="font-mono text-[#243B53]">#{ord.orderNumber}</span>
                                <span className="font-mono text-[#B42318] font-black">
                                  {ord.pendingAmount.toFixed(2)} ج.م معلق
                                </span>
                              </div>
                              <p className="text-[10px] text-[#5B6472] truncate mt-1">
                                {ord.customerName || "عميل"} • {ord.deliveryAddress || "بدون عنوان"}
                              </p>
                              <div className="mt-2 pt-1 border-t border-[#E2E8F0] flex items-center justify-between text-[10px]">
                                <span className="text-[#5B6472]">
                                  {ord.deliveryStatus === "DELIVERED" ? "تم التسليم" : "مع الطيار"}
                                </span>
                                <button
                                  onClick={() => handleOpenRemittanceForRider(rider.riderName, ord.orderId)}
                                  className="text-[#243B53] hover:underline font-bold"
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-2">
                <h3 className="font-black text-[#243B53] text-sm flex items-center gap-2">
                  <span>🛵</span>
                  <span>إسناد طلب دليفري #{assignModalOrder.orderNumber} للطيار</span>
                </h3>
                <button
                  onClick={() => setAssignModalOrder(null)}
                  className="text-[#5B6472] hover:text-[#1F2937] text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#D9E0E7] text-xs space-y-1">
                <p className="text-[#1F2937]">
                  <span className="text-[#5B6472]">العميل:</span> {assignModalOrder.customerName} (
                  {assignModalOrder.customerPhone})
                </p>
                <p className="text-[#1F2937]">
                  <span className="text-[#5B6472]">العنوان:</span> {assignModalOrder.deliveryAddress}
                </p>
                <p className="text-[#1F2937]">
                  <span className="text-[#5B6472]">المبلغ المطلوب تحصيله:</span>{" "}
                  <span className="font-mono font-bold text-[#237A57]">
                    {assignModalOrder.riderCashDue} ج.م
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1F2937]">
                  اختر من قائمة الطيارين المعتمدين:
                </label>
                <select
                  value={selectedRiderToAssign}
                  onChange={(e) => {
                    setSelectedRiderToAssign(e.target.value);
                    setCustomRiderInput("");
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
                >
                  <option value="">-- اختر طيار --</option>
                  {availableRiders.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <div className="pt-1">
                  <label className="block text-[10px] text-[#5B6472] mb-1">
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
                    className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-3 py-1.5 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleConfirmAssignRider}
                  disabled={isPending}
                  className="flex-1 bg-[#237A57] hover:bg-[#1D6447] text-white font-black py-2.5 rounded-xl text-xs transition shadow-sm"
                >
                  ✓ تأكيد إسناد الطلب
                </button>
                <button
                  onClick={() => setAssignModalOrder(null)}
                  className="px-4 py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#5B6472] rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RECORD RIDER REMITTANCE (تسجيل توريد عهدة من الطيار) */}
        {showRemittanceModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💵</span>
                  <h3 className="font-black text-[#243B53] text-sm">
                    تسجيل توريد عهدة نقدية من الطيار ({remittanceTargetRider})
                  </h3>
                </div>
                <button
                  onClick={() => setShowRemittanceModal(false)}
                  className="text-[#5B6472] hover:text-[#1F2937] text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {/* Amount Input */}
                <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#D9E0E7]">
                  <label className="block text-xs font-black text-[#243B53] mb-1">
                    المبلغ المستلم فعلياً باليد لتوريده للدرج (ج.م) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={remittanceAmount}
                    onChange={(e) => setRemittanceAmount(e.target.value)}
                    placeholder="أدخل المبلغ المستلم من الطيار..."
                    className="w-full bg-[#FFFFFF] border border-[#CBD5E1] focus:border-[#243B53] rounded-xl px-4 py-2.5 text-[#1F2937] font-mono text-lg font-black outline-none"
                    autoFocus
                  />

                  {/* Live Variance Calculation */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[#5B6472]">
                      المتوقع للطلبات المحددة: <b className="font-mono text-[#1F2937]">{selectedOrdersTotalDue.toFixed(2)} ج.م</b>
                    </span>
                    <span
                      className={`font-mono font-black ${
                        currentVariance === 0
                          ? "text-[#237A57]"
                          : currentVariance < 0
                          ? "text-[#B42318]"
                          : "text-[#3B82A0]"
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
                  <div className="bg-[#FEF2F2] border border-[#FCA5A5] p-2.5 rounded-xl space-y-1">
                    <label className="block text-[11px] font-bold text-[#B42318]">
                      سبب وجود فرق تحصيل (عجز / زيادة):
                    </label>
                    <input
                      type="text"
                      value={remittanceVarianceReason}
                      onChange={(e) => setRemittanceVarianceReason(e.target.value)}
                      placeholder="مثال: خصم بإذن المدير، تأجيل جزء للغد، تباقي..."
                      className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-[#1F2937] text-xs outline-none"
                    />
                  </div>
                )}

                {/* Target Orders Checkboxes */}
                {remittanceTargetOrdersList.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#1F2937]">
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
                        className="text-[#243B53] hover:underline text-[10px]"
                      >
                        {remittanceSelectedOrders.length === remittanceTargetOrdersList.length
                          ? "إلغاء تحديد الكل"
                          : "تحديد كل الطلبات"}
                      </button>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1.5 bg-[#F8FAFC] p-2 rounded-xl border border-[#D9E0E7]">
                      {remittanceTargetOrdersList.map((ord) => {
                        const isSelected = remittanceSelectedOrders.includes(ord.orderId);
                        return (
                          <label
                            key={ord.orderId}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-[11px] border ${
                              isSelected
                                ? "bg-[#FFFFFF] border-2 border-[#243B53] text-[#1F2937]"
                                : "bg-[#FFFFFF] border-[#D9E0E7] text-[#5B6472] hover:text-[#1F2937]"
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
                                className="accent-[#243B53] w-3.5 h-3.5"
                              />
                              <span className="font-mono font-bold text-[#243B53]">#{ord.orderNumber}</span>
                              <span className="truncate max-w-[150px]">{ord.customerName || "عميل"}</span>
                            </div>
                            <span className="font-mono font-bold text-[#1F2937]">
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
                  <label className="block text-[11px] text-[#5B6472] mb-1">ملاحظات إضافية على التوريد:</label>
                  <input
                    type="text"
                    value={remittanceNotes}
                    onChange={(e) => setRemittanceNotes(e.target.value)}
                    placeholder="أي ملاحظات تخص الوردية أو المستلم..."
                    className="w-full bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl px-3 py-1.5 text-[#1F2937] text-xs outline-none focus:border-[#243B53]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-[#D9E0E7] shrink-0">
                <button
                  onClick={handleConfirmRemittance}
                  disabled={isPending}
                  className="flex-1 bg-[#237A57] hover:bg-[#1D6447] text-white font-black py-2.5 rounded-xl text-xs transition shadow-sm"
                >
                  ✓ تأكيد استلام النقدية وإضافتها لدرج الكاشير
                </button>
                <button
                  onClick={() => setShowRemittanceModal(false)}
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
