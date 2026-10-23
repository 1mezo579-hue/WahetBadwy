"use client";

import { useState, useTransition, useMemo } from "react";
import { EquipmentStatus } from "@prisma/client";
import { EquipmentType } from "@/types/equipment";
import {
  createEquipment,
  updateEquipmentStatus,
  updateEquipment,
  deleteEquipment,
  clearSectionEquipment,
  syncHeroInvoiceEquipment,
} from "@/actions/equipment";
import { heroInvoiceEquipmentData } from "@/data/hero-invoice-data";

interface EquipmentItem {
  id: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  quantity?: number;
  unit?: string | null;
  unitPrice?: number | null;
  purchaseDate?: Date | string | null;
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
  const [activeTab, setActiveTab] = useState<EquipmentType>(EquipmentType.SHISHA);
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Edit Equipment State
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<EquipmentType>(EquipmentType.SHISHA);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editUnit, setEditUnit] = useState("قطعة");
  const [editUnitPrice, setEditUnitPrice] = useState(0);
  const [editPurchaseDate, setEditPurchaseDate] = useState("2026-09-30");
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
    SHISHA: {
      title: "عدة الشيشة والمعسل",
      icon: "💨",
      color: "bg-purple-50 text-purple-900 hover:bg-purple-100",
      activeColor: "bg-purple-800 text-white shadow-md shadow-purple-950/20",
      desc: "شيش لوكس، قلوب منقوشة ونحاس، طاسات، كسوات، مباسم، فوارغ، أحجار، وفويل معتمد.",
      placeholder: "مثال: شيشة لوكس HR-9013، قلب كورة منقوش، حجر سيراميك، طاسة دهب...",
    },
    BALADI_COFFEE: {
      title: "عدة القهوة البلدي والبار",
      icon: "☕",
      color: "bg-amber-50 text-amber-900 hover:bg-amber-100",
      activeColor: "bg-amber-700 text-white shadow-md shadow-amber-900/20",
      desc: "الرمالة، برادات الشاي، الكنك، أطقم اللبانات، عمالات الفحم، السكريات، والطفايات.",
      placeholder: "مثال: براد رقم 2، كنكة رقم 3، عمال رقم 1، طقم لبانة استانليس، سكرية...",
    },
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
      icon: "🥤",
      color: "bg-orange-50 text-orange-800 hover:bg-orange-100",
      activeColor: "bg-orange-600 text-white shadow-md shadow-orange-700/20",
      desc: "ماكينات الإسبريسو، المطاحن، خلاطات العصائر، وصانعات الثلج.",
      placeholder: "مثال: ماكينة إسبريسو 2 جروب، مطحنة بن، خلاط فيتاميكس...",
    },
    HALL: {
      title: "ركن الصالة والضيافة",
      icon: "🏛️",
      color: "bg-blue-50 text-blue-800 hover:bg-blue-100",
      activeColor: "bg-blue-700 text-white shadow-md shadow-blue-900/20",
      desc: "طاولات الزان، دومينو عمولة وقواشيط، شاشات العرض، التكييفات والساوند سيستم.",
      placeholder: "مثال: طاولة زان، خشبة دومينو عمولة، شاشة 65 بوصة 4K...",
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

  const filteredEquipment = useMemo(() => {
    return initialEquipment
      .filter((item) => item.type === activeTab)
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          (item.location && item.location.toLowerCase().includes(q)) ||
          (item.unit && item.unit.toLowerCase().includes(q))
        );
      });
  }, [initialEquipment, activeTab, searchQuery]);

  const getSectionCount = (type: EquipmentType) =>
    initialEquipment.filter((item) => item.type === type).length;

  const getSectionTotalPieces = (type: EquipmentType) =>
    initialEquipment
      .filter((item) => item.type === type)
      .reduce((sum, item) => sum + (item.quantity || 1), 0);

  const getSectionTotalCost = (type: EquipmentType) =>
    initialEquipment
      .filter((item) => item.type === type)
      .reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0), 0);

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

  const handleClearSection = (type: EquipmentType) => {
    const secName = sectionsConfig[type].title;
    const count = getSectionCount(type);
    if (count === 0) {
      alert(`قسم ${secName} لا يحتوي على أي معدات لحذفها.`);
      return;
    }
    if (
      confirm(
        `تحذير: هل أنت متأكد من حذف كافة معدات (${secName}) بالكامل؟\nسيتم حذف عدد (${count}) عنصر نهائياً من السيستيم.`
      )
    ) {
      startTransition(async () => {
        const res = await clearSectionEquipment(type);
        if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const handleSyncInvoice = () => {
    if (confirm("هل تريد مزامنة وتحديث بيانات فاتورة شركة شيشة هيرو الـ 57 صنفاً كاملة؟")) {
      startTransition(async () => {
        const res = await syncHeroInvoiceEquipment();
        if (res?.success) {
          alert(`تمت مزامنة ${res.count} صنف من الفاتورة بنجاح.`);
        } else if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const handleOpenEdit = (item: EquipmentItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditType(item.type);
    setEditQuantity(item.quantity || 1);
    setEditUnit(item.unit || "قطعة");
    setEditUnitPrice(item.unitPrice || 0);
    setEditPurchaseDate(
      item.purchaseDate
        ? new Date(item.purchaseDate).toISOString().split("T")[0]
        : "2026-09-30"
    );
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
        quantity: editQuantity,
        unit: editUnit,
        unitPrice: editUnitPrice,
        purchaseDate: editPurchaseDate ? new Date(editPurchaseDate) : null,
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
      {/* Top Banner with Invoice Shortcut and Quick Search */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-950 to-amber-950 text-white p-4 sm:p-5 rounded-3xl border border-stone-800 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-2xl font-black shadow-inner">
            📋
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">
                فاتورة شركة شيشة هيرو لتجارة المعسلات ومستلزمات المقاهي
              </h2>
              <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold px-2 py-0.5 rounded-full">
                حج بدري • 30 سبتمبر 2026
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              57 صنفاً موثقة بالكامل (شيشة من 1-29 و 49-57 • بار من 30-48) بالوحدة والكمية وسعر الوحدة.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowInvoiceModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <span>📜</span>
            <span>عرض كشف حساب الفاتورة الورقية (57 صنف)</span>
          </button>
          <button
            type="button"
            onClick={handleSyncInvoice}
            disabled={isPending}
            className="px-3.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold transition flex items-center gap-1.5"
            title="مزامنة بيانات الفاتورة الأصلية بالكامل"
          >
            <span>🔄</span>
            <span>مزامنة الأصناف</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (6 sections) & Add Button */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {(Object.keys(sectionsConfig) as EquipmentType[]).map((type) => {
            const sec = sectionsConfig[type];
            const isActive = activeTab === type;
            const count = getSectionCount(type);
            const pieces = getSectionTotalPieces(type);

            return (
              <button
                key={type}
                onClick={() => {
                  setActiveTab(type);
                  setSearchQuery("");
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 ${
                  isActive ? sec.activeColor : sec.color
                }`}
              >
                <span>{sec.icon}</span>
                <span>{sec.title}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700 border border-slate-200 shadow-2xs"
                  }`}
                  title={`${count} نوع • ${pieces} قطعة`}
                >
                  {count} ({pieces} ق)
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
          <span>إضافة أداة / معدة جديدة</span>
        </button>
      </div>

      {/* Active Section Description Banner */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{sectionsConfig[activeTab].icon}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black text-slate-800 text-sm sm:text-base">
                {sectionsConfig[activeTab].title}
              </h2>
              <span className="text-[11px] bg-slate-200 text-slate-800 font-bold px-2.5 py-0.5 rounded-full">
                {getSectionCount(activeTab)} أصناف مسجلة
              </span>
              <span className="text-[11px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2.5 py-0.5 rounded-full">
                إجمالي {getSectionTotalPieces(activeTab)} قطعة
              </span>
              <span className="text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-black px-2.5 py-0.5 rounded-full">
                القيمة: {getSectionTotalCost(activeTab).toLocaleString()} ج.م
              </span>
            </div>
            <p className="text-slate-500 mt-1">{sectionsConfig[activeTab].desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {/* Quick Search inside Section */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في هذا القسم..."
              className="px-3 py-1.5 pr-8 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 outline-none w-44 sm:w-56"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
              🔍
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1.5 shadow-2xs"
          >
            <span>+</span>
            <span>إضافة</span>
          </button>
          {filteredEquipment.length > 0 && (
            <button
              type="button"
              onClick={() => handleClearSection(activeTab)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1.5 shadow-2xs"
              title="حذف كافة المعدات المسجلة في هذا القسم"
            >
              <span>🗑️</span>
              <span>مسح القسم</span>
            </button>
          )}
        </div>
      </div>

      {/* Equipment Cards Grid */}
      {filteredEquipment.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
          <span className="text-5xl block mb-3">{sectionsConfig[activeTab].icon}</span>
          <p className="text-slate-700 font-black text-base">
            {searchQuery
              ? `لا توجد نتائج مطابقة لبحثك: "${searchQuery}" في هذا القسم.`
              : `لا توجد معدات مسجلة في ${sectionsConfig[activeTab].title} حالياً.`}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            اضغط على زر &quot;إضافة أداة / معدة جديدة&quot; لتسجيل أول جهاز أو عدة في هذا القسم.
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
            const qty = item.quantity || 1;
            const price = item.unitPrice || 0;
            const total = qty * price;

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

                  <div className="mb-2.5">
                    <h3 className="text-base font-black text-slate-800 leading-snug">
                      {item.name}
                    </h3>
                  </div>

                  {/* Quantity, Unit, and Price Matrix */}
                  <div className="grid grid-cols-2 gap-2 mb-3 bg-stone-50 p-2.5 rounded-2xl border border-stone-200/80">
                    <div>
                      <span className="text-[10px] text-stone-500 font-bold block mb-0.5">
                        الكمية والوحدة:
                      </span>
                      <span className="text-xs font-black text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded-md inline-block font-mono border border-amber-300">
                        {qty} {item.unit || "قطعة"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-stone-500 font-bold block mb-0.5">
                        سعر الوحدة:
                      </span>
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        {price > 0 ? `${price.toLocaleString()} ج.م` : "—"}
                      </span>
                    </div>

                    <div className="col-span-2 pt-1.5 mt-1 border-t border-stone-200/60 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600">
                        الإجمالي التراكمي:
                      </span>
                      <span className="text-xs font-black text-emerald-800 font-mono">
                        {total > 0 ? `${total.toLocaleString()} ج.م` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500 mb-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    <p className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-600">تاريخ التوريد:</span>
                      <span className="font-mono text-slate-700 font-bold">
                        {item.purchaseDate
                          ? new Date(item.purchaseDate).toLocaleDateString("ar-EG")
                          : "30 سبتمبر 2026"}
                      </span>
                    </p>
                    {item.location && (
                      <p className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-600">الموقع:</span>
                        <span>{item.location}</span>
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Status Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-slate-400">الحالة:</span>
                  <div className="flex items-center gap-1">
                    {Object.keys(statusConfig).map((statusKey) => {
                      const st = statusKey as EquipmentStatus;
                      const isCurrent = item.status === st;
                      return (
                        <button
                          key={st}
                          disabled={isCurrent || isPending}
                          onClick={() => handleStatusChange(item.id, st)}
                          className={`text-[10px] px-2 py-1 rounded-lg font-bold transition ${
                            isCurrent
                              ? "bg-slate-200 text-slate-500 cursor-not-allowed opacity-60"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                        >
                          {statusConfig[st].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* INVOICE BREAKDOWN MODAL (كشف حساب شركة شيشة هيرو - 57 صنف) */}
      {/* ======================================================== */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col text-right">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center text-2xl font-black shadow-md">
                  📜
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    كشف حساب عميل: حج بدري (شركة شيشة هيرو)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    تاريخ الكشف: 30 سبتمبر 2026 • تجارة المعسلات والشيشة ومستلزمات المقاهي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Financial Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-center border border-slate-800">
                <span className="text-xs text-stone-400 block mb-0.5">إجمالي المبيعات (الفاتورة)</span>
                <span className="text-lg font-black font-mono text-amber-400">
                  EGP 68,390
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-950 text-white text-center border border-emerald-900">
                <span className="text-xs text-emerald-300 block mb-0.5">تسديدات نقدية</span>
                <span className="text-lg font-black font-mono text-emerald-400">
                  EGP 20,000
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-950 text-white text-center border border-amber-900">
                <span className="text-xs text-amber-300 block mb-0.5">الرصيد الحالي المتبقي</span>
                <span className="text-lg font-black font-mono text-amber-300">
                  EGP 48,390
                </span>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold">
                  <tr>
                    <th className="p-2.5 border-b">#</th>
                    <th className="p-2.5 border-b">اسم الصنف</th>
                    <th className="p-2.5 border-b">القسم</th>
                    <th className="p-2.5 border-b">الوحدة</th>
                    <th className="p-2.5 border-b">الكمية</th>
                    <th className="p-2.5 border-b">سعر الوحدة</th>
                    <th className="p-2.5 border-b">الإجمالي</th>
                    <th className="p-2.5 border-b">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {heroInvoiceEquipmentData.map((item) => (
                    <tr key={item.itemNo} className="hover:bg-amber-50/40 transition">
                      <td className="p-2.5 font-mono font-bold text-slate-500">{item.itemNo}</td>
                      <td className="p-2.5 font-black text-slate-800">{item.name}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.type === EquipmentType.SHISHA
                              ? "bg-purple-100 text-purple-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.type === EquipmentType.SHISHA ? "عدة شيشة" : "بار"}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600">{item.unit}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">{item.quantity}</td>
                      <td className="p-2.5 font-mono text-slate-700">{item.unitPrice} ج.م</td>
                      <td className="p-2.5 font-mono font-black text-emerald-800">
                        {(item.quantity * item.unitPrice).toLocaleString()} ج.م
                      </td>
                      <td className="p-2.5 font-mono text-slate-500">2026-09-30</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                مطعم وكافيه مشويات بسوني • فرع عبد القادر
              </span>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(false)}
                className="px-6 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD EQUIPMENT MODAL */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>{sectionsConfig[activeTab].icon}</span>
                <span>إضافة أداة / معدة إلى: {sectionsConfig[activeTab].title}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">القسم *</label>
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
                  اسم الأداة أو المعدة *
                </label>
                <input
                  name="name"
                  required
                  placeholder={sectionsConfig[activeTab].placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-amber-900 mb-1">
                    عدد القطع / الكمية *
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue={1}
                    required
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-amber-300 text-xs font-mono font-black focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الوحدة (قطعة، كرتونة، كيس...) *
                  </label>
                  <input
                    name="unit"
                    defaultValue="قطعة"
                    required
                    placeholder="مثال: قطعة، كيس، كرتونة 12 ق..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر الوحدة (ج.م)
                  </label>
                  <input
                    name="unitPrice"
                    type="number"
                    step="0.01"
                    defaultValue={0}
                    placeholder="250.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاريخ الشراء / الفاتورة
                  </label>
                  <input
                    name="purchaseDate"
                    type="date"
                    defaultValue="2026-09-30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    الموقع داخل المنشأة
                  </label>
                  <input
                    name="location"
                    placeholder="مثال: ركن الشيشة، البار، الصالة..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات أو مواصفات إضافية
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="أي ملاحظات حول الخامة، المقاس، أو رقم الصنف بالفاتورة..."
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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>✏️</span>
                <span>تعديل بيانات المعدة / الأداة</span>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المعدة / الأداة *</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-amber-900 mb-1">
                    عدد القطع / الكمية *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-amber-300 text-xs font-mono font-black focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الوحدة
                  </label>
                  <input
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر الوحدة (ج.م)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editUnitPrice}
                    onChange={(e) => setEditUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاريخ الشراء / الفاتورة
                  </label>
                  <input
                    type="date"
                    value={editPurchaseDate}
                    onChange={(e) => setEditPurchaseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">الموقع داخل المنشأة</label>
                  <input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
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
