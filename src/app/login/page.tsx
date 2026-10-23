"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
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
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-stone-900 via-stone-950 to-black p-4 relative overflow-hidden">
      {/* Decorative Warm Flame Background Glow */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-stone-900/90 border border-amber-500/30 rounded-3xl shadow-2xl p-8 sm:p-10 w-full max-w-md relative backdrop-blur-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/40">
            <span className="text-stone-950 font-black text-2xl tracking-tighter">
              مب
            </span>
          </div>
          <h1 className="text-3xl font-black text-amber-400 mb-1">
            مشويات بسوني
          </h1>
          <p className="text-amber-200/90 text-sm font-semibold">
            طعم زمان على أصوله
          </p>
          <p className="text-stone-400 text-xs mt-1">
            أكلنا يلم يجمع الصحاب • نظام الكاشير ونقاط البيع
          </p>
        </div>

        {/* Location & Hotline Badge */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-2.5 mb-6 text-center text-xs space-y-1">
          <p className="text-amber-300 font-mono font-bold">
            📞 خدمة التوصيل: 01558962994
          </p>
          <p className="text-stone-400 text-[11px]">
            📍 عبد القادر - جامع السلام - المستعمرة
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="bg-rose-950/70 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-bold text-stone-300 mb-1.5"
            >
              اسم المستخدم
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl outline-none text-stone-100 placeholder-stone-500 text-sm"
              placeholder="أدخل اسم المستخدم"
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold text-stone-300 mb-1.5"
            >
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl outline-none text-stone-100 placeholder-stone-500 text-sm font-mono"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-stone-950 font-black py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span>جاري التحقق...</span>
            ) : (
              <span>تسجيل الدخول للمنظومة ⚡</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-[10px] text-stone-500 mt-6">
          مشويات بسوني - جميع الحقوق محفوظة © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
