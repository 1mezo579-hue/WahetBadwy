"use client";

import { useState, useTransition } from "react";
import { EquipmentType, EquipmentStatus } from "@prisma/client";
import { createEquipment, updateEquipmentStatus, deleteEquipment } from "@/actions/equipment";

interface EquipmentItem {
  id: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  location: string | null;
  serialNumber: string | null;
  notes: string | null;
  createdAt: Date;
}

export default function EquipmentManager({ initialEquipment }: { initialEquipment: EquipmentItem[] }) {
  const [activeTab, setActiveTab] = useState<EquipmentType>(EquipmentType.KITCHEN);
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const statusConfig: Record<EquipmentStatus, { label: string; badge: string }> = {
    OPERATIONAL: { label: "جاهزة للعمل", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    MAINTENANCE: { label: "قيد الصيانة", badge: "bg-amber-100 text-amber-800 border-amber-200" },
    OUT_OF_SERVICE: { label: "خارج الخدمة", badge: "bg-rose-100 text-rose-800 border-rose-200" },
  };

  const filteredEquipment = initialEquipment.filter((item) => item.type === activeTab);

  const kitchenCount = initialEquipment.filter((item) => item.type === EquipmentType.KITCHEN).length;
  const baristaCount = initialEquipment.filter((item) => item.type === EquipmentType.BARISTA).length;

  const handleStatusChange = (id: string, newStatus: EquipmentStatus) => {
    startTransition(async () => {
      await updateEquipmentStatus(id, newStatus);
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف المعدة: ${name}؟`)) {
      startTransition(async () => {
        await deleteEquipment(id);
      });
    }
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createEquipment(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        form.reset();
        setShowAddModal(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Tabs and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(EquipmentType.KITCHEN)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === EquipmentType.KITCHEN
                ? "bg-primary-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>🍳</span>
            <span>معدات المطبخ الرئيسي</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-800 text-amber-400 font-bold">
              {kitchenCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab(EquipmentType.BARISTA)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === EquipmentType.BARISTA
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>☕</span>
            <span>ركن الباريستا والمشروبات</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-700 text-white font-bold">
              {baristaCount}
            </span>
          </button>
        </div>

        {/* Add Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-700 hover:bg-primary-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>إضافة معدة جديدة</span>
        </button>
      </div>

      {/* Equipment Cards List */}
      {filteredEquipment.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <span className="text-4xl block mb-2">📦</span>
          <p className="text-slate-600 font-bold">لا توجد معدات مسجلة في هذا القسم حالياً.</p>
          <p className="text-xs text-slate-400 mt-1">اضغط على زر "إضافة معدة جديدة" للبدء في التسجيل.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEquipment.map((item) => {
            const statusInfo = statusConfig[item.status];
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold ${statusInfo.badge}`}>
                      {statusInfo.label}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-slate-300 hover:text-rose-500 transition p-1"
                      title="حذف المعدة"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-800 mb-2">{item.name}</h3>

                  <div className="space-y-1.5 text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl">
                    {item.location && (
                      <p className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-600">الموقع:</span>
                        <span>{item.location}</span>
                      </p>
                    )}
                    {item.serialNumber && (
                      <p className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-600">الرقم التسلسلي:</span>
                        <span className="font-mono">{item.serialNumber}</span>
                      </p>
                    )}
                    {item.notes && (
                      <p className="flex items-start gap-1.5">
                        <span className="font-bold text-slate-600 shrink-0">ملاحظات:</span>
                        <span>{item.notes}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400 mb-2">تحديث حالة التشغيل:</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(statusConfig) as EquipmentStatus[]).map((st) => (
                      <button
                        key={st}
                        disabled={isPending || item.status === st}
                        onClick={() => handleStatusChange(item.id, st)}
                        className={`text-xs py-1.5 px-1 rounded-lg font-bold border transition ${
                          item.status === st
                            ? `${statusConfig[st].badge} font-extrabold ring-1 ring-current`
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {statusConfig[st].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-black text-slate-800">
                إضافة معدة جديدة ({activeTab === EquipmentType.KITCHEN ? "مطبخ" : "باريستا"})
              </h3>
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
              <input type="hidden" name="type" value={activeTab} />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الجهاز / المعدة *</label>
                <input
                  name="name"
                  required
                  placeholder={activeTab === EquipmentType.KITCHEN ? "مثال: فرن مندي، شواية فحم..." : "مثال: ماكينة إسبريسو 2 جروب، مطحنة..."}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموقع / القسم داخل المنشأة</label>
                <input
                  name="location"
                  placeholder="مثال: المطبخ الساخن، بار المشروبات الباردة"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرقم التسلسلي أو الموديل</label>
                <input
                  name="serialNumber"
                  placeholder="SN-123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة التشغيل المبدئية</label>
                <select
                  name="status"
                  defaultValue={EquipmentStatus.OPERATIONAL}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                >
                  <option value={EquipmentStatus.OPERATIONAL}>جاهزة للعمل (Operational)</option>
                  <option value={EquipmentStatus.MAINTENANCE}>قيد الصيانة (Under Maintenance)</option>
                  <option value={EquipmentStatus.OUT_OF_SERVICE}>خارج الخدمة (Out of Service)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات أو جدول الصيانة</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="تغيير فلاتر، تشحيم دوري..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
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
                  {isPending ? "جاري الحفظ..." : "إضافة المعدة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
