import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("DashboardLayout session error:", error);
  }

  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any)?.role || "CASHIER";
  if (role === "CASHIER") {
    redirect("/pos");
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#1F2937] flex flex-col lg:flex-row font-sans" dir="rtl">
      {/* Sidebar (Desktop + Mobile) */}
      <AdminSidebar
        user={{
          name: session.user?.name,
          role: session.user?.role,
          username: session.user?.username,
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:mr-72 min-h-screen flex flex-col overflow-x-hidden">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
