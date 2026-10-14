import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAdminReportsData } from "@/actions/reports";
import ReportsView from "./reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const reportsData = await getAdminReportsData();

  return (
    <ReportsView
      shifts={reportsData.shifts}
      sales={reportsData.sales}
      complimentaryOrders={reportsData.complimentaryOrders}
      totalComplimentaryWaived={reportsData.totalComplimentaryWaived}
      rawMaterials={reportsData.rawMaterials}
    />
  );
}
