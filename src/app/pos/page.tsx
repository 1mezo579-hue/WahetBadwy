import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPosData } from "@/actions/pos";
import { getActiveShift } from "@/actions/shifts";
import { getSystemLockState } from "@/lib/system-lock";
import PosInterface from "./pos-interface";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("POS page session error:", error);
  }

  if (!session) {
    redirect("/login");
  }

  const [{ tables, categories, menuItems, customers }, { activeShift }, lockState] = await Promise.all([
    getPosData(),
    getActiveShift(session.user?.id),
    getSystemLockState(),
  ]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#070709] text-stone-100 flex flex-col font-sans select-none" dir="rtl">
      <PosInterface
        initialTables={tables as any}
        categories={categories}
        menuItems={menuItems}
        initialCustomers={customers as any || []}
        userName={session.user?.name || "الكاشير"}
        userId={session.user?.id || ""}
        userRole={(session.user as any)?.role || "CASHIER"}
        initialShift={activeShift as any}
        initialSystemLocked={lockState.isLocked}
        initialLockedBy={lockState.lockedBy}
        initialLockedAt={lockState.lockedAt}
      />
    </div>
  );
}
