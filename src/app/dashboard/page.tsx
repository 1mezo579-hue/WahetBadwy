import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { TableStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch real counts from DB
  const [
    totalTables,
    availableTables,
    totalMenuItems,
    totalRawMaterials,
    lowStockMaterials,
    kitchenEquipment,
    baristaEquipment,
  ] = await Promise.all([
    prisma.diningTable.count().catch(() => 28),
    prisma.diningTable.count({ where: { status: TableStatus.AVAILABLE } }).catch(() => 28),
    prisma.menuItem.count().catch(() => 0),
    prisma.rawMaterial.count().catch(() => 0),
    prisma.rawMaterial.count({ where: { currentStock: { lte: 10 } } }).catch(() => 0),
    prisma.equipment.count({ where: { type: "KITCHEN" } }).catch(() => 0),
    prisma.equipment.count({ where: { type: "BARISTA" } }).catch(() => 0),
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
      subtext: "معيار المكونات والوصفات المربوطة",
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
      title: "معدات المطبخ والباريستا",
      value: `${kitchenEquipment + baristaEquipment} أجهزة`,
      subtext: `${kitchenEquipment} مطبخ • ${baristaEquipment} كافيه وباريستا`,
      href: "/dashboard/equipment",
      color: "from-violet-600 to-purple-600",
      icon: (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-l from-primary-900 via-primary-800 to-primary-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-primary-950 mb-3">
            واحة بدوي • طعم زمان على أصوله
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">
            لوحة الإدارة والتشغيل (Admin Dashboard)
          </h1>
          <p className="text-primary-200 text-sm leading-relaxed">
            مرحباً بك في نظام إدارة وتجهيز العمليات لمطعم وكافيه واحة بدوي.
          </p>
        </div>
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <Link
            key={idx}
            href={card.href}
            className="group block bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
              <span className="text-slate-400 group-hover:text-primary-700 transition">
                <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
            <h3 className="text-slate-500 text-sm font-semibold mb-1">{card.title}</h3>
            <p className="text-2xl font-black text-slate-800 tracking-tight">{card.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick Launchpad */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          الوصول السريع للأقسام
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/pos"
            className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-amber-950 text-xs shadow-sm"
          >
            <span className="text-2xl">💻</span>
            <span>نقطة البيع (POS)</span>
          </Link>
          <Link
            href="/dashboard/tables"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-slate-800 text-xs shadow-sm"
          >
            <span className="text-2xl">🪑</span>
            <span>إدارة الطاولات</span>
          </Link>
          <Link
            href="/dashboard/menu"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-slate-800 text-xs shadow-sm"
          >
            <span className="text-2xl">📖</span>
            <span>قائمة الطعام والوصفات</span>
          </Link>
          <Link
            href="/dashboard/customers"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-slate-800 text-xs shadow-sm"
          >
            <span className="text-2xl">🛵</span>
            <span>العملاء والدليفري</span>
          </Link>
          <Link
            href="/dashboard/staff"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-slate-800 text-xs shadow-sm"
          >
            <span className="text-2xl">👥</span>
            <span>الموظفين والورديات</span>
          </Link>
          <Link
            href="/dashboard/reports"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition flex flex-col items-center justify-center text-center gap-2 font-bold text-slate-800 text-xs shadow-sm"
          >
            <span className="text-2xl">📊</span>
            <span>التقارير المالية</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
