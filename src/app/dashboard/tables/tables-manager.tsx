"use client";

import { useState, useTransition } from "react";
import { TableType, TableStatus } from "@prisma/client";
import { createTable, updateTableStatus, deleteTable } from "@/actions/tables";

interface TableItem {
  id: string;
  name: string;
  number: number | null;
  type: TableType;
  status: TableStatus;
  capacity: number;
}

export default function TablesManager({ initialTables }: { initialTables: TableItem[] }) {
  const [filter, setFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const tableTypeLabels: Record<TableType, { label: string; badgeColor: string }> = {
    FAMILY_BOOTH: { label: "باكية عائلية", badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    VIP: { label: "طاولة VIP", badgeColor: "bg-amber-100 text-amber-800 border-amber-200" },
    REGULAR: { label: "طاولة عادية", badgeColor: "bg-slate-100 text-slate-800 border-slate-200" },
    OWNER: { label: "طاولة المالك", badgeColor: "bg-purple-100 text-purple-800 border-purple-200" },
    MANAGER: { label: "طاولة المدير", badgeColor: "bg-blue-100 text-blue-800 border-blue-200" },
  };

  const statusConfig: Record<TableStatus, { label: string; color: string; border: string }> = {
    AVAILABLE: { label: "متاحة", color: "bg-emerald-50 text-emerald-700", border: "border-emerald-300" },
    OCCUPIED: { label: "مشغولة", color: "bg-rose-50 text-rose-700", border: "border-rose-300" },
    RESERVED: { label: "محجوزة", color: "bg-amber-50 text-amber-700", border: "border-amber-300" },
    CLEANING: { label: "قيد التنظيف", color: "bg-slate-100 text-slate-700", border: "border-slate-300" },
  };

  const filteredTables = initialTables.filter((table) => {
    if (filter === "ALL") return true;
    if (filter === "FAMILY") return table.type === TableType.FAMILY_BOOTH;
    if (filter === "VIP") return table.type === TableType.VIP;
    if (filter === "REGULAR") return table.type === TableType.REGULAR;
    if (filter === "SPECIAL") return table.type === TableType.OWNER || table.type === TableType.MANAGER;
    return true;
  });

  const handleStatusChange = (id: string, newStatus: TableStatus) => {
    startTransition(async () => {
      await updateTableStatus(id, newStatus);
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف ${name}؟`)) {
      startTransition(async () => {
        await deleteTable(id);
      });
    }
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createTable(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        form.reset();
        setShowAddModal(false);
      }
    });
  };

  // Counts for summary pills
  const familyCount = initialTables.filter((t) => t.type === TableType.FAMILY_BOOTH).length;
  const vipCount = initialTables.filter((t) => t.type === TableType.VIP).length;
  const regularCount = initialTables.filter((t) => t.type === TableType.REGULAR).length;
  const specialCount = initialTables.filter((t) => t.type === TableType.OWNER || t.type === TableType.MANAGER).length;

  return (
    <div className="space-y-6">
      {/* Filters and Action Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Type Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              filter === "ALL"
                ? "bg-primary-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            الكل ({initialTables.length})
          </button>
          <button
            onClick={() => setFilter("FAMILY")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              filter === "FAMILY"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            باكيات عائلات ({familyCount})
          </button>
          <button
            onClick={() => setFilter("VIP")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              filter === "VIP"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            طاولات VIP ({vipCount})
          </button>
          <button
            onClick={() => setFilter("REGULAR")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              filter === "REGULAR"
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            طاولات عادية ({regularCount})
          </button>
          <button
            onClick={() => setFilter("SPECIAL")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
              filter === "SPECIAL"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100"
            }`}
          >
            المالك والمدير ({specialCount})
          </button>
        </div>

        {/* Add Table Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-700 hover:bg-primary-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>إضافة طاولة جديدة</span>
        </button>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTables.map((table) => {
          const typeInfo = tableTypeLabels[table.type];
          const statusInfo = statusConfig[table.status];

          return (
            <div
              key={table.id}
              className={`bg-white rounded-2xl p-5 border-2 ${statusInfo.border} shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${typeInfo.badgeColor}`}>
                    {typeInfo.label}
                  </span>
                  <button
                    onClick={() => handleDelete(table.id, table.name)}
                    className="text-slate-300 hover:text-rose-500 transition p-1"
                    title="حذف الطاولة"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-black text-slate-800">{table.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    {table.number && <span>رقم: #{table.number}</span>}
                    <span>السعة: {table.capacity} أفراد</span>
                  </div>
                </div>
              </div>

              {/* Status Switcher Buttons */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 mb-2">تحديث الحالة السريعة:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(statusConfig) as TableStatus[]).map((st) => (
                    <button
                      key={st}
                      disabled={isPending || table.status === st}
                      onClick={() => handleStatusChange(table.id, st)}
                      className={`text-xs py-1.5 px-2 rounded-lg font-bold border transition ${
                        table.status === st
                          ? `${statusConfig[st].color} border-current ring-1 ring-current font-extrabold`
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

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-black text-slate-800">إضافة طاولة أو باكية جديدة</h3>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الطاولة *</label>
                <input
                  name="name"
                  required
                  placeholder="مثال: باكية عائلية 7 أو طاولة VIP 9"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الطاولة</label>
                  <input
                    name="number"
                    type="number"
                    placeholder="101"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السعة (أفراد)</label>
                  <input
                    name="capacity"
                    type="number"
                    defaultValue={4}
                    min={1}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الطاولة *</label>
                <select
                  name="type"
                  defaultValue={TableType.REGULAR}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                >
                  <option value={TableType.FAMILY_BOOTH}>باكية عائلية (Family Booth)</option>
                  <option value={TableType.VIP}>طاولة VIP فاخرة</option>
                  <option value={TableType.REGULAR}>طاولة عادية (Regular)</option>
                  <option value={TableType.OWNER}>طاولة المالك (Owner Table)</option>
                  <option value={TableType.MANAGER}>طاولة المدير (Manager Table)</option>
                </select>
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
                  {isPending ? "جاري الحفظ..." : "إضافة الطاولة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
