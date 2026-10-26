"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  askAmoBasiony,
  confirmExpenseRegistration,
  searchOrdersForCashier,
  askAdminAssistant,
  getFinancialAuditDashboardData,
  OrderSearchResult,
  AdminReportData,
  PendingExpense,
} from "@/actions/assistant";

type TabMode = "SEARCH" | "CHAT" | "REPORTS" | "AUDIT";

interface ChatMessage {
  id: string;
  sender: "user" | "basiony";
  text: string;
  time: string;
  pendingExpense?: PendingExpense;
  matchingOrders?: OrderSearchResult[];
  isConfirmed?: boolean;
}

const STORAGE_KEY = "amo_basiony_pos_v2";

export default function AmoBasionyWidget() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "CASHIER";
  const isAdmin = userRole === "ADMIN";

  // Widget Open State
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>("SEARCH");

  // Draggable Floating Position State
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 20, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number; moved: boolean }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  });

  // Order Search Tab State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OrderSearchResult[]>([]);
  const [searchHasSearched, setSearchHasSearched] = useState(false);

  // Conversational Chat Tab State
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [confirmingExpenseId, setConfirmingExpenseId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Admin Reports Tab State
  const [adminReportPeriod, setAdminReportPeriod] = useState<"TODAY" | "WEEK" | "MONTH" | "ALL">("TODAY");
  const [adminReportData, setAdminReportData] = useState<AdminReportData | null>(null);
  const [loadingAdminReport, setLoadingAdminReport] = useState(false);

  // Financial Audit Tab State
  const [auditData, setAuditData] = useState<{
    recentLogs: any[];
    exceptions: any;
  } | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Load Saved Position on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const clampedX = Math.max(10, Math.min(window.innerWidth - 70, parsed.x || 20));
        const clampedY = Math.max(10, Math.min(window.innerHeight - 70, parsed.y || 120));
        setPosition({ x: clampedX, y: clampedY });
      } else {
        // Default: Bottom left
        setPosition({ x: 20, y: Math.max(80, window.innerHeight - 150) });
      }
    } catch (e) {
      // localStorage error fallback
    }
  }, []);

  // Window Resize Clamping
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.max(10, Math.min(window.innerWidth - 70, prev.x)),
        y: Math.max(10, Math.min(window.innerHeight - 70, prev.y)),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Save Position to LocalStorage
  const savePosition = (x: number, y: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch (e) {
      // ignore
    }
  };

  // Reset to Default Position
  const handleResetPosition = () => {
    const defX = 20;
    const defY = Math.max(80, window.innerHeight - 150);
    setPosition({ x: defX, y: defY });
    savePosition(defX, defY);
  };

  // -------------------------------------------------------------
  // MOUSE & TOUCH DRAGGING ENGINE
  // -------------------------------------------------------------
  const handleStartDrag = (clientX: number, clientY: number) => {
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: position.x,
      startY: position.y,
      moved: false,
    };
    setIsDragging(true);
  };

  const handleMoveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStartRef.current.mouseX;
    const dy = clientY - dragStartRef.current.mouseY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragStartRef.current.moved = true;
    }

    const newX = Math.max(10, Math.min(window.innerWidth - 70, dragStartRef.current.startX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 70, dragStartRef.current.startY + dy));
    setPosition({ x: newX, y: newY });
  };

  const handleEndDrag = () => {
    if (isDragging) {
      setIsDragging(false);
      savePosition(position.x, position.y);
    }
  };

  // Mouse Listeners
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMoveDrag(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      if (isDragging) handleEndDrag();
    };
    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  // Touch Listeners
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMoveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => {
      if (isDragging) handleEndDrag();
    };
    if (isDragging) {
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
    }
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging]);

  // Initial Chat Greeting
  useEffect(() => {
    const time = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    setChatMessages([
      {
        id: "welcome-msg",
        sender: "basiony",
        text: `يا مرحب بيك يا بطل في مشويات بسيوني! 🥩🔥
أنا «عمو بسيوني» المساعد الميداني والرقابي الذكي.
تقدر تبحث عن أي أوردر، تسجل المصروفات بالعامية، أو تطلب تقارير الخزنة والمبيعات!`,
        time,
      },
    ]);
  }, []);

  // -------------------------------------------------------------
  // TAB ACTIONS
  // -------------------------------------------------------------

  // 1. Order Search
  const handleExecuteSearch = async (overrideQ?: string) => {
    const q = (overrideQ !== undefined ? overrideQ : searchQuery).trim();
    if (!q) return;
    setIsSearching(true);
    setSearchHasSearched(true);
    try {
      const res = await searchOrdersForCashier({ query: q, limit: 30 });
      if (res.success) {
        setSearchResults(res.orders);
      } else {
        alert(res.error || "فشل البحث عن الأوردرات");
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // 2. Chat Send
  const handleSendChatMessage = async (textOverride?: string) => {
    const text = (textOverride || chatInput).trim();
    if (!text || chatLoading) return;

    const userTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      sender: "user",
      text,
      time: userTime,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await askAmoBasiony(text);
      const basionyTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      const basionyMsg: ChatMessage = {
        id: "b-" + Date.now(),
        sender: "basiony",
        text: res.answer,
        time: basionyTime,
        pendingExpense: res.pendingExpenseConfirmation,
        matchingOrders: res.matchingOrders,
      };
      setChatMessages((prev) => [...prev, basionyMsg]);
    } catch (err) {
      const errTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      setChatMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "basiony",
          text: "معلش يا غالي، حصل ضغط في الشبكة. اسألني تاني وأنا في خدمتك!",
          time: errTime,
        },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  // 3. Confirm Expense
  const handleConfirmExpense = async (msgId: string, pending: PendingExpense) => {
    setConfirmingExpenseId(msgId);
    try {
      const res = await confirmExpenseRegistration(pending);
      const time = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      setChatMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true } : m))
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: "conf-" + Date.now(),
          sender: "basiony",
          text: res.answer,
          time,
        },
      ]);
    } catch (e: any) {
      alert("فشل تأكيد المصروف: " + e.message);
    } finally {
      setConfirmingExpenseId(null);
    }
  };

  // 4. Fetch Admin Report
  const handleFetchAdminReport = async (period: "TODAY" | "WEEK" | "MONTH" | "ALL") => {
    if (!isAdmin) return;
    setLoadingAdminReport(true);
    setAdminReportPeriod(period);
    try {
      const data = await askAdminAssistant({ query: "تقرير شامل", period });
      setAdminReportData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAdminReport(false);
    }
  };

  // 5. Fetch Financial Audit
  const handleFetchAudit = async () => {
    if (!isAdmin) return;
    setLoadingAudit(true);
    try {
      const data = await getFinancialAuditDashboardData();
      setAuditData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Trigger data loads when switching tabs
  useEffect(() => {
    if (isOpen) {
      if (activeTab === "REPORTS" && isAdmin && !adminReportData) {
        handleFetchAdminReport("TODAY");
      } else if (activeTab === "AUDIT" && isAdmin && !auditData) {
        handleFetchAudit();
      }
    }
  }, [isOpen, activeTab, isAdmin]);

  return (
    <div className="font-sans select-none print:hidden">
      {/* ----------------------------------------------------------- */}
      {/* 1. FLOATING & DRAGGABLE TOGGLE ICON */}
      {/* ----------------------------------------------------------- */}
      {!isOpen && (
        <div
          style={{
            position: "fixed",
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 9999,
            touchAction: "none",
          }}
          className="cursor-grab active:cursor-grabbing transition-transform duration-75"
          onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            if (e.touches[0]) handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onClick={(e) => {
            // Distinguish click from drag
            if (!dragStartRef.current.moved) {
              setIsOpen(true);
            }
          }}
          title="اضغط لفتح عمو بسيوني، أو اسحب لتغيير الموضع"
        >
          <div className="group relative flex items-center gap-2.5 bg-gradient-to-r from-neutral-900 via-[#131929] to-neutral-900 text-white px-3.5 py-2.5 rounded-full shadow-2xl border-2 border-amber-500/80 hover:border-amber-400 hover:scale-105 active:scale-95 transition-all">
            {/* Mascot Avatar with pulsating online indicator */}
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 shadow-md text-xl">
              🥩
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-neutral-900 rounded-full animate-pulse" />
            </div>

            <div className="text-right">
              <div className="text-xs font-black text-amber-400 leading-tight flex items-center gap-1">
                <span>عمو بسيوني</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded">
                  {isAdmin ? "إدارة 🛡️" : "كاشير 🔍"}
                </span>
              </div>
              <div className="text-[10px] text-stone-300">بحث الأوردرات والمساعد الذكي</div>
            </div>

            {/* Drag Handle Indicator */}
            <div className="text-stone-500 group-hover:text-amber-400 text-xs px-0.5" title="اسحب في أي مكان">
              ⋮⋮
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* 2. RESPONSIVE ASSISTANT MODAL WINDOW */}
      {/* ----------------------------------------------------------- */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-3 sm:p-4">
          <div
            dir="rtl"
            className="w-full max-w-[500px] h-[640px] max-h-[90vh] bg-[#0c101c] text-stone-100 rounded-3xl shadow-2xl border border-[#1e263d] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#111728] via-[#141b2f] to-[#0f1424] p-3.5 border-b border-[#1c2438] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-md border border-amber-400/40">
                  🥩
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-sm text-amber-400">عمو بسيوني الذكي</h2>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                      {isAdmin ? "وضع الإدارة والرقابة 🛡️" : "مساعد الكاشير 🔍"}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-400">
                    مشويات بسيوني • بحث الأوردرات، المصروفات، والتقارير الحية
                  </p>
                </div>
              </div>

              {/* Window Controls: Reset Position + Close */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleResetPosition}
                  className="p-1.5 rounded-xl bg-[#182033] hover:bg-stone-800 text-stone-400 hover:text-amber-400 text-xs transition"
                  title="إعادة ضبط موضع الأيقونة العائمة"
                >
                  📍
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl bg-[#182033] hover:bg-stone-800 text-stone-400 hover:text-white text-xs transition"
                  title="إغلاق"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="flex items-center gap-1 p-2 bg-[#090d16] border-b border-[#1c2438] text-xs overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("SEARCH")}
                className={`flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-[11px] whitespace-nowrap ${
                  activeTab === "SEARCH"
                    ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                    : "text-stone-400 hover:bg-[#111726] hover:text-stone-200"
                }`}
              >
                <span>🔍</span>
                <span>بحث الأوردرات</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("CHAT")}
                className={`flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-[11px] whitespace-nowrap ${
                  activeTab === "CHAT"
                    ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                    : "text-stone-400 hover:bg-[#111726] hover:text-stone-200"
                }`}
              >
                <span>💬</span>
                <span>عمو بسيوني</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("REPORTS")}
                className={`flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-[11px] whitespace-nowrap ${
                  activeTab === "REPORTS"
                    ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                    : "text-stone-400 hover:bg-[#111726] hover:text-stone-200"
                }`}
              >
                <span>📊</span>
                <span>تقارير الإدارة</span>
                {!isAdmin && <span className="text-[9px]">🔒</span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("AUDIT")}
                className={`flex-1 py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-[11px] whitespace-nowrap ${
                  activeTab === "AUDIT"
                    ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                    : "text-stone-400 hover:bg-[#111726] hover:text-stone-200"
                }`}
              >
                <span>🛡️</span>
                <span>الرقابة والتدقيق</span>
                {!isAdmin && <span className="text-[9px]">🔒</span>}
              </button>
            </div>

            {/* ------------------------------------------------------- */}
            {/* TAB CONTENT 1: ORDER SEARCH (CASHIER & ALL USERS) */}
            {/* ------------------------------------------------------- */}
            {activeTab === "SEARCH" && (
              <div className="flex-1 flex flex-col overflow-hidden p-3 bg-[#0a0e19]">
                {/* Search Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleExecuteSearch();
                  }}
                  className="flex items-center gap-2 mb-3"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث برقم الأوردر (#123) أو تليفون العميل (010...)"
                      className="w-full bg-[#111726] border border-stone-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-stone-500 outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-3 top-2.5 text-stone-500 text-xs">🔍</span>
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2 rounded-xl text-xs font-black transition disabled:opacity-40"
                  >
                    {isSearching ? "جاري البحث..." : "بحث"}
                  </button>
                </form>

                {/* Quick Shortcuts */}
                <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none pb-1">
                  <span className="text-[10px] text-stone-500 shrink-0">اختصارات:</span>
                  <button
                    onClick={() => {
                      setSearchQuery("#");
                      handleExecuteSearch("#");
                    }}
                    className="text-[10px] bg-[#141b2c] text-stone-300 px-2 py-1 rounded-lg border border-stone-800 hover:border-amber-500 shrink-0"
                  >
                    أحدث الأوردرات
                  </button>
                  <button
                    onClick={() => {
                      setSearchQuery("شوي للغير");
                      handleExecuteSearch("شوي للغير");
                    }}
                    className="text-[10px] bg-[#141b2c] text-amber-300 px-2 py-1 rounded-lg border border-amber-500/30 hover:border-amber-500 shrink-0"
                  >
                    طلبات شوي للغير
                  </button>
                </div>

                {/* Search Results List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                  {searchResults.length === 0 && searchHasSearched && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-stone-500 text-xs">
                      <span className="text-3xl mb-2">🔍</span>
                      <p className="font-bold text-stone-400">لم يتم العثور على أوردرات مطابقة</p>
                      <p className="text-[11px] text-stone-600 mt-1">تأكد من كتابة رقم الأوردر أو رقم التليفون بشكل صحيح</p>
                    </div>
                  )}

                  {searchResults.length === 0 && !searchHasSearched && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-stone-500 text-xs">
                      <span className="text-3xl mb-2">📋</span>
                      <p className="font-bold text-stone-400">البحث السريع عن الأوردرات</p>
                      <p className="text-[11px] text-stone-600 mt-1">
                        اكتب رقم الأوردر أو رقم هاتف العميل واضغط بحث لعرض تفاصيل الفاتورة وحالتها
                      </p>
                    </div>
                  )}

                  {searchResults.map((order) => (
                    <div
                      key={order.id}
                      className="bg-[#101626] border border-[#1d263d] rounded-2xl p-3 text-xs space-y-2 hover:border-amber-500/50 transition"
                    >
                      {/* Top Row: Order # + Status Badges */}
                      <div className="flex items-center justify-between border-b border-[#1a233a] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-amber-400 text-sm">
                            #{order.orderNumber}
                          </span>
                          <span className="bg-[#182033] text-stone-300 px-2 py-0.5 rounded text-[10px] font-bold">
                            {order.orderTypeAr}
                          </span>
                          {order.tableName && (
                            <span className="text-[10px] text-stone-400">({order.tableName})</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              order.paymentStatus === "PAID"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                                : order.paymentStatus === "CANCELLED"
                                ? "bg-rose-500/15 text-rose-400 border border-rose-500/40"
                                : "bg-amber-500/15 text-amber-400 border border-amber-500/40"
                            }`}
                          >
                            {order.paymentStatusAr}
                          </span>
                          <span className="bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {order.workflowStatusAr}
                          </span>
                        </div>
                      </div>

                      {/* Customer Info & Time */}
                      <div className="flex items-center justify-between text-[11px] text-stone-400">
                        <div>
                          <span>👤 {order.customerName || "عميل عام"}</span>
                          {order.customerPhone && (
                            <span className="font-mono text-stone-300 mr-2">({order.customerPhone})</span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-stone-500">{order.createdAtFormatted}</span>
                      </div>

                      {/* Grilling Raw Meat Details if applicable */}
                      {order.orderKind === "CUSTOMER_GRILL" && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 text-[11px] text-amber-300">
                          <span className="font-bold">خامة العميل: </span>
                          <span>{order.meatType || "لحم مشوي"}</span>
                          {order.customerMeatWeight ? (
                            <span className="font-mono mr-1">({order.customerMeatWeight} كجم)</span>
                          ) : null}
                        </div>
                      )}

                      {/* Order Items Breakdown */}
                      <div className="bg-[#0b0f1a] rounded-xl p-2 space-y-1">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="text-stone-200">
                              • {it.nameAr} <span className="text-stone-500">×{it.quantity}</span>
                            </span>
                            <span className="font-mono text-stone-300">{it.totalPrice.toFixed(2)} ج.م</span>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Row: Total & Subtotal */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#1a233a] font-bold">
                        <div className="text-[11px] text-stone-400">
                          {order.discount > 0 && (
                            <span className="text-rose-400 ml-2">خصم: -{order.discount} ج.م</span>
                          )}
                          <span>الأصناف: {order.itemsCount}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-stone-400 text-[10px] ml-1">الإجمالي:</span>
                          <span className="font-mono font-black text-amber-400 text-sm">
                            {order.totalAmount.toFixed(2)} ج.م
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* TAB CONTENT 2: CHAT WITH AMO BASIONY (EXPENSES & HELP) */}
            {/* ------------------------------------------------------- */}
            {activeTab === "CHAT" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0e19]">
                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.sender === "user" ? "items-start" : "items-end"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                          m.sender === "user"
                            ? "bg-amber-600 text-stone-950 font-bold rounded-br-none shadow"
                            : "bg-[#111728] text-stone-100 rounded-bl-none border border-[#1e2740] shadow"
                        }`}
                      >
                        {m.text}

                        {/* Interactive Expense Confirmation Card */}
                        {m.pendingExpense && !m.isConfirmed && (
                          <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-stone-200 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-400 border-b border-amber-500/20 pb-1.5">
                              <span>إذن صرف مقترح</span>
                              <span className="font-mono text-stone-950 font-black text-sm bg-amber-400 px-2 py-0.5 rounded">
                                {m.pendingExpense.amount} ج.م
                              </span>
                            </div>
                            <div className="text-[11px] space-y-1">
                              <div>
                                <span className="text-stone-400">البند: </span>
                                <strong className="text-white">{m.pendingExpense.categoryName}</strong>
                              </div>
                              <div>
                                <span className="text-stone-400">طريقة السداد: </span>
                                <span className="text-amber-300">
                                  {m.pendingExpense.paymentMethod === "CASH"
                                    ? "نقدي (خصم من درج الوردية)"
                                    : "فيزا / تحويل"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmExpense(m.id, m.pendingExpense!)}
                                disabled={confirmingExpenseId === m.id}
                                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold py-1.5 rounded-lg text-xs transition"
                              >
                                {confirmingExpenseId === m.id ? "جاري الحفظ..." : "✓ تأكيد تسجيل المصروف"}
                              </button>
                            </div>
                          </div>
                        )}

                        {m.isConfirmed && (
                          <div className="mt-2 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded-md flex items-center gap-1 font-bold">
                            <span>✓</span>
                            <span>تم تسجيل المصروف وتحديث الخزنة</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-stone-500 mt-1 px-1">{m.time}</span>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex items-center gap-2 text-stone-400 text-xs bg-[#111728] p-2.5 rounded-xl border border-stone-800 w-fit">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span>عمو بسيوني بيراجع السجلات وبيحسبها...</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Quick Suggestion Chips */}
                <div className="p-2 bg-[#0c111e] border-t border-[#1c2438] flex gap-1.5 overflow-x-auto scrollbar-none">
                  {[
                    "سجل 350 جنيه منظفات نقدي",
                    "سجل 200 جنيه فحم شوي كاش",
                    "مبيعات وردية النهاردة كام؟",
                    "أكتر أصناف مشويات مسمّعة النهاردة",
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChatMessage(chip)}
                      className="whitespace-nowrap text-[10px] bg-[#141b2e] hover:bg-[#1a243d] text-stone-300 hover:text-amber-400 px-2.5 py-1.5 rounded-lg border border-stone-800 shrink-0 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Input Field */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChatMessage();
                  }}
                  className="p-2.5 bg-[#0c111e] border-t border-[#1c2438] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="اكتب لعمو بسيوني (مثلاً: سجل 350 جنيه منظفات نقدي)..."
                    disabled={chatLoading}
                    className="flex-1 bg-[#121828] text-white text-xs px-3 py-2 rounded-xl border border-stone-800 outline-none focus:border-amber-500 placeholder-stone-500"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-2 rounded-xl text-xs font-black transition disabled:opacity-40"
                  >
                    إرسال
                  </button>
                </form>
              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* TAB CONTENT 3: ADMIN SMART REPORTS (ADMIN ONLY) */}
            {/* ------------------------------------------------------- */}
            {activeTab === "REPORTS" && (
              <div className="flex-1 flex flex-col overflow-hidden p-3 bg-[#0a0e19]">
                {!isAdmin ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs">
                    <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-2xl mb-3 text-rose-400">
                      🔒
                    </div>
                    <h3 className="font-bold text-base text-rose-400 mb-1">صلاحية مقيدة للإدارة العليا</h3>
                    <p className="text-stone-400 max-w-xs leading-relaxed">
                      هذا القسم مخصص حصريًا لحساب الأدمن (ADMIN) للاطلاع على تقارير الأرباح والخسائر وحركة الخزنة والرقابة الشاملة.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                    {/* Period Switcher */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(["TODAY", "WEEK", "MONTH", "ALL"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleFetchAdminReport(p)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition ${
                            adminReportPeriod === p
                              ? "bg-amber-500/20 border-amber-500 text-amber-300 font-black"
                              : "bg-[#111728] border-stone-800 text-stone-400 hover:border-stone-600"
                          }`}
                        >
                          {p === "TODAY" ? "اليوم" : p === "WEEK" ? "7 أيام" : p === "MONTH" ? "هذا الشهر" : "الكل"}
                        </button>
                      ))}
                    </div>

                    {loadingAdminReport ? (
                      <div className="flex-1 flex items-center justify-center text-xs text-stone-400">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping ml-2" />
                        <span>جاري استخراج وتحليل بيانات التقرير...</span>
                      </div>
                    ) : adminReportData ? (
                      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
                        {/* Executive KPI Cards */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-[#111728] border border-[#1d263d] p-2.5 rounded-xl">
                            <span className="text-[10px] text-stone-400 block">صافي المبيعات المحصلة</span>
                            <span className="font-mono font-black text-amber-400 text-base">
                              {adminReportData.summary.netSales.toLocaleString()} ج.م
                            </span>
                            <span className="text-[9px] text-stone-500 block">
                              {adminReportData.summary.paidOrdersCount} طلب مسدد
                            </span>
                          </div>

                          <div className="bg-[#111728] border border-[#1d263d] p-2.5 rounded-xl">
                            <span className="text-[10px] text-stone-400 block">صافي الربح التقديري</span>
                            <span className="font-mono font-black text-emerald-400 text-base">
                              {adminReportData.summary.estimatedNetProfit.toLocaleString()} ج.م
                            </span>
                            <span className="text-[9px] text-stone-500 block">بعد التكاليف والمصروفات</span>
                          </div>

                          <div className="bg-[#111728] border border-[#1d263d] p-2.5 rounded-xl">
                            <span className="text-[10px] text-stone-400 block">إجمالي المصروفات</span>
                            <span className="font-mono font-black text-rose-400 text-sm">
                              -{adminReportData.summary.totalExpenses.toLocaleString()} ج.م
                            </span>
                          </div>

                          <div className="bg-[#111728] border border-[#1d263d] p-2.5 rounded-xl">
                            <span className="text-[10px] text-stone-400 block">الفواتير الملغاة</span>
                            <span className="font-mono font-black text-rose-300 text-sm">
                              {adminReportData.summary.cancelledOrdersCount} فاتورة
                            </span>
                            <span className="text-[9px] text-stone-500 block">
                              ({adminReportData.summary.cancelledTotalAmount.toLocaleString()} ج.م)
                            </span>
                          </div>
                        </div>

                        {/* Audit Alerts / Anomalies */}
                        {adminReportData.anomalies.length > 0 && (
                          <div className="bg-rose-950/20 border border-rose-500/40 rounded-2xl p-3 text-xs space-y-1">
                            <div className="font-bold text-rose-400 flex items-center gap-1.5">
                              <span>🚨</span>
                              <span>تنبيهات الرقابة والاستثناءات المرصودة:</span>
                            </div>
                            {adminReportData.anomalies.map((anom, i) => (
                              <p key={i} className="text-stone-300 text-[11px]">
                                • {anom}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Channel Sales Breakdown */}
                        <div className="bg-[#111728] border border-[#1d263d] rounded-2xl p-3 text-xs space-y-2">
                          <h4 className="font-bold text-stone-200 text-xs">قنوات البيع والمبيعات:</h4>
                          <div className="space-y-1.5">
                            {adminReportData.channelBreakdown.map((ch, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px]">
                                <span className="text-stone-300">{ch.channelAr}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-stone-500 text-[10px]">{ch.count} طلب</span>
                                  <span className="font-mono font-bold text-amber-400">{ch.total.toLocaleString()} ج.م</span>
                                  <span className="bg-[#182033] px-1.5 py-0.2 rounded text-[10px] text-stone-400 font-mono">
                                    {ch.percentage}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Best Selling Items */}
                        <div className="bg-[#111728] border border-[#1d263d] rounded-2xl p-3 text-xs space-y-2">
                          <h4 className="font-bold text-stone-200 text-xs">الأصناف الأكثر طلباً:</h4>
                          <div className="space-y-1">
                            {adminReportData.topItems.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px]">
                                <span className="text-stone-300">{i + 1}. {item.name}</span>
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="text-stone-400">×{item.quantity}</span>
                                  <span className="text-amber-400 font-bold">{item.revenue.toLocaleString()} ج.م</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* TAB CONTENT 4: FINANCIAL AUDIT & EXCEPTIONS (ADMIN ONLY) */}
            {/* ------------------------------------------------------- */}
            {activeTab === "AUDIT" && (
              <div className="flex-1 flex flex-col overflow-hidden p-3 bg-[#0a0e19]">
                {!isAdmin ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs">
                    <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-2xl mb-3 text-rose-400">
                      🔒
                    </div>
                    <h3 className="font-bold text-base text-rose-400 mb-1">الرقابة المالية مخصصة للأدمن</h3>
                    <p className="text-stone-400 max-w-xs leading-relaxed">
                      سجلات التدقيق المركزي وحركات الخزنة وتتبع الإلغاءات محمية بصلاحيات الإدارة العليا لمنع التلاعب.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                    {loadingAudit ? (
                      <div className="flex-1 flex items-center justify-center text-xs text-stone-400">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping ml-2" />
                        <span>جاري قراءة سجل التدقيق المركزي...</span>
                      </div>
                    ) : auditData ? (
                      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
                        {/* Summary Badges */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-[#111728] border border-[#1d263d] p-2 rounded-xl">
                            <span className="text-[10px] text-stone-400 block">الإلغاءات اليوم</span>
                            <span className="font-mono font-bold text-rose-400">
                              {auditData.exceptions.cancellationsCount}
                            </span>
                          </div>
                          <div className="bg-[#111728] border border-[#1d263d] p-2 rounded-xl">
                            <span className="text-[10px] text-stone-400 block">الخصومات اليوم</span>
                            <span className="font-mono font-bold text-amber-400">
                              {auditData.exceptions.discountsCount}
                            </span>
                          </div>
                          <div className="bg-[#111728] border border-[#1d263d] p-2 rounded-xl">
                            <span className="text-[10px] text-stone-400 block">عجز الورديات</span>
                            <span className="font-mono font-bold text-rose-400">
                              {auditData.exceptions.shiftsShortageTotal.toFixed(0)} ج.م
                            </span>
                          </div>
                        </div>

                        {/* Recent Audit Log Feed */}
                        <div className="space-y-2">
                          <h4 className="font-bold text-stone-200 text-xs">أحدث عمليات التدقيق المركزي (PostgreSQL):</h4>
                          {auditData.recentLogs.map((log) => (
                            <div
                              key={log.id}
                              className="bg-[#111728] border border-[#1e263d] rounded-xl p-2.5 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-400 text-[11px]">{log.action}</span>
                                <span className="text-[10px] text-stone-500 font-mono">
                                  {new Date(log.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-300">{log.reason || "بدون سبب مدون"}</p>
                              <div className="flex items-center justify-between text-[10px] text-stone-500 border-t border-stone-800/80 pt-1">
                                <span>المستخدم: {log.userName} ({log.userRole})</span>
                                {log.orderId && <span>طلب: {log.orderId.slice(-6)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
