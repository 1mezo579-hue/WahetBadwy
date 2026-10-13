import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const roleLabels: Record<string, string> = {
    ADMIN: "مدير النظام",
    MANAGER: "مدير",
    CASHIER: "كاشير",
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-primary-800">واحة بدوي</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-left">
              <p className="font-semibold text-gray-900">
                {session.user?.name}
              </p>
              <p className="text-gray-500 text-xs">
                {roleLabels[session.user?.role] || session.user?.role}
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-white rounded-xl shadow-sm p-8 text-center border border-gray-200">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            مرحباً بك، {session.user?.name}
          </h2>
          <p className="text-gray-500 mb-6">
            تم تسجيل الدخول بنجاح إلى نظام نقاط البيع
          </p>

          {/* Quick Stats Placeholder */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="bg-primary-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-primary-700">0</p>
              <p className="text-sm text-primary-600">طلبات اليوم</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-700">0 ج.م</p>
              <p className="text-sm text-green-600">إجمالي المبيعات</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-amber-700">0</p>
              <p className="text-sm text-amber-600">طاولات نشطة</p>
            </div>
          </div>

          <p className="text-gray-400 text-sm mt-8">
            سيتم إضافة المزيد من الميزات في التحديثات القادمة
          </p>
        </div>
      </main>
    </div>
  );
}
