"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  askAmoBasiony,
  confirmExpenseRegistration,
  AssistantResponse,
  PendingExpense,
} from "@/actions/assistant";

interface Message {
  id: string;
  sender: "user" | "basiony";
  text: string;
  time: string;
  category?: string;
  snapshot?: AssistantResponse["statsSnapshot"];
  pendingExpense?: PendingExpense;
  isConfirmed?: boolean;
}

export default function AmoBasionyWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Initialize with greeting
  useEffect(() => {
    const greetingTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    setMessages([
      {
        id: "msg-welcome",
        sender: "basiony",
        text: `يا مرحب بيك يا بطل في مشويات بسيوني! 🔥🥩
أنا «عمو بسيوني»، معاك لحظة بلحظة:
• سجل المصروفات بالعامية المصرية (مثلاً: «سجل 350 جنيه منظفات نقدي»).
• استعلم عن مبيعات اليوم، والدرج، ونواقص المخزون.
اختار أمر سريع من تحت أو اكتبلي أي حاجة في بالك!`,
        time: greetingTime,
      },
    ]);
  }, []);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || loading) return;

    const userTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = {
      id: "u-" + Date.now(),
      sender: "user",
      text: q,
      time: userTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await askAmoBasiony(q);
      const basionyTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      const basionyMsg: Message = {
        id: "b-" + Date.now(),
        sender: "basiony",
        text: res.answer,
        time: basionyTime,
        category: res.category,
        snapshot: res.statsSnapshot,
        pendingExpense: res.pendingExpenseConfirmation,
      };
      setMessages((prev) => [...prev, basionyMsg]);
    } catch (err) {
      const errTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "basiony",
          text: "معلش يا غالي حصل ضغط بسيط في شبكة الاتصال، اسألني تاني وأنا في خدمتك!",
          time: errTime,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExpense = async (msgId: string, pending: PendingExpense) => {
    setConfirmingId(msgId);
    try {
      const res = await confirmExpenseRegistration(pending);
      const confirmTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

      if (!res.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: "b-err-" + Date.now(),
            sender: "basiony",
            text: res.answer || "عذراً يا فندم، تعذر تسجيل المصروف في النظام حالياً.",
            time: confirmTime,
            category: "expenses",
          },
        ]);
        return;
      }

      // Mark the original pending message as confirmed
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true } : m))
      );

      // Add success message
      setMessages((prev) => [
        ...prev,
        {
          id: "b-conf-" + Date.now(),
          sender: "basiony",
          text: res.answer,
          time: confirmTime,
          category: "expenses",
        },
      ]);
    } catch (err: any) {
      alert("حدث خطأ أثناء اعتماد المصروف: " + (err.message || "فشل الاتصال"));
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancelExpense = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true, pendingExpense: undefined } : m))
    );
    const cancelTime = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [
      ...prev,
      {
        id: "b-cancel-" + Date.now(),
        sender: "basiony",
        text: "تم إلغاء أمر تسجيل المصروف بناءً على طلبك يا فنان. الدفاتر زي ما هي! 👌",
        time: cancelTime,
        category: "expenses",
      },
    ]);
  };

  const quickPrompts = [
    { label: "💸 سجل 350 جنيه منظفات", query: "سجل 350 جنيه منظفات نقدي" },
    { label: "🥩 سجل 500 جنيه لحمة", query: "سجل 500 جنيه لحمة بلدي كاش" },
    { label: "📊 مصروفات النهاردة", query: "مصروفات النهاردة كام؟" },
    { label: "📈 مبيعات اليوم والدرج", query: "طمّني على مبيعات وردية النهاردة والدرج" },
    { label: "🔥 الأصناف الأكثر طلباً", query: "مين أكتر أصناف مشويات مسمّعة ومطلوبة النهاردة؟" },
  ];

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none print:hidden font-sans">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 text-white px-4 py-3 rounded-full shadow-2xl border-2 border-orange-500/80 hover:border-orange-400 hover:scale-105 active:scale-95 transition-all duration-200"
          title="افتح مساعد الذكاء الاصطناعي - عمو بسيوني"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 shadow-md text-xl">
            🥩
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-neutral-900 rounded-full animate-pulse" />
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-orange-400 leading-tight">عمو بسيوني AI</div>
            <div className="text-[10px] text-neutral-300">المصروفات والمساعد الذكي</div>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          dir="rtl"
          className="w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh] bg-neutral-950 text-white rounded-2xl shadow-2xl border border-neutral-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 p-3.5 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-xl shadow-md border border-orange-400/50">
                🥩
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-orange-400">عمو بسيوني AI</h3>
                  <span className="text-[9px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">
                    مستشار المشويات والمصروفات
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400">مشويات بسيوني • إدارة: أ/ أحمد بسيوني</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title="تصغير"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-neutral-950/80">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "user" ? "items-start" : "items-end"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.sender === "user"
                      ? "bg-orange-600 text-white rounded-br-none shadow-md"
                      : "bg-neutral-900 text-neutral-100 rounded-bl-none border border-neutral-800 shadow-md"
                  }`}
                >
                  {m.text}

                  {/* Real-time KPI Card when relevant */}
                  {m.snapshot && m.category === "sales" && (
                    <div className="mt-2 pt-2 border-t border-neutral-800/80 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-neutral-950/60 p-2 rounded border border-neutral-800">
                        <span className="text-neutral-400 block">إيراد اليوم:</span>
                        <span className="font-mono font-bold text-orange-400 text-xs">
                          {m.snapshot.todaySales.toLocaleString()} ج.م
                        </span>
                      </div>
                      <div className="bg-neutral-950/60 p-2 rounded border border-neutral-800">
                        <span className="text-neutral-400 block">مصروفات اليوم:</span>
                        <span className="font-mono font-bold text-red-400 text-xs">
                          {m.snapshot.todayExpenses.toLocaleString()} ج.م
                        </span>
                      </div>
                    </div>
                  )}

                  {/* INTERACTIVE EXPENSE CONFIRMATION CARD */}
                  {m.pendingExpense && !m.isConfirmed && (
                    <div className="mt-3 p-3 rounded-xl bg-orange-950/40 border border-orange-500/40 text-neutral-200 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-orange-400 border-b border-orange-500/20 pb-1.5">
                        <span>إذن صرف مقترح</span>
                        <span className="font-mono text-white text-sm bg-orange-600/60 px-2 py-0.5 rounded">
                          {m.pendingExpense.amount.toLocaleString()} ج.م
                        </span>
                      </div>
                      <div className="text-[11px] space-y-1">
                        <div>
                          <span className="text-neutral-400">البند: </span>
                          <strong className="text-white">{m.pendingExpense.categoryName}</strong>
                        </div>
                        <div>
                          <span className="text-neutral-400">طريقة الدفع: </span>
                          <span className="text-amber-300">
                            {m.pendingExpense.paymentMethod === "CASH"
                              ? "نقدي (من الدرج)"
                              : m.pendingExpense.paymentMethod === "VISA"
                              ? "فيزا / كارت"
                              : "تحويل بنكي"}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleConfirmExpense(m.id, m.pendingExpense!)}
                          disabled={confirmingId === m.id}
                          className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow"
                        >
                          {confirmingId === m.id ? (
                            <span>جاري الحفظ...</span>
                          ) : (
                            <>
                              <span>✓</span>
                              <span>تأكيد تسجيل المصروف</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleCancelExpense(m.id)}
                          disabled={confirmingId === m.id}
                          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-1.5 px-2.5 rounded-lg text-xs transition"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}

                  {m.isConfirmed && (
                    <div className="mt-2 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded-md flex items-center gap-1">
                      <span>✓</span>
                      <span>تمت معالجة أمر المصروف</span>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-neutral-500 mt-1 px-1">{m.time}</span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-neutral-400 text-xs bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800 w-fit">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                <span>عمو بسيوني بيراجع السجلات وبيحسبها...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-2 bg-neutral-900/90 border-t border-neutral-800 flex gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSend(p.query)}
                className="whitespace-nowrap text-[10px] bg-neutral-800 hover:bg-neutral-700 active:bg-orange-600/30 text-neutral-300 hover:text-orange-400 px-2.5 py-1.5 rounded-lg border border-neutral-700/60 transition disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب لعمو بسيوني (مثلاً: سجل 350 جنيه منظفات نقدي)..."
              disabled={loading}
              className="flex-1 bg-neutral-950 text-white text-xs px-3 py-2 rounded-xl border border-neutral-700 focus:outline-none focus:border-orange-500 placeholder-neutral-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white p-2 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              title="إرسال"
            >
              <svg className="w-4 h-4 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
