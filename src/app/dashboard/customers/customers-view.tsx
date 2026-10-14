"use client";

import { useState, useTransition } from "react";
import { CustomerInput, createCustomer, updateCustomer, deleteCustomer } from "@/actions/customers";
import Link from "next/link";

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  totalSpent: number;
  ordersCount: number;
  createdAt: Date | string;
  lastOrder: any;
}

export default function CustomersView({
  initialCustomers,
}: {
  initialCustomers: CustomerData[];
}) {
  const [customers, setCustomers] = useState<CustomerData[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  // Form states
  const [formData, setFormData] = useState<CustomerInput>({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrdersAll = customers.reduce((sum, c) => sum + c.ordersCount, 0);

  const handleOpenAdd = () => {
    setFormData({ name: "", phone: "", address: "", notes: "" });
    setEditingCustomer(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (customer: CustomerData) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      setFeedback({ text: "الاسم ورقم الهاتف حقول مطلوبة", isError: true });
      return;
    }

    startTransition(async () => {
      if (editingCustomer) {
        const res = await updateCustomer(editingCustomer.id, formData);
        if (res.success && res.customer) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === editingCustomer.id
                ? {
                    ...c,
                    name: res.customer.name,
                    phone: res.customer.phone,
                    address: res.customer.address,
                    notes: res.customer.notes,
                  }
                : c
            )
          );
          setFeedback({ text: res.message || "تم تحديث العميل بنجاح" });
          setShowAddModal(false);
        } else {
          setFeedback({ text: res.error || "فشل التحديث", isError: true });
        }
      } else {
        const res = await createCustomer(formData);
        if (res.success && res.customer) {
          const newC: CustomerData = {
            ...res.customer,
            totalSpent: 0,
            ordersCount: 0,
            lastOrder: null,
          };
          setCustomers((prev) => [newC, ...prev]);
          setFeedback({ text: res.message || "تم تسجيل العميل بنجاح" });
          setShowAddModal(false);
        } else {
          setFeedback({ text: res.error || "فشل التسجيل", isError: true });
        }
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف العميل "${name}"؟`)) return;

    startTransition(async () => {
      const res = await deleteCustomer(id);
      if (res.success) {
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        setFeedback({ text: "تم حذف العميل بنجاح" });
      } else {
        setFeedback({ text: res.error || "فشل حذف العميل", isError: true });
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 p-6 rounded-2xl border border-amber-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛵</span>
            <h1 className="text-2xl font-bold text-amber-400">
              إدارة عملاء الدليفري والتيك أواي
            </h1>
          </div>
          <p className="text-stone-300 text-sm">
            سجل العملاء، العناوين التفصيلية، وأرقام هواتف خدمة التوصيل السريع لـ{" "}
            <span className="text-amber-300 font-semibold">واحة بدوي</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            تسجيل عميل جديد
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

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-lg animate-fade-in ${
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-stone-900 border border-stone-800 p-5 rounded-2xl">
          <div className="text-stone-400 text-xs font-semibold mb-1">إجمالي العملاء المسجلين</div>
          <div className="text-3xl font-extrabold text-amber-400">{customers.length}</div>
          <div className="text-xs text-stone-500 mt-1">قاعدة بيانات عملاء واحة بدوي</div>
        </div>
        <div className="bg-stone-900 border border-stone-800 p-5 rounded-2xl">
          <div className="text-stone-400 text-xs font-semibold mb-1">إجمالي الطلبات المنفذة</div>
          <div className="text-3xl font-extrabold text-emerald-400">{totalOrdersAll}</div>
          <div className="text-xs text-stone-500 mt-1">طلبات دليفري وتيك أواي</div>
        </div>
        <div className="bg-stone-900 border border-stone-800 p-5 rounded-2xl">
          <div className="text-stone-400 text-xs font-semibold mb-1">إجمالي مبيعات العملاء</div>
          <div className="text-3xl font-extrabold text-amber-300">
            {totalSpentAll.toLocaleString()} <span className="text-base font-normal">ج.م</span>
          </div>
          <div className="text-xs text-stone-500 mt-1">إيرادات محصلة</div>
        </div>
        <div className="bg-stone-900 border border-stone-800 p-5 rounded-2xl">
          <div className="text-stone-400 text-xs font-semibold mb-1">خدمة الدليفري المعتمدة</div>
          <div className="text-2xl font-bold text-amber-400 font-mono">01558962994</div>
          <div className="text-xs text-stone-500 mt-1">عبد القادر - جامع السلام - المستعمرة</div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-stone-900/90 border border-stone-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، رقم الهاتف، أو العنوان..."
            className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm text-stone-100 placeholder-stone-500 outline-none pr-10"
          />
          <svg
            className="w-5 h-5 text-stone-500 absolute left-3 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="text-xs text-stone-400">
          عرض <span className="text-amber-400 font-bold">{filteredCustomers.length}</span> من أصل{" "}
          <span className="text-stone-200">{customers.length}</span> عميل
        </div>
      </div>

      {/* Customers List Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-stone-950/80 text-stone-400 text-xs uppercase border-b border-stone-800">
              <tr>
                <th className="px-6 py-4 font-semibold">اسم العميل</th>
                <th className="px-6 py-4 font-semibold">رقم الهاتف</th>
                <th className="px-6 py-4 font-semibold">العنوان التفصيلي وملاحظات التوصيل</th>
                <th className="px-6 py-4 font-semibold text-center">عدد الطلبات</th>
                <th className="px-6 py-4 font-semibold">إجمالي المشتريات</th>
                <th className="px-6 py-4 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                    <div className="text-4xl mb-2">🔍</div>
                    لا يوجد عملاء يطابقون البحث الحالي
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-stone-100 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-bold">
                          {c.name.slice(0, 1)}
                        </span>
                        {c.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${c.phone}`}
                          className="font-mono text-amber-300 hover:text-amber-400 font-semibold"
                        >
                          {c.phone}
                        </a>
                        <a
                          href={`https://wa.me/2${c.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded hover:bg-emerald-500/20"
                          title="مراسلة عبر واتساب"
                        >
                          واتساب
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-stone-300 text-xs truncate" title={c.address || "لا يوجد عنوان مسجل"}>
                        📍 {c.address || <span className="text-stone-500 italic">غير محدد</span>}
                      </div>
                      {c.notes && (
                        <div className="text-stone-400 text-[11px] mt-0.5 truncate" title={c.notes}>
                          📝 {c.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-stone-800 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full border border-stone-700">
                        {c.ordersCount} طلب
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-emerald-400">
                        {c.totalSpent.toLocaleString()}{" "}
                        <span className="text-xs font-normal text-stone-400">ج.م</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-stone-400 hover:text-amber-300 bg-stone-800/80 hover:bg-stone-700 rounded-lg transition-colors"
                          title="تعديل بيانات العميل"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-1.5 text-stone-400 hover:text-rose-400 bg-stone-800/80 hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="حذف العميل"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add / Edit Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute left-4 top-4 text-stone-400 hover:text-stone-200"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-5 border-b border-stone-800 pb-3">
              <span className="text-2xl">{editingCustomer ? "✏️" : "🛵"}</span>
              <h3 className="text-lg font-bold text-amber-400">
                {editingCustomer ? "تعديل بيانات العميل" : "تسجيل عميل دليفري / تيك أواي جديد"}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  اسم العميل <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  رقم الهاتف (المحمول) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="مثال: 01558962994"
                  className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-100 font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  العنوان التفصيلي (للتوصيل)
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="مثال: منطقة عبد القادر - بجوار جامع السلام - عمارة 5 الدور 2"
                  className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-100 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  ملاحظات وتفضيلات العميل
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="مثال: يفضل عيش بلدي - صوص طحينة زيادة"
                  className="w-full bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-stone-100 outline-none"
                />
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
                  {isPending ? "جاري الحفظ..." : editingCustomer ? "تحديث البيانات" : "حفظ العميل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
