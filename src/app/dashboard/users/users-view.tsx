"use client";

import { useState, useTransition } from "react";
import { UserInput, createUser, updateUser, deleteUser, toggleUserStatus } from "@/actions/users";
import { Role } from "@prisma/client";
import Link from "next/link";

interface UserItem {
  id: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
  createdAt: Date | string;
  _count: {
    orders: number;
    shifts: number;
  };
}

export default function UsersView({ initialUsers }: { initialUsers: UserItem[] }) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [activeTab, setActiveTab] = useState<"USERS" | "PERMISSIONS">("USERS");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const [formData, setFormData] = useState<UserInput>({
    name: "",
    username: "",
    password: "",
    role: Role.CASHIER,
    active: true,
  });

  const roleLabels: Record<Role, { label: string; badge: string; color: string }> = {
    ADMIN: { label: "مدير النظام (Admin)", badge: "كامل الصلاحيات", color: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
    MANAGER: { label: "مدير الصالة (Manager)", badge: "إدارة وتشغيل", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    CASHIER: { label: "كاشير (Cashier)", badge: "نقاط بيع وورديات", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({ name: "", username: "", password: "", role: Role.CASHIER, active: true });
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      password: "", // empty means keep existing password
      role: user.role,
      active: user.active,
    });
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username) {
      setFeedback({ text: "الاسم واسم الدخول حقول مطلوبة", isError: true });
      return;
    }
    if (!editingUser && !formData.password) {
      setFeedback({ text: "كلمة المرور مطلوبة للمستخدم الجديد", isError: true });
      return;
    }

    startTransition(async () => {
      if (editingUser) {
        const res = await updateUser(editingUser.id, formData);
        if (res.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editingUser.id
                ? {
                    ...u,
                    name: formData.name,
                    username: formData.username,
                    role: formData.role,
                    active: formData.active ?? u.active,
                  }
                : u
            )
          );
          setFeedback({ text: res.message || "تم تحديث الحساب بنجاح" });
          setShowAddModal(false);
        } else {
          setFeedback({ text: res.error || "فشل التحديث", isError: true });
        }
      } else {
        const res = await createUser(formData);
        if (res.success) {
          setFeedback({ text: res.message || "تم إنشاء المستخدم بنجاح" });
          setShowAddModal(false);
          // reload window or refresh state
          window.location.reload();
        } else {
          setFeedback({ text: res.error || "فشل الإنشاء", isError: true });
        }
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  const handleToggleStatus = (id: string) => {
    startTransition(async () => {
      const res = await toggleUserStatus(id);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u))
        );
        setFeedback({ text: res.message || "تم تحديث حالة الحساب" });
      } else {
        setFeedback({ text: res.error || "فشل التحديث", isError: true });
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب "${name}" نهائياً؟`)) return;
    startTransition(async () => {
      const res = await deleteUser(id);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        setFeedback({ text: "تم حذف المستخدم بنجاح" });
      } else {
        setFeedback({ text: res.error || "فشل الحذف", isError: true });
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 p-6 rounded-2xl border border-amber-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👥</span>
            <h1 className="text-2xl font-bold text-amber-400">
              إدارة المستخدمين وصلاحيات النظام
            </h1>
          </div>
          <p className="text-stone-300 text-sm">
            التحكم في حسابات الكاشيرات، المديرين، ومصفوفة الصلاحيات لـ{" "}
            <span className="text-amber-300 font-semibold">مشويات اولاد بسيوني</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            إضافة مستخدم جديد
          </button>
          <Link
            href="/pos"
            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/30 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <span>شاشة الكاشير</span>
            <span className="text-xs">⚡</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-800 pb-2">
        <button
          onClick={() => setActiveTab("USERS")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "USERS"
              ? "bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
              : "bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800"
          }`}
        >
          <span>👤 حسابات المستخدمين</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-black/20">{users.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("PERMISSIONS")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "PERMISSIONS"
              ? "bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20"
              : "bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800"
          }`}
        >
          <span>🛡️ مصفوفة الصلاحيات والأدوار</span>
        </button>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-lg ${
            feedback.isError
              ? "bg-rose-950/60 border-rose-500/40 text-rose-200"
              : "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
          }`}
        >
          <span className="font-semibold">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-sm opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Tab 1: Users Table */}
      {activeTab === "USERS" && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-stone-950/80 text-stone-400 text-xs uppercase border-b border-stone-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">الموظف / الاسم</th>
                  <th className="px-6 py-4 font-semibold">اسم تسجيل الدخول</th>
                  <th className="px-6 py-4 font-semibold">الدور الوظيفي</th>
                  <th className="px-6 py-4 font-semibold text-center">الورديات المسجلة</th>
                  <th className="px-6 py-4 font-semibold text-center">الطلبات المنفذة</th>
                  <th className="px-6 py-4 font-semibold text-center">حالة الحساب</th>
                  <th className="px-6 py-4 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {users.map((u) => {
                  const roleInfo = roleLabels[u.role] || roleLabels.CASHIER;
                  return (
                    <tr key={u.id} className="hover:bg-stone-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-stone-950 flex items-center justify-center font-bold text-sm shadow-md">
                            {u.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-stone-100">{u.name}</div>
                            <div className="text-stone-500 text-xs">
                              تاريخ التسجيل: {new Date(u.createdAt).toLocaleDateString("ar-EG")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-amber-300 font-semibold bg-stone-950 px-2 py-1 rounded border border-stone-800">
                          {u.username}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${roleInfo.color}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {roleInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-stone-950 text-stone-300 text-xs font-mono px-2.5 py-1 rounded-lg border border-stone-800">
                          {u._count.shifts} وردية
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-stone-950 text-amber-400 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border border-stone-800">
                          {u._count.orders} طلب
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          disabled={u.username === "admin"}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                            u.active
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
                          } ${u.username === "admin" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {u.active ? "نشط ومفعل" : "معطل"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-stone-400 hover:text-amber-300 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors"
                            title="تعديل المستخدم أو كلمة المرور"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          {u.username !== "admin" && (
                            <button
                              onClick={() => handleDelete(u.id, u.name)}
                              className="p-1.5 text-stone-400 hover:text-rose-400 bg-stone-800 hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="حذف المستخدم"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Permissions Matrix */}
      {activeTab === "PERMISSIONS" && (
        <div className="space-y-6">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-amber-400 mb-2">
              جدول الصلاحيات والأدوار التشغيلية في منظومة مشويات اولاد بسيوني
            </h3>
            <p className="text-stone-400 text-sm mb-6">
              توزيع الأدوار يضمن سلامة الحسابات النقدية، حماية أسعار المنيو، وفصل صلاحيات التحضير عن التحصيل المالي.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-stone-950 text-stone-400 text-xs border-b border-stone-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold">الصلاحية / الميزة</th>
                    <th className="px-6 py-4 font-semibold text-center text-rose-400">مدير النظام (ADMIN)</th>
                    <th className="px-6 py-4 font-semibold text-center text-amber-400">مدير الصالة (MANAGER)</th>
                    <th className="px-6 py-4 font-semibold text-center text-emerald-400">الكاشير (CASHIER)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800 text-stone-200">
                  <tr>
                    <td className="px-6 py-3 font-semibold">الدخول لشاشة نقاط البيع (POS) وتسجيل الطلبات</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">فتح وتقفيل وردية الكاشير وحساب العهدة النقدية</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم (ورديته فقط)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">تسجيل عملاء الدليفري والتيك أواي وتحديد رسوم التوصيل المفتوحة</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">طلب طاولة المالك والمدير (الضيافة المجانية 100%)</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-stone-500 font-bold">❌ مقيد بإذن مدير</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">إدارة الطاولات وتغيير حالتها (شاغرة، مشغولة، صيانة)</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-stone-500 font-bold">❌ من خلال الطلبات فقط</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">تعديل قائمة الطعام، الأسعار، وتكلفة المواد الخام</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-stone-500 font-bold">❌ لا</td>
                    <td className="px-6 py-3 text-center text-stone-500 font-bold">❌ لا</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">إدارة المشتريات والمخزون وتسجيل فواتير التوريد</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-stone-500 font-bold">❌ لا</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">لوحة التقارير المالية وسجل الأرباح وعجز الورديات</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-amber-400 font-bold">⚠️ تقارير تشغيلية فقط</td>
                    <td className="px-6 py-3 text-center text-stone-500 font-bold">❌ لا</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">إدارة حسابات المستخدمين وكلمات المرور والصلاحيات</td>
                    <td className="px-6 py-3 text-center text-emerald-400 font-bold">✅ نعم</td>
                    <td className="px-6 py-3 text-center text-stone-500 font-bold">❌ لا</td>
                    <td className="px-6 py-3 text-center text-stone-500 font-bold">❌ لا</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit User */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute left-4 top-4 text-stone-400 hover:text-stone-200"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-5 border-b border-stone-800 pb-3">
              <span className="text-2xl">{editingUser ? "✏️" : "👤"}</span>
              <h3 className="text-lg font-bold text-amber-400">
                {editingUser ? "تعديل حساب المستخدم" : "إضافة موظف / مستخدم جديد"}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  اسم الموظف بالكامل <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: محمود عبد الرازق"
                  className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  اسم تسجيل الدخول (Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={editingUser?.username === "admin"}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="مثال: cashier_ali"
                  className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-100 font-mono outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  {editingUser
                    ? "كلمة المرور (اتركها فارغة إذا لم ترغب في تغييرها)"
                    : "كلمة المرور (Password) *"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "••••••••" : "أدخل كلمة مرور قوية"}
                  className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-100 font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  الدور الوظيفي والصلاحيات <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.role}
                  disabled={editingUser?.username === "admin"}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-100 outline-none disabled:opacity-50"
                >
                  <option value={Role.CASHIER}>كاشير (CASHIER) - نقاط بيع وورديات</option>
                  <option value={Role.MANAGER}>مدير الصالة (MANAGER) - إشراف وتشغيل</option>
                  <option value={Role.ADMIN}>مدير النظام (ADMIN) - صلاحيات كاملة</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold px-6 py-2 rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ..." : editingUser ? "تحديث الحساب" : "إنشاء المستخدم"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
