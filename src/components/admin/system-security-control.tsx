"use client";

import { useState, useEffect } from "react";

interface AuditLog {
  id: string;
  action: string;
  actionAr: string;
  performedBy: string;
  timestamp: string;
  details?: string;
}

export default function SystemSecurityControl({
  initialLocked,
  initialLockedBy,
  initialLockedAt,
  initialLogs,
  userName,
}: {
  initialLocked: boolean;
  initialLockedBy?: string | null;
  initialLockedAt?: string | null;
  initialLogs: AuditLog[];
  userName: string;
}) {
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [lockedBy, setLockedBy] = useState(initialLockedBy);
  const [lockedAt, setLockedAt] = useState(initialLockedAt);
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Poll system status every 6 seconds to keep all devices in sync
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/system-status");
        if (res.ok) {
          const data = await res.json();
          setIsLocked(data.isLocked);
          setLockedBy(data.lockedBy);
          setLockedAt(data.lockedAt);
          if (data.logs) setLogs(data.logs);
        }
      } catch (err) {
        console.error("Status poll error:", err);
      }
    };

    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: "LOCK" | "UNLOCK" | "FORCE_LOGOUT") => {
    let confirmPrompt = "";
    if (action === "LOCK") {
      confirmPrompt = "هل أنت متأكد من قفل النظام على جميع الأجهزة فوراً؟\nسيتم منع الكاشير والمستخدمين من إنشاء الطلبات أو تعديلها أو إتمام الدفع.";
    } else if (action === "UNLOCK") {
      confirmPrompt = "هل أنت متأكد من إعادة فتح النظام لجميع أجهزة الكاشير والمستخدمين؟";
    } else if (action === "FORCE_LOGOUT") {
      confirmPrompt = "⚠️ تحذير أمني: هل أنت متأكد من تسجيل الخروج الإجباري من جميع الأجهزة؟\nسيتم إبطال جميع الجلسات النشطة فوراً ومطالبة المستخدمين بتسجيل الدخول مرة أخرى.";
    }

    if (!window.confirm(confirmPrompt)) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/system-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "فشل تنفيذ العملية");
      } else {
        setMessage(data.message);
        if (action === "LOCK") {
          setIsLocked(true);
          setLockedBy(userName);
          setLockedAt(new Date().toLocaleString("ar-EG"));
        } else if (action === "UNLOCK") {
          setIsLocked(false);
          setLockedBy(null);
          setLockedAt(null);
        }
        // Refresh logs
        const statusRes = await fetch("/api/system-status");
        if (statusRes.ok) {
          const st = await statusRes.json();
          if (st.logs) setLogs(st.logs);
        }
      }
    } catch (err: any) {
      alert("حدث خطأ في الاتصال: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-stone-900 border border-orange-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden text-stone-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🛡️</span>
            <h2 className="text-lg sm:text-xl font-black text-orange-400">
              التحكم الأمني المركزي وقفل النظام
            </h2>
          </div>
          <p className="text-stone-400 text-xs">
            إدارة حالة النظام المركزية، قفل البيع من أي جهاز، وتسجيل الخروج الإجباري وسجل الأمان
          </p>
        </div>

        {/* Current State Pill */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400">الحالة الحالية:</span>
          {isLocked ? (
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 font-black text-xs flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>🔒 مقفول بواسطة الإدارة</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-black text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>🟢 مفتوح ومتاح للعمل</span>
            </span>
          )}
        </div>
      </div>

      {/* Lock details banner if locked */}
      {isLocked && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 mb-5 text-xs text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-bold">جميع عمليات البيع وإنشاء الطلبات معلقة على مستوى الخادم.</p>
              <p className="text-stone-400 text-[11px]">
                تم القفل بواسطة: <span className="text-rose-300 font-bold">{lockedBy || "الإدارة"}</span> • التوقيت: {lockedAt || "الآن"}
              </p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 mb-5 text-xs text-emerald-300 flex items-center gap-2">
          <span>✓</span>
          <span>{message}</span>
        </div>
      )}

      {/* Control Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Button 1: Lock System */}
        <button
          onClick={() => handleAction("LOCK")}
          disabled={loading || isLocked}
          className={`py-3 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow-lg ${
            isLocked
              ? "bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700"
              : "bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-900/30 border border-rose-500/40 cursor-pointer"
          }`}
        >
          <span>🔒</span>
          <span>قفل النظام على كل الأجهزة</span>
        </button>

        {/* Button 2: Unlock System */}
        <button
          onClick={() => handleAction("UNLOCK")}
          disabled={loading || !isLocked}
          className={`py-3 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow-lg ${
            !isLocked
              ? "bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700"
              : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/30 border border-emerald-500/40 cursor-pointer"
          }`}
        >
          <span>🔓</span>
          <span>إعادة فتح النظام</span>
        </button>

        {/* Button 3: Force Logout All */}
        <button
          onClick={() => handleAction("FORCE_LOGOUT")}
          disabled={loading}
          className="bg-[#181820] hover:bg-stone-800 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow cursor-pointer"
        >
          <span>🚪</span>
          <span>تسجيل الخروج من كل الأجهزة</span>
        </button>
      </div>

      {/* Security Audit Log */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
            <span>📜</span>
            <span>سجل أمان العمليات المركزية (Security Audit Log)</span>
          </h3>
          <span className="text-[10px] text-stone-500 font-mono">آخر العمليات</span>
        </div>

        <div className="bg-[#14141a] border border-stone-800 rounded-xl overflow-hidden">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-stone-950/80 border-b border-stone-800 text-stone-400 text-[11px]">
                <th className="py-2 px-3">الإجراء</th>
                <th className="py-2 px-3">المنفّذ</th>
                <th className="py-2 px-3">التوقيت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-stone-500 font-sans">
                    لا توجد أحداث أمنية مسجلة بعد.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-800/30">
                    <td className="py-2 px-3 font-sans font-bold text-stone-200">
                      {log.action === "LOCK_SYSTEM" && "🔒 قفل النظام"}
                      {log.action === "UNLOCK_SYSTEM" && "🔓 إعادة فتح النظام"}
                      {log.action === "FORCE_LOGOUT_ALL" && "🚪 تسجيل خروج جماعي"}
                    </td>
                    <td className="py-2 px-3 text-orange-300 font-sans">{log.performedBy}</td>
                    <td className="py-2 px-3 text-stone-400">{log.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
