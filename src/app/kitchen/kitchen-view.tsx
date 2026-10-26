"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { updateOrderKitchenStatus } from "@/actions/kitchen";
import { triggerKitchenPrepPrint, silentPrintHtml, buildGrillingKitchenTicketHtml } from "@/utils/printer/silent-print";

interface KitchenItem {
  id: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  menuItem: {
    id: string;
    nameAr: string;
    categoryId?: string;
  };
}

interface KitchenOrder {
  id: string;
  orderNumber: number;
  orderType: string;
  orderKind?: string | null;
  status: string;
  workflowStatus?: string | null;
  customerMeatWeight?: number | null;
  cookedWeight?: number | null;
  meatType?: string | null;
  expectedPickupTime?: string | null;
  notes?: string | null;
  receivedBy?: string | null;
  deliveredBy?: string | null;
  deliveryAddress?: string | null;
  createdAt: string | Date;
  statusHistory?: any;
  table?: { id: string; name: string; number: number | null } | null;
  customer?: { id: string; name: string; phone: string; address?: string | null } | null;
  customerName?: string | null;
  customerPhone?: string | null;
  items: KitchenItem[];
}

export default function KitchenView({
  initialOrders,
  chefName = "شيف المطبخ",
}: {
  initialOrders: KitchenOrder[];
  chefName?: string;
}) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ACTIVE");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const previousOrderIdsRef = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));

  // Play a soft kitchen chime using Web Audio API
  const playKitchenChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      // audio error handling
    }
  };

  // Auto-polling every 5 seconds for real-time kitchen sync
  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/kitchen-orders");
      if (res.ok) {
        const data = await res.json();
        if (data.orders) {
          // Check if new orders arrived
          const currentIds = new Set<string>(data.orders.map((o: any) => String(o.id)));
          const hasNew = data.orders.some((o: any) => !previousOrderIdsRef.current.has(String(o.id)));
          if (hasNew) {
            playKitchenChime();
          }
          previousOrderIdsRef.current = currentIds;
          setOrders(data.orders);
        }
      }
    } catch (e) {
      // silent network catch
    }
  };

  useEffect(() => {
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Live Timer tick
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Overall elapsed time since creation
  const getElapsedTimeInfo = (createdAt: string | Date) => {
    const elapsedMinutes = Math.floor((now - new Date(createdAt).getTime()) / 60000);
    return {
      minutes: elapsedMinutes,
      text: `${elapsedMinutes} دقيقة`,
      color: elapsedMinutes < 15 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : elapsedMinutes < 30 ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-rose-500/20 text-rose-400 border-rose-500/50",
    };
  };

  // Target Prep Time: 45 Minutes from Actual Start of Preparation (Requirement 1)
  const getPrepTiming = (order: KitchenOrder) => {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const prepEntry = history.find((h: any) => h.to === "PREPARING");
    if (!prepEntry || !prepEntry.timestamp) {
      return {
        hasStarted: false,
        prepDurationMinutes: 0,
        remainingMinutes: 45,
        isOverdue: false,
        delayMinutes: 0,
      };
    }

    const prepStartMs = new Date(prepEntry.timestamp).getTime();
    const prepDurationMinutes = Math.floor((now - prepStartMs) / 60000);
    const targetMinutes = 45;
    const remainingMinutes = Math.max(0, targetMinutes - prepDurationMinutes);
    const isOverdue = prepDurationMinutes > targetMinutes;
    const delayMinutes = isOverdue ? prepDurationMinutes - targetMinutes : 0;

    return {
      hasStarted: true,
      prepDurationMinutes,
      remainingMinutes,
      isOverdue,
      delayMinutes,
      startedAtStr: new Date(prepStartMs).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  // Scheduled Order 30-Minute Early Warning (Requirement 1)
  const getScheduledAlert = (order: KitchenOrder) => {
    if (!order.expectedPickupTime) return null;
    const pickupStr = order.expectedPickupTime.trim();
    if (!pickupStr) return null;

    // Check if prep already started
    const currentSt = order.workflowStatus || "NEW";
    const hasStarted = currentSt === "PREPARING" || currentSt === "READY" || currentSt === "HANDED_TO_CASHIER" || currentSt === "OUT_FOR_DELIVERY";

    // Attempt to parse "HH:MM" or full date
    let pickupDate: Date | null = null;
    const timeMatch = pickupStr.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const orderDate = new Date(order.createdAt);
      pickupDate = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), parseInt(timeMatch[1]), parseInt(timeMatch[2]));
    } else {
      const parsed = new Date(pickupStr);
      if (!isNaN(parsed.getTime())) pickupDate = parsed;
    }

    if (!pickupDate) return { scheduledTime: pickupStr, alert: false };

    const diffMinutes = Math.round((pickupDate.getTime() - now) / 60000);

    // If within 30 minutes and prep has not started yet, trigger urgent warning!
    if (!hasStarted && diffMinutes <= 30 && diffMinutes >= -60) {
      return {
        scheduledTime: pickupStr,
        alert: true,
        diffMinutes,
        message: diffMinutes <= 0
          ? `⚠️ حان موعد الاستلام المجدول (${pickupStr}) والتجهيز لم يبدأ بعد!`
          : `🚨 موعد الاستلام بعد ${diffMinutes} دقيقة (${pickupStr}) — يجب بدء التجهيز فوراً!`,
      };
    }

    return { scheduledTime: pickupStr, alert: false, diffMinutes };
  };

  const handleUpdateStatus = async (
    orderId: string,
    nextStatus:
      | "NEW"
      | "RECEIVED_CUSTOMER_MEAT"
      | "PREPARING"
      | "READY"
      | "HANDED_TO_CASHIER"
      | "OUT_FOR_DELIVERY"
      | "DELIVERED"
  ) => {
    setIsUpdating(orderId);
    try {
      const res = await updateOrderKitchenStatus({
        orderId,
        nextStatus,
        chefName,
      });
      if (res?.error) {
        alert(res.error);
      } else {
        await fetchOrders();
      }
    } finally {
      setIsUpdating(null);
    }
  };

  const handlePrintKitchenTicket = async (order: KitchenOrder) => {
    const isGrill = order.orderKind === "CUSTOMER_GRILL";
    if (isGrill) {
      const html = buildGrillingKitchenTicketHtml({
        tableName: "خامات العميل (شواية)",
        orderNumber: order.orderNumber,
        customerName: order.customerName || order.customer?.name,
        meatType: order.meatType || "مشكل",
        customerMeatWeight: order.customerMeatWeight || 0,
        expectedPickupTime: order.expectedPickupTime || "فوري",
        receivedBy: order.receivedBy || "الكاشير",
        items: order.items.map((i) => ({
          nameAr: i.menuItem.nameAr,
          quantity: i.quantity,
          price: i.unitPrice,
          notes: i.notes || null,
        })),
        subtotal: 0,
        totalAmount: 0,
        notes: order.notes || undefined,
        cashierName: chefName,
        timestamp: order.createdAt,
      });
      await silentPrintHtml(html);
    } else {
      await triggerKitchenPrepPrint({
        tableName: order.table?.name || (order.orderType === "DELIVERY" ? "دليفري" : "تيك أواي"),
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        customerName: order.customerName || order.customer?.name,
        items: order.items.map((i) => ({
          nameAr: i.menuItem.nameAr,
          quantity: i.quantity,
          price: i.unitPrice,
          notes: i.notes || null,
        })),
        notes: order.notes || undefined,
        cashierName: chefName,
        timestamp: order.createdAt,
      });
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Channel Filter
      if (filterChannel === "CUSTOMER_GRILL" && o.orderKind !== "CUSTOMER_GRILL") return false;
      if (filterChannel === "TAKEAWAY" && (o.orderType !== "TAKEAWAY" || o.orderKind === "CUSTOMER_GRILL")) return false;
      if (filterChannel === "DELIVERY" && o.orderType !== "DELIVERY") return false;
      if (filterChannel === "DINE_IN" && o.orderType !== "DINE_IN") return false;

      // Status Filter
      const currentSt = o.workflowStatus || "NEW";
      if (filterStatus === "NEW" && currentSt !== "NEW" && currentSt !== "RECEIVED_CUSTOMER_MEAT") return false;
      if (filterStatus === "PREPARING" && currentSt !== "PREPARING") return false;
      if (filterStatus === "READY" && currentSt !== "READY") return false;

      return true;
    });
  }, [orders, filterChannel, filterStatus]);

  const counts = useMemo(() => {
    return {
      total: orders.length,
      new: orders.filter((o) => (o.workflowStatus || "NEW") === "NEW" || o.workflowStatus === "RECEIVED_CUSTOMER_MEAT").length,
      preparing: orders.filter((o) => o.workflowStatus === "PREPARING").length,
      ready: orders.filter((o) => o.workflowStatus === "READY").length,
      grills: orders.filter((o) => o.orderKind === "CUSTOMER_GRILL").length,
    };
  }, [orders]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070a12] text-stone-100 font-sans select-none" dir="rtl">
      
      {/* 1. TOP HEADER */}
      <header className="h-16 shrink-0 bg-[#0d1322] border-b border-[#1c263d] px-4 flex items-center justify-between z-30 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-2xl shadow-lg shadow-orange-500/20">
            👨‍🍳
          </div>
          <div>
            <h1 className="text-lg font-black text-amber-400 tracking-tight leading-tight flex items-center gap-2">
              <span>شاشة المطبخ والشواية المباشرة (KDS)</span>
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono">
                {counts.total} أوردر نشط
              </span>
            </h1>
            <p className="text-[10px] text-stone-400 font-bold">
              مشويات بسيوني — متابعة وتحضير وتوجيه الطلبات للشواية
            </p>
          </div>
        </div>

        {/* Status Counts Tabs */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#12192b] border border-[#1e2842] p-1 rounded-2xl text-xs">
          <button
            onClick={() => setFilterStatus("ACTIVE")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              filterStatus === "ACTIVE"
                ? "bg-amber-500 text-stone-950 font-black shadow"
                : "text-stone-300 hover:text-white"
            }`}
          >
            <span>الكل النشط</span>
            <span className="font-mono bg-black/20 px-1.5 rounded-full text-[10px]">{counts.total}</span>
          </button>
          <button
            onClick={() => setFilterStatus("NEW")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              filterStatus === "NEW"
                ? "bg-amber-500 text-stone-950 font-black shadow"
                : "text-stone-300 hover:text-white"
            }`}
          >
            <span>جديد</span>
            <span className="font-mono bg-amber-950/40 text-amber-400 px-1.5 rounded-full text-[10px]">{counts.new}</span>
          </button>
          <button
            onClick={() => setFilterStatus("PREPARING")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              filterStatus === "PREPARING"
                ? "bg-sky-500 text-white font-black shadow"
                : "text-stone-300 hover:text-white"
            }`}
          >
            <span>على النار / قيد الطهي</span>
            <span className="font-mono bg-sky-950/40 text-sky-400 px-1.5 rounded-full text-[10px]">{counts.preparing}</span>
          </button>
          <button
            onClick={() => setFilterStatus("READY")}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              filterStatus === "READY"
                ? "bg-emerald-500 text-stone-950 font-black shadow"
                : "text-stone-300 hover:text-white"
            }`}
          >
            <span>جاهز للتسليم</span>
            <span className="font-mono bg-emerald-950/40 text-emerald-400 px-1.5 rounded-full text-[10px]">{counts.ready}</span>
          </button>
        </div>

        {/* Right Action Shortcuts */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition ${
              soundEnabled
                ? "bg-[#141b2f] border-emerald-500/50 text-emerald-400"
                : "bg-[#141b2f] border-stone-800 text-stone-500"
            }`}
            title={soundEnabled ? "صوت التنبيه مفعل" : "صوت التنبيه صامت"}
          >
            {soundEnabled ? "🔔" : "🔕"}
          </button>

          <button
            onClick={fetchOrders}
            className="px-3 py-2 rounded-xl bg-[#141b2f] border border-[#1e2842] hover:border-amber-500/60 text-stone-300 font-bold flex items-center gap-1.5 transition"
            title="تحديث لحظي"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">تحديث</span>
          </button>

          <Link
            href="/pos"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-black flex items-center gap-1.5 transition shadow-md shadow-orange-500/20"
          >
            <span>🛒</span>
            <span>الكاشير</span>
          </Link>
        </div>
      </header>

      {/* 2. SUB-BAR: CHANNELS FILTER */}
      <div className="h-11 shrink-0 bg-[#0a0f1b] border-b border-[#182136] px-4 flex items-center justify-between text-xs overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-stone-400 font-bold ml-1">تصفية القنوات:</span>
          <button
            onClick={() => setFilterChannel("ALL")}
            className={`px-3 py-1 rounded-xl font-bold transition border ${
              filterChannel === "ALL"
                ? "bg-amber-500/20 text-amber-300 border-amber-500"
                : "bg-[#12192b] border-[#1e2842] text-stone-400 hover:text-white"
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setFilterChannel("CUSTOMER_GRILL")}
            className={`px-3 py-1 rounded-xl font-bold transition border flex items-center gap-1 ${
              filterChannel === "CUSTOMER_GRILL"
                ? "bg-orange-500 text-stone-950 border-orange-400 font-black shadow"
                : "bg-[#12192b] border-[#1e2842] text-orange-400 hover:text-white"
            }`}
          >
            <span>🔥</span>
            <span>شوي للغير ({counts.grills})</span>
          </button>
          <button
            onClick={() => setFilterChannel("TAKEAWAY")}
            className={`px-3 py-1 rounded-xl font-bold transition border ${
              filterChannel === "TAKEAWAY"
                ? "bg-amber-500/20 text-amber-300 border-amber-500"
                : "bg-[#12192b] border-[#1e2842] text-stone-400 hover:text-white"
            }`}
          >
            🛍️ تيك أواي
          </button>
          <button
            onClick={() => setFilterChannel("DELIVERY")}
            className={`px-3 py-1 rounded-xl font-bold transition border ${
              filterChannel === "DELIVERY"
                ? "bg-teal-500/20 text-teal-300 border-teal-500"
                : "bg-[#12192b] border-[#1e2842] text-stone-400 hover:text-white"
            }`}
          >
            🛵 دليفري
          </button>
          <button
            onClick={() => setFilterChannel("DINE_IN")}
            className={`px-3 py-1 rounded-xl font-bold transition border ${
              filterChannel === "DINE_IN"
                ? "bg-sky-500/20 text-sky-300 border-sky-500"
                : "bg-[#12192b] border-[#1e2842] text-stone-400 hover:text-white"
            }`}
          >
            🪑 صالة
          </button>
        </div>

        <div className="text-[11px] text-stone-400 font-mono hidden md:block">
          تحديث تلقائي كل 5 ثوانٍ • ترتيب بالأقدمية (FIFO)
        </div>
      </div>

      {/* 3. KITCHEN ORDERS GRID */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 bg-[#070a12]">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-500">
            <span className="text-6xl mb-3 text-stone-600">👨‍🍳</span>
            <h2 className="text-xl font-black text-stone-300">لا توجد طلبات معلقة في المطبخ حالياً</h2>
            <p className="text-xs text-stone-500 mt-1 max-w-sm">
              المطبخ جاهز ونظيف تماماً! عند إرسال أي أوردر جديد من شاشة الكاشير سيظهر هنا فوراً مع تنبيه صوتي.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 items-start">
            {filteredOrders.map((order) => {
              const elapsed = getElapsedTimeInfo(order.createdAt);
              const prepInfo = getPrepTiming(order);
              const schedAlert = getScheduledAlert(order);
              const isGrill = order.orderKind === "CUSTOMER_GRILL";
              const currentSt = order.workflowStatus || "NEW";
              const isBusy = isUpdating === order.id;

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border flex flex-col overflow-hidden shadow-xl transition-all ${
                    currentSt === "READY"
                      ? "bg-[#0b1b14] border-emerald-500 shadow-emerald-500/10"
                      : currentSt === "OUT_FOR_DELIVERY" || currentSt === "HANDED_TO_CASHIER"
                      ? "bg-[#18132e] border-purple-500 shadow-purple-500/10"
                      : currentSt === "PREPARING"
                      ? "bg-[#0e172a] border-sky-500 shadow-sky-500/10"
                      : isGrill
                      ? "bg-[#1a1208] border-orange-500 shadow-orange-500/10"
                      : "bg-[#0f1422] border-[#222c44]"
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-3 border-b border-black/40 flex items-center justify-between bg-black/25">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xl font-black text-white">
                        #{order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${elapsed.color}`}
                        title="الوقت منذ إنشاء الطلب"
                      >
                        ⏱️ {elapsed.text}
                      </span>
                    </div>

                    {/* Order Channel Badge */}
                    <div className="text-right">
                      <span
                        className={`text-[11px] font-black px-2.5 py-1 rounded-xl inline-block ${
                          isGrill
                            ? "bg-orange-500 text-stone-950"
                            : order.orderType === "DELIVERY"
                            ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                            : order.orderType === "DINE_IN"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {isGrill
                          ? "🔥 خامة العميل"
                          : order.orderType === "DELIVERY"
                          ? "🛵 دليفري"
                          : order.orderType === "DINE_IN"
                          ? `🪑 ${order.table?.name || "صالة"}`
                          : "🛍️ تيك أواي"}
                      </span>
                    </div>
                  </div>

                  {/* Scheduled Order Warning (Requirement 1: 30-min alert) */}
                  {schedAlert?.alert && (
                    <div className="bg-rose-500/20 border-b border-rose-500/40 p-2 text-rose-300 font-bold text-xs animate-pulse flex items-center gap-1.5">
                      <span>{schedAlert.message}</span>
                    </div>
                  )}

                  {/* Target 45-Minute Prep Counter (Requirement 1) */}
                  {prepInfo.hasStarted && (
                    <div
                      className={`px-3 py-1.5 border-b text-xs flex items-center justify-between font-bold ${
                        prepInfo.isOverdue
                          ? "bg-rose-950/60 text-rose-300 border-rose-500/50 animate-pulse"
                          : "bg-sky-950/40 text-sky-300 border-sky-500/30"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span>🔥 في التجهيز منذ:</span>
                        <strong className="font-mono text-white">{prepInfo.prepDurationMinutes} د</strong>
                      </span>
                      {prepInfo.isOverdue ? (
                        <span className="bg-rose-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                          تأخير: +{prepInfo.delayMinutes} د ⚠️
                        </span>
                      ) : (
                        <span className="bg-sky-500/20 text-sky-200 border border-sky-500/40 px-2 py-0.5 rounded-full text-[10px]">
                          متبقي للهدف: {prepInfo.remainingMinutes} د
                        </span>
                      )}
                    </div>
                  )}

                  {/* Delivery Specific Info Box */}
                  {order.orderType === "DELIVERY" && (
                    <div className="bg-teal-950/40 border-b border-teal-500/30 p-2.5 space-y-1 text-xs">
                      <div className="flex justify-between items-center text-teal-300 font-bold">
                        <span>العميل: {order.customerName || order.customer?.name || "عميل دليفري"}</span>
                        <span className="font-mono">{order.customerPhone || order.customer?.phone || ""}</span>
                      </div>
                      <div className="text-[11px] text-stone-300">
                        📍 {order.deliveryAddress || order.customer?.address || "العنوان غير مسجل"}
                      </div>
                    </div>
                  )}

                  {/* Customer Grilling Special Info Box */}
                  {isGrill && (
                    <div className="bg-orange-950/40 border-b border-orange-500/30 p-2.5 space-y-1 text-xs">
                      <div className="flex justify-between items-center text-orange-300 font-bold">
                        <span>العميل: {order.customerName || order.customer?.name || "عميل خارجي"}</span>
                        <span>{order.customerPhone || order.customer?.phone || ""}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-stone-300">النوع: <strong className="text-white">{order.meatType || "مشكل"}</strong></span>
                        <span className="text-stone-300 font-mono">
                          الوزن المستلم: <strong className="text-orange-400 font-black">{((order.customerMeatWeight || 0) / 1000).toFixed(2)} كجم</strong>
                        </span>
                      </div>
                      {order.expectedPickupTime && (
                        <div className="text-[10px] text-amber-300 font-bold bg-orange-900/40 px-2 py-0.5 rounded text-center">
                          ⏰ مطلوب التسليم الساعة: {order.expectedPickupTime}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items List (Big bold text for kitchen) */}
                  <div className="p-3 flex-1 overflow-y-auto space-y-2 min-h-[140px] max-h-[320px]">
                    {order.items.length === 0 && isGrill ? (
                      <div className="text-center py-4 text-orange-300 font-bold text-xs">
                        خدمة شوي فقط دون طلب إضافات
                      </div>
                    ) : (
                      order.items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="bg-black/30 border border-white/5 rounded-xl p-2 flex items-start gap-2.5"
                        >
                          {/* Quantity pill */}
                          <span className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 font-black font-mono text-base flex items-center justify-center shrink-0 shadow">
                            {item.quantity}
                          </span>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-white leading-tight">
                              {item.menuItem?.nameAr || "صنف مشويات"}
                            </h4>
                            {item.notes && (
                              <p className="text-[11px] font-bold text-amber-300 mt-1 bg-amber-950/60 border border-amber-500/40 rounded px-1.5 py-0.5 inline-block">
                                ⚠️ {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Order Notes */}
                    {order.notes && (
                      <div className="mt-2 p-2 bg-stone-900/80 border border-stone-700/80 rounded-xl text-xs text-stone-300 font-medium">
                        <strong className="text-amber-400 block mb-0.5">ملاحظات عامة:</strong>
                        {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Card Action Controls (Requirement 1: Complete state machine) */}
                  <div className="p-2.5 bg-black/40 border-t border-white/10 space-y-1.5">
                    {/* State Actions */}
                    {currentSt === "OUT_FOR_DELIVERY" || currentSt === "HANDED_TO_CASHIER" ? (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "DELIVERED")}
                        disabled={isBusy}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition"
                      >
                        <span>✓</span>
                        <span>تم التسليم للعميل بالكامل (إنهاء)</span>
                      </button>
                    ) : currentSt === "READY" ? (
                      <div className="flex gap-1.5">
                        {order.orderType === "DELIVERY" ? (
                          <button
                            onClick={() => handleUpdateStatus(order.id, "OUT_FOR_DELIVERY")}
                            disabled={isBusy}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow transition"
                          >
                            <span>🛵</span>
                            <span>خرج مع الديليفري</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(order.id, "HANDED_TO_CASHIER")}
                            disabled={isBusy}
                            className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow transition"
                          >
                            <span>📦</span>
                            <span>تسليم للكاشير</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateStatus(order.id, "DELIVERED")}
                          disabled={isBusy}
                          className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow transition"
                          title="تسليم مباشر للعميل"
                        >
                          <span>✓ استلام</span>
                        </button>
                      </div>
                    ) : currentSt === "PREPARING" ? (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "READY")}
                        disabled={isBusy}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition"
                      >
                        <span>🔔</span>
                        <span>جاهز للتسليم الآن</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(order.id, "PREPARING")}
                        disabled={isBusy}
                        className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-600/30 transition"
                      >
                        <span>🍳</span>
                        <span>بدء التجهيز والطهي (45 د)</span>
                      </button>
                    )}

                    {/* Print slip shortcut */}
                    <button
                      onClick={() => handlePrintKitchenTicket(order)}
                      className="w-full bg-[#182033] hover:bg-[#202b45] text-stone-300 font-bold py-1 rounded-lg text-[10px] flex items-center justify-center gap-1 border border-stone-700/60 transition"
                    >
                      <span>🖨️</span>
                      <span>طباعة بون المطبخ</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
