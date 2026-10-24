import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAdminReportsData } from "@/actions/reports";
import ReportsView from "./reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: {
    from?: string;
    to?: string;
    channel?: string;
    status?: string;
    shiftId?: string;
  };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const reportsData = await getAdminReportsData({
    from: searchParams?.from,
    to: searchParams?.to,
    channel: searchParams?.channel as any,
    status: searchParams?.status as any,
    shiftId: searchParams?.shiftId,
  });

  if (!reportsData.authorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-white p-8 rounded-3xl border border-rose-200 shadow-xl max-w-md w-full space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-3xl mx-auto">
            🔒
          </div>
          <h2 className="text-xl font-black text-slate-800">صلاحية مقيدة</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {reportsData.error || "عذراً، التقارير المالية وسجلات الأرباح مخصصة للمدير العام ومدير الصالة فقط."}
          </p>
          <a
            href="/pos"
            className="inline-block px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition"
          >
            الذهاب إلى شاشة الكاشير (POS)
          </a>
        </div>
      </div>
    );
  }

  return <ReportsView data={reportsData} />;
}
