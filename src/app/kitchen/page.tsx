import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActiveKitchenOrders } from "@/actions/kitchen";
import KitchenView from "./kitchen-view";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("Kitchen page session error:", error);
  }

  if (!session) {
    redirect("/login");
  }

  const res = await getActiveKitchenOrders();

  return (
    <main className="min-h-screen bg-[#070709] text-stone-100 flex flex-col font-sans select-none" dir="rtl">
      <KitchenView
        initialOrders={(res.orders as any) || []}
        chefName={session.user?.name || "شيف المطبخ"}
      />
    </main>
  );
}
