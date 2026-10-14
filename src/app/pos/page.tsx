import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPosData } from "@/actions/pos";
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

  const { tables, categories, menuItems } = await getPosData();

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 flex flex-col font-sans" dir="rtl">
      <PosInterface
        initialTables={tables as any}
        categories={categories}
        menuItems={menuItems}
        userName={session.user?.name || "الكاشير"}
      />
    </div>
  );
}
