"use client";

import React, { useState, useEffect, useRef } from "react";
import { askAmoBasiony, AssistantResponse } from "@/actions/assistant";

interface Message {
  id: string;
  sender: "user" | "basiony";
  text: string;
  time: string;
  category?: string;
  snapshot?: AssistantResponse["statsSnapshot"];
}

export default function AmoBasionyWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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
أنا «عمو بسيوني»، معاك دايماً في طالع ونازل المطعم: مبيعات، دروج، مخزون، وجريل.
اختار سؤال سريع من تحت أو اكتبلي أي حاجة في بالك!`,
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

  const quickPrompts = [
    { label: "📊 مبيعات اليوم", query: "طمّني على مبيعات وردية النهاردة والدرج" },
    { label: "🥩 نواقص اللحوم والمخزون", query: "إيه أخبار نواقص المخزون واللحوم والجريل؟" },
    { label: "🔥 الأصناف الأكثر طلباً", query: "مين أكتر أصناف مشويات مسمّعة ومطلوبة النهاردة؟" },
    { label: "💡 ضبط الدرج ومنع العجز", query: "نصيحة عمو بسيوني لقفل الوردية وضبط الدرج" },
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
            <div className="text-[10px] text-neutral-300">مساعد الكاشير الذكي</div>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          dir="rtl"
          className="w-[92vw] sm:w-[410px] h-[560px] max-h-[85vh] bg-neutral-950 text-white rounded-2xl shadow-2xl border border-neutral-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200"
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
                    مستشار المشويات
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
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
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
                        <span className="text-neutral-400 block">عدد الطلبات:</span>
                        <span className="font-mono font-bold text-neutral-200 text-xs">
                          {m.snapshot.todayOrdersCount} طلب
                        </span>
                      </div>
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
              placeholder="اسأل عمو بسيوني عن أي حاجة في المطعم..."
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
