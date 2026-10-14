"use client";

import { useState, useTransition } from "react";
import { EquipmentType, EquipmentStatus } from "@prisma/client";
import {
  createEquipment,
  updateEquipmentStatus,
  updateEquipment,
  deleteEquipment,
} from "@/actions/equipment";

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

export default function EquipmentManager({
  initialEquipment,
}: {
  initialEquipment: EquipmentItem[];
}) {
  const [activeTab, setActiveTab] = useState<EquipmentType>(EquipmentType.KITCHEN);
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Edit Equipment State
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<EquipmentType>(EquipmentType.KITCHEN);
  const [editStatus, setEditStatus] = useState<EquipmentStatus>(EquipmentStatus.OPERATIONAL);
  const [editLocation, setEditLocation] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const statusConfig: Record<EquipmentStatus, { label: string; badge: string }> = {
    OPERATIONAL: {
      label: "جاهزة للعمل",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    MAINTENANCE: {
      label: "قيد الصيانة",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
    },
    OUT_OF_SERVICE: {
      label: "خارج الخدمة",
      badge: "bg-rose-100 text-rose-800 border-rose-200",
    },
  };

  const sectionsConfig: Record<
    EquipmentType,
    {
      title: string;
      icon: string;
      color: string;
      activeColor: string;
      desc: string;
      placeholder: string;
    }
  > = {
    KITCHEN: {
      title: "معدات المطبخ الرئيسي",
      icon: "🍳",
      color: "bg-slate-100 text-slate-700 hover:bg-slate-200",
      activeColor: "bg-primary-900 text-white shadow-md shadow-primary-950/20",
      desc: "أفران المندي، الشوايات، القلايات، وأدوات الطهي والتحضير الساخن.",
      placeholder: "مثال: فرن مندي برميلي، شواية فحم استانلس، قلاية مزدوجة...",
    },
    BARISTA: {
      title: "ركن الباريستا والمشروبات",
      icon: "☕",
      color: "bg-amber-50 text-amber-800 hover:bg-amber-100",
      activeColor: "bg-amber-600 text-white shadow-md shadow-amber-700/20",
      desc: "ماكينات الإسبريسو، المطاحن، خلاطات العصائر، وصانعات الثلج.",
      placeholder: "مثال: ماكينة إسبريسو 2 جروب، مطحنة بن، خلاط فيتاميكس...",
    },
    SHISHA: {
      title: "ركن الشيشة",
      icon: "💨",
      color: "bg-purple-50 text-purple-800 hover:bg-purple-100",
      activeColor: "bg-purple-700 text-white shadow-md shadow-purple-900/20",
      desc: "ولاعات الفحم، المناقل النحاسية، طاولات رص المعسل، وأجهزة التعقيم.",
      placeholder: "مثال: هيتر إشعال فحم كهربائي، منقل نحاسي بدوي، جهاز تعقيم خراطيم...",
    },
    HALL: {
      title: "ركن الصالة والضيافة",
      icon: "🏛️",
      color: "bg-blue-50 text-blue-800 hover:bg-blue-100",
      activeColor: "bg-blue-700 text-white shadow-md shadow-blue-900/20",
      desc: "شاشات العرض الذكية، الساوند سيستم، التكييفات، ومراوح الرذاذ.",
      placeholder: "مثال: شاشة 65 بوصة 4K، ساوند سيستم ياماها، تكييف كونسيلد 5 حصان...",
    },
    BATHROOM: {
      title: "معدات دورات المياه (الحمام)",
      icon: "🧼",
      color: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
      activeColor: "bg-emerald-700 text-white shadow-md shadow-emerald-900/20",
      desc: "مجففات الأيدي السريعة، موزعات الصابون السنسور، الشفاطات، والسخانات.",
      placeholder: "مثال: مجفف يدين هوائي سريع، موزع صابون سنسور، شفاط توربيني...",
    },
  };

  const filteredEquipment = initialEquipment.filter((item) => item.type === activeTab);

  const getSectionCount = (type: EquipmentType) =>
    initialEquipment.filter((item) => item.type === type).length;

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

  const handleOpenEdit = (item: EquipmentItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditType(item.type);
    setEditStatus(item.status);
    setEditLocation(item.location || "");
    setEditSerialNumber(item.serialNumber || "");
    setEditNotes(item.notes || "");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    startTransition(async () => {
      await updateEquipment(editingItem.id, {
        name: editName,
        type: editType,
        status: editStatus,
        location: editLocation || null,
        serialNumber: editSerialNumber || null,
        notes: editNotes || null,
      });
      setEditingItem(null);
    });
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
      {/* Top Navigation Tabs & Add Button */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        {/* Navigation Tabs (5 sections) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {(Object.keys(sectionsConfig) as EquipmentType[]).map((type) => {
            const sec = sectionsConfig[type];
            const isActive = activeTab === type;
            const count = getSectionCount(type);

            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 ${
                  isActive ? sec.activeColor : sec.color
                }`}
              >
                <span>{sec.icon}</span>
                <span>{sec.title}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700 border border-slate-200 shadow-sm"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add Equipment Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-sm transition shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>إضافة معدة جديدة</span>
        </button>
      </div>

      {/* Active Section Description Banner */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{sectionsConfig[activeTab].icon}</span>
          <div>
            <h2 className="font-black text-slate-800 text-sm">
              {sectionsConfig[activeTab].title}
            </h2>
            <p className="text-slate-500 mt-0.5">{sectionsConfig[activeTab].desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-bold text-slate-600 shrink-0">
          <span>إجمالي المعدات بالقسم:</span>
          <span className="font-mono text-base font-black text-slate-900">
            {filteredEquipment.length}
          </span>
        </div>
      </div>

      {/* Equipment Cards Grid */}
      {filteredEquipment.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
          <span className="text-5xl block mb-3">{sectionsConfig[activeTab].icon}</span>
          <p className="text-slate-700 font-black text-base">
            لا توجد معدات مسجلة في {sectionsConfig[activeTab].title} حالياً.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            اضغط على زر &quot;إضافة معدة جديدة&quot; لتسجيل أول جهاز أو أداة في هذا القسم.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition"
          >
            + إضافة معدة الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEquipment.map((item) => {
            const statusInfo = statusConfig[item.status];
            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-xl border font-black ${statusInfo.badge}`}
                    >
                      {statusInfo.label}
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="text-slate-400 hover:text-amber-600 transition p-1.5 rounded-lg hover:bg-amber-50"
                        title="تعديل بيانات المعدة"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(item.id, item.name)}
                        className="text-slate-300 hover:text-rose-500 transition p-1.5 rounded-lg hover:bg-rose-50"
                        title="حذف المعدة"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-black text-slate-800 mb-2">{item.name}</h3>

                  <div className="space-y-1.5 text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {item.location && (
                      <p className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">الموقع:</span>
                        <span>{item.location}</span>
                      </p>
                    )}
                    {item.serialNumber && (
                      <p className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">الرقم التسلسلي / الموديل:</span>
                        <span className="font-mono text-slate-900 font-bold">
                          {item.serialNumber}
                        </span>
                      </p>
                    )}
                    {item.notes && (
                      <p className="flex items-start gap-1.5">
                        <span className="font-bold text-slate-700 shrink-0">ملاحظات:</span>
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
                        className={`text-xs py-1.5 px-1 rounded-xl font-bold border transition ${
                          item.status === st
                            ? `${statusConfig[st].badge} font-black ring-1 ring-current`
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

      {/* ======================================================== */}
      {/* ADD EQUIPMENT MODAL */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>➕</span>
                <span>إضافة معدة جديدة ({sectionsConfig[activeTab].title})</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">القسم التابع له *</label>
                <select
                  name="type"
                  defaultValue={activeTab}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                >
                  {(Object.keys(sectionsConfig) as EquipmentType[]).map((t) => (
                    <option key={t} value={t}>
                      {sectionsConfig[t].icon} {sectionsConfig[t].title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الجهاز / المعدة *
                </label>
                <input
                  name="name"
                  required
                  placeholder={sectionsConfig[activeTab].placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الموقع / القسم داخل واحة بدوي
                </label>
                <input
                  name="location"
                  placeholder="مثال: ركن الشيشة الخارجي، مغاسل الصالة..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الرقم التسلسلي أو الموديل
                </label>
                <input
                  name="serialNumber"
                  placeholder="SN-123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  حالة التشغيل المبدئية
                </label>
                <select
                  name="status"
                  defaultValue={EquipmentStatus.OPERATIONAL}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                >
                  <option value={EquipmentStatus.OPERATIONAL}>جاهزة للعمل (Operational)</option>
                  <option value={EquipmentStatus.MAINTENANCE}>قيد الصيانة (Under Maintenance)</option>
                  <option value={EquipmentStatus.OUT_OF_SERVICE}>خارج الخدمة (Out of Service)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات أو جدول الصيانة
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="ملاحظات الصيانة الدورية..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                >
                  {isPending ? "جاري الحفظ..." : "إضافة المعدة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT EQUIPMENT MODAL */}
      {/* ======================================================== */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>✏️</span>
                <span>تعديل بيانات المعدة</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">القسم</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as EquipmentType)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                >
                  {(Object.keys(sectionsConfig) as EquipmentType[]).map((t) => (
                    <option key={t} value={t}>
                      {sectionsConfig[t].icon} {sectionsConfig[t].title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المعدة *</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموقع داخل المنشأة</label>
                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرقم التسلسلي</label>
                <input
                  value={editSerialNumber}
                  onChange={(e) => setEditSerialNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة التشغيل</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as EquipmentStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                >
                  <option value={EquipmentStatus.OPERATIONAL}>جاهزة للعمل (Operational)</option>
                  <option value={EquipmentStatus.MAINTENANCE}>قيد الصيانة (Under Maintenance)</option>
                  <option value={EquipmentStatus.OUT_OF_SERVICE}>خارج الخدمة (Out of Service)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                >
                  {isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
