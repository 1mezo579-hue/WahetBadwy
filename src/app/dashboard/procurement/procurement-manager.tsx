"use client";

import { useState, useTransition } from "react";
import { UnitType } from "@prisma/client";
import { createRawMaterial, updateStock, deleteRawMaterial } from "@/actions/procurement";

interface RawMaterialItem {
  id: string;
  name: string;
  unit: UnitType;
  costPerUnit: number;
  currentStock: number;
  minStockLevel: number;
  _count: {
    recipeItems: number;
  };
}

export default function ProcurementManager({ initialMaterials }: { initialMaterials: RawMaterialItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [restockItem, setRestockItem] = useState<RawMaterialItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  const unitLabels: Record<UnitType, string> = {
    KG: "كيلوجرام (كجم)",
    GRAM: "جرام",
    LITER: "لتر",
    ML: "مليلتر",
    PIECE: "قطعة",
    PORTION: "حصة / وجبة",
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف المادة الخام: ${name}؟`)) {
      startTransition(async () => {
        const res = await deleteRawMaterial(id);
        if (res?.error) alert(res.error);
      });
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem) return;
    const amount = parseFloat(restockAmount);

    startTransition(async () => {
      const res = await updateStock(restockItem.id, amount);
      if (res?.error) {
        alert(res.error);
      } else {
        setRestockItem(null);
        setRestockAmount("");
      }
    });
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createRawMaterial(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        form.reset();
        setShowAddModal(false);
      }
    });
  };

  const lowStockCount = initialMaterials.filter((m) => m.currentStock <= m.minStockLevel).length;

  return (
    <div className="space-y-6">
      {/* Action and Stats Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-50 rounded-xl text-primary-800">
            <span className="font-bold text-sm">إجمالي المواد المسجلة: {initialMaterials.length}</span>
          </div>
          {lowStockCount > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <span>⚠️</span>
              <span>{lowStockCount} مواد أوشكت على النفاد!</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-700 hover:bg-primary-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>إضافة مادة خام جديدة</span>
        </button>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-4 px-6">المادة الخام</th>
                <th className="py-4 px-6">وحدة القياس</th>
                <th className="py-4 px-6">تكلفة الوحدة</th>
                <th className="py-4 px-6">الرصيد بالمخزن</th>
                <th className="py-4 px-6">حد الطلب الآمن</th>
                <th className="py-4 px-6">مرتبطة بوصفات</th>
                <th className="py-4 px-6 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialMaterials.map((item) => {
                const isLow = item.currentStock <= item.minStockLevel;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-6 font-extrabold text-slate-800">{item.name}</td>
                    <td className="py-4 px-6 text-slate-600">{unitLabels[item.unit]}</td>
                    <td className="py-4 px-6 font-mono font-bold text-slate-700">
                      {item.costPerUnit.toFixed(2)} ج.م
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-extrabold ${isLow ? "text-rose-600" : "text-emerald-700"}`}>
                          {item.currentStock}
                        </span>
                        {isLow ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            منخفض
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            كافي
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-mono">{item.minStockLevel}</td>
                    <td className="py-4 px-6">
                      <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-lg font-bold text-slate-700">
                        {item._count.recipeItems} وصفات
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setRestockItem(item);
                            setRestockAmount("");
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                        >
                          + توريد مخزون
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="حذف"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-1">تسجيل توريد مخزون جديد</h3>
            <p className="text-xs text-slate-500 mb-4">
              إضافة كمية جديدة للمادة: <strong className="text-primary-800">{restockItem.name}</strong>
            </p>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الكمية الواردة ({unitLabels[restockItem.unit]}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  placeholder="مثال: 25"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isPending ? "جاري التحديث..." : "تأكيد إضافة الرصيد"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-black text-slate-800">إضافة مادة خام جديدة</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المادة الخام *</label>
                <input
                  name="name"
                  required
                  placeholder="مثال: لحم بلدي، دقيق فاخر، أرز بسمتي، توابل بسيوني..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وحدة القياس *</label>
                  <select
                    name="unit"
                    defaultValue={UnitType.KG}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  >
                    <option value={UnitType.KG}>كيلوجرام (كجم)</option>
                    <option value={UnitType.GRAM}>جرام</option>
                    <option value={UnitType.LITER}>لتر</option>
                    <option value={UnitType.ML}>مليلتر</option>
                    <option value={UnitType.PIECE}>قطعة</option>
                    <option value={UnitType.PORTION}>حصة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تكلفة الوحدة (ج.م) *</label>
                  <input
                    name="costPerUnit"
                    type="number"
                    step="0.01"
                    required
                    placeholder="120.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد المبدئي بالمخزن</label>
                  <input
                    name="currentStock"
                    type="number"
                    step="any"
                    defaultValue={0}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حد الطلب الأدنى (تنبيه)</label>
                  <input
                    name="minStockLevel"
                    type="number"
                    step="any"
                    defaultValue={10}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ..." : "إضافة المادة الخام"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
