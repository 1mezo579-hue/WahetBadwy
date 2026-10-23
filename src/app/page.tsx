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
        setError("اسم المستخدم أو كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى");
        setLoading(false);
      } else {
        router.push("/pos");
        router.refresh();
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم، تحقق من الاتصال بالإنترنت");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-stone-950 via-slate-950 to-stone-900 text-stone-100 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-amber-500 selection:text-stone-950"
      dir="rtl"
    >
      {/* Top Brand Bar */}
      <header className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 rounded-3xl bg-stone-900/60 border border-stone-800/80 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-stone-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/40">
            مب
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                مشويات بسوني
              </h1>
              <span className="text-[11px] font-mono tracking-wider text-amber-400/90 bg-amber-950/70 border border-amber-800/80 px-2 py-0.5 rounded-full font-bold">
                MASHWEYAT BASIONY
              </span>
            </div>
            <p className="text-xs text-stone-400 font-medium">
              كافيه ومطعم مشويات ومندي • طعم زمان على أصوله
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-300 font-medium">
          <div className="flex items-center gap-1.5 bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700/60">
            <span className="text-amber-400">📍</span>
            <span>عبد القادر - جامع السلام - المستعمرة</span>
          </div>
          <div className="flex items-center gap-1.5 bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700/60 font-mono">
            <span className="text-amber-400">📞</span>
            <span dir="ltr">01558962994</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 px-3 py-1.5 rounded-xl font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>النظام متصل سحابياً</span>
          </div>
        </div>
      </header>

      {/* Main Container: Split Grid (Left Quick Portals / Right Secure Login) */}
      <main className="max-w-6xl w-full mx-auto my-auto py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Welcome Hero & Quick Access Shortcuts */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
              <span>🏜️</span>
              <span>بوابة الإدارة السحابية ونقاط البيع الذكية</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              أهلاً بكم في منظومة <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
                مشويات بسوني المتكاملة
              </span>
            </h2>
            <p className="text-sm sm:text-base text-stone-400 max-w-xl leading-relaxed">
              منظومة متطورة مخصصة لإدارة الصالة، الطاولات، طلبات السفري والدليفري، المطبخ والمشرمبات والشيشة، بالإضافة للتحكم الدقيق في التكاليف والمخزون وحسابات الوردية اليومية.
            </p>
          </div>

          {/* Quick Access Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <Link
              href="/pos"
              className="group p-4 rounded-2xl bg-stone-900/80 border border-stone-800 hover:border-amber-500/50 hover:bg-stone-800/70 transition-all duration-200 shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-stone-950 transition-colors flex items-center justify-center text-xl font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                    شاشة نقاط البيع (POS)
                  </h3>
                  <p className="text-xs text-stone-400">
                    طاولات الصالة، التيك أواي، وتقفيل الشيك
                  </p>
                </div>
              </div>
              <span className="text-stone-500 group-hover:text-amber-400 text-lg transition-transform group-hover:-translate-x-1">
                ←
              </span>
            </Link>

            <Link
              href="/dashboard"
              className="group p-4 rounded-2xl bg-stone-900/80 border border-stone-800 hover:border-amber-500/50 hover:bg-stone-800/70 transition-all duration-200 shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors flex items-center justify-center text-xl font-bold">
                  📊
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">
                    لوحة الإدارة والتقارير
                  </h3>
                  <p className="text-xs text-stone-400">
                    المبيعات، الأرباح، وفواتير المرتجع
                  </p>
                </div>
              </div>
              <span className="text-stone-500 group-hover:text-blue-400 text-lg transition-transform group-hover:-translate-x-1">
                ←
              </span>
            </Link>

            <Link
              href="/dashboard/inventory"
              className="group p-4 rounded-2xl bg-stone-900/80 border border-stone-800 hover:border-amber-500/50 hover:bg-stone-800/70 transition-all duration-200 shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-stone-950 transition-colors flex items-center justify-center text-xl font-bold">
                  🥩
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">
                    المخزون والوصفات
                  </h3>
                  <p className="text-xs text-stone-400">
                    الخامات، المشتريات، وتكاليف الأطباق
                  </p>
                </div>
              </div>
              <span className="text-stone-500 group-hover:text-emerald-400 text-lg transition-transform group-hover:-translate-x-1">
                ←
              </span>
            </Link>

            <Link
              href="/dashboard/staff"
              className="group p-4 rounded-2xl bg-stone-900/80 border border-stone-800 hover:border-amber-500/50 hover:bg-stone-800/70 transition-all duration-200 shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors flex items-center justify-center text-xl font-bold">
                  👥
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">
                    سجل الموظفين والورديات
                  </h3>
                  <p className="text-xs text-stone-400">
                    الحضور، الانصراف، وساعات العمل
                  </p>
                </div>
              </div>
              <span className="text-stone-500 group-hover:text-purple-400 text-lg transition-transform group-hover:-translate-x-1">
                ←
              </span>
            </Link>
          </div>
        </div>

        {/* Right Side: Luxury Secure Login Card */}
        <div className="lg:col-span-5">
          <div className="bg-stone-900/90 rounded-3xl p-7 sm:p-9 border border-stone-800 shadow-2xl relative overflow-hidden backdrop-blur-xl ring-1 ring-white/5">
            {/* Ambient Desert Glow */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-600/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-800">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <span>تسجيل الدخول للنظام</span>
                    <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
                      مؤمن 🔒
                    </span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    أدخل بيانات حسابك المعتمد للوصول لخدمات النظام
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-rose-950/60 border border-rose-800/80 text-rose-300 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-shake">
                  <span className="text-base">⚠️</span>
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1.5">
                    اسم المستخدم
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="اسم المستخدم الخاص بك"
                      className="w-full px-4 py-3 rounded-2xl bg-stone-950/80 border border-stone-700/80 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition font-medium"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-sm pointer-events-none">
                      👤
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-300 mb-1.5">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-2xl bg-stone-950/80 border border-stone-700/80 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition font-medium font-mono"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-sm pointer-events-none">
                      🔑
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3.5 px-4 rounded-2xl font-black text-sm text-stone-950 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] transition shadow-lg shadow-amber-500/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>جاري التحقق من الصلاحيات...</span>
                    </>
                  ) : (
                    <>
                      <span>تسجيل الدخول 🚀</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-stone-800/80 text-center text-[11px] text-stone-500 flex items-center justify-center gap-2">
                <span>🛡️</span>
                <span>نظام مشفر ومخصص لطاقم إدارة وتشغيل مشويات بسوني فقط</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-stone-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
        <p>
          جميع الحقوق محفوظة © {new Date().getFullYear()} مطعم وكافيه مشويات بسوني (Mashweyat Basiony)
        </p>
        <p className="font-mono text-[11px]">
          الإصدار 2.5 • Dine-In & Takeaway POS Cloud Engine
        </p>
      </footer>
    </div>
  );
}

