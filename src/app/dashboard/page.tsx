import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { TableStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSystemLockState } from "@/lib/system-lock";
import SystemSecurityControl from "@/components/admin/system-security-control";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userName = session?.user?.name || "المدير";
  const userRole = (session?.user as any)?.role || "CASHIER";

  // Fetch real counts from DB
  const [
    totalTables,
    availableTables,
    totalMenuItems,
    totalRawMaterials,
    lowStockMaterials,
    lockState,
  ] = await Promise.all([
    prisma.diningTable.count().catch(() => 28),
    prisma.diningTable.count({ where: { status: TableStatus.AVAILABLE } }).catch(() => 28),
    prisma.menuItem.count().catch(() => 0),
    prisma.rawMaterial.count().catch(() => 0),
    prisma.rawMaterial.count({ where: { currentStock: { lte: 10 } } }).catch(() => 0),
    getSystemLockState(),
  ]);

  const cards = [
    {
      title: "إدارة الطاولات",
      value: `${totalTables} طاولة`,
      subtext: `${availableTables} طاولة متاحة حالياً`,
      href: "/dashboard/tables",
      color: "from-blue-600 to-indigo-600",
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      title: "قائمة الطعام والوصفات",
      value: `${totalMenuItems} صنف`,
      subtext: "أصناف المشويات والصواني والوجبات",
      href: "/dashboard/menu",
      color: "from-amber-500 to-amber-600",
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      title: "المشتريات والمواد الخام",
      value: `${totalRawMaterials} مادة خام`,
      subtext: lowStockMaterials > 0 ? `⚠️ ${lowStockMaterials} مواد أوشكت على النفاد` : "المخزون في مستوى آمن",
      href: "/dashboard/procurement",
      color: "from-emerald-600 to-teal-600",
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: "العملاء والدليفري",
      value: "سجل العملاء",
      subtext: "إدارة طلبات التوصيل والهواتف",
      href: "/dashboard/customers",
      color: "from-violet-600 to-purple-600",
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-l from-stone-900 via-stone-950 to-black rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-orange-500/30 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-orange-500 text-stone-950 mb-3 shadow-md">
            مشويات بسيوني • MASHWEYAT BASIONY
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-stone-100">
            لوحة الإدارة والتشغيل (Admin Dashboard)
          </h1>
          <p className="text-stone-300 text-sm leading-relaxed">
            مرحباً بك في نظام إدارة وتجهيز العمليات لمطعم مشويات بسيوني — إدارة: أ/ أحمد بسيوني.
          </p>
        </div>
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-orange-500/15 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ADMIN CENTRAL SECURITY & SYSTEM LOCK COMPONENT */}
      {userRole === "ADMIN" && (
        <SystemSecurityControl
          initialLocked={lockState.isLocked}
          initialLockedBy={lockState.lockedBy}
          initialLockedAt={lockState.lockedAt}
          initialLogs={lockState.logs}
          userName={userName}
        />
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <Link
            key={idx}
            href={card.href}
            className="group block bg-stone-900 rounded-2xl p-6 border border-stone-800 hover:border-orange-500/40 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
              <span className="text-stone-500 group-hover:text-orange-400 transition">
                <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
            <h3 className="text-stone-400 text-sm font-semibold mb-1">{card.title}</h3>
            <p className="text-2xl font-black text-stone-100 tracking-tight">{card.value}</p>
            <p className="text-xs text-stone-500 mt-1">{card.subtext}</p>
          </Link>
        ))}
      </div>

      {/* Quick Launchpad */}
      <div className="bg-stone-900 rounded-2xl p-6 border border-stone-800 shadow-sm">
        <h2 className="text-base font-bold text-stone-100 mb-4 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
          الوصول السريع للأقسام
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/pos"
            className="p-4 rounded-xl border border-orange-500/30 bg-orange-950/20 hover:bg-orange-900/30 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-orange-400 text-xs shadow-sm"
          >
            <span className="text-2xl">💻</span>
            <span>نقطة البيع (POS)</span>
          </Link>
          <Link
            href="/dashboard/tables"
            className="p-4 rounded-xl border border-stone-800 bg-[#16161e] hover:bg-stone-800 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-stone-200 text-xs shadow-sm"
          >
            <span className="text-2xl">🪑</span>
            <span>إدارة الطاولات</span>
          </Link>
          <Link
            href="/dashboard/menu"
            className="p-4 rounded-xl border border-stone-800 bg-[#16161e] hover:bg-stone-800 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-stone-200 text-xs shadow-sm"
          >
            <span className="text-2xl">📖</span>
            <span>قائمة الطعام والوصفات</span>
          </Link>
          <Link
            href="/dashboard/customers"
            className="p-4 rounded-xl border border-stone-800 bg-[#16161e] hover:bg-stone-800 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-stone-200 text-xs shadow-sm"
          >
            <span className="text-2xl">🛵</span>
            <span>العملاء والدليفري</span>
          </Link>
          <Link
            href="/dashboard/staff"
            className="p-4 rounded-xl border border-stone-800 bg-[#16161e] hover:bg-stone-800 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-stone-200 text-xs shadow-sm"
          >
            <span className="text-2xl">👥</span>
            <span>الموظفين والورديات</span>
          </Link>
          <Link
            href="/dashboard/reports"
            className="p-4 rounded-xl border border-stone-800 bg-[#16161e] hover:bg-stone-800 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-stone-200 text-xs shadow-sm"
          >
            <span className="text-2xl">📊</span>
            <span>التقارير المالية</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
