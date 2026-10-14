"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة");
        setLoading(false);
      } else {
        router.push("/pos");
        router.refresh();
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950 p-4 font-sans text-right" dir="rtl">
      {/* Main Kiosk Login Card */}
      <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 w-full max-w-md border border-primary-800/20">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center font-black text-3xl text-primary-950 shadow-xl ring-4 ring-amber-300/40 mb-4">
            وب
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-1 tracking-tight">
            واحة بدوي
          </h1>
          <p className="text-slate-500 text-sm font-medium">نظام نقاط البيع والإدارة (Dine-in POS)</p>
          <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            ● النظام متصل وجاهز للعمل
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl font-black text-sm text-primary-950 bg-amber-500 hover:bg-amber-400 active:scale-98 transition shadow-lg shadow-amber-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "جاري التحقق والدخول..." : "تسجيل الدخول إلى النظام 🚀"}
          </button>
        </form>

        {/* Quick Launchpad Buttons */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
          <Link
            href="/pos"
            className="p-2.5 rounded-xl bg-slate-50 hover:bg-primary-50 border border-slate-200 text-xs font-bold text-primary-900 transition"
          >
            شاشة الكاشير (POS) 🪑
          </Link>
          <Link
            href="/dashboard"
            className="p-2.5 rounded-xl bg-slate-50 hover:bg-primary-50 border border-slate-200 text-xs font-bold text-primary-900 transition"
          >
            لوحة الإدارة ⚙️
          </Link>
        </div>

        {/* Credentials reminder */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center text-[11px] text-slate-500">
          <span>الحساب الافتراضي: </span>
          <strong className="text-slate-800 font-mono">admin</strong> |{" "}
          <strong className="text-slate-800 font-mono">WahetBadawy@2026</strong>
        </div>
      </div>

      <p className="text-center text-xs text-primary-400 mt-6">
        واحة بدوي - كافيه ومطعم © {new Date().getFullYear()}
      </p>
    </div>
  );
}
