"use client";

import { useState, useTransition, useMemo } from "react";
import { UnitType } from "@prisma/client";
import {
  recordPurchase,
  createRawMaterial,
  updateRecipeItemQuantity,
} from "@/actions/procurement";

export interface RawMaterialItem {
  id: string;
  name: string;
  category: string;
  type: string;
  unit: UnitType;
  purchaseUnit: string;
  issueUnit: string;
  conversionFactor: number;
  costPerUnit: number;
  currentStock: number;
  minStockLevel: number;
  status: string;
  _count: {
    recipeItems: number;
    transactions: number;
  };
}

export interface MenuItemProfitability {
  id: string;
  nameAr: string;
  categoryName: string;
  salePrice: number;
  foodCost: number;
  packagingCost: number;
  knownDirectCost: number;
  isCostComplete: boolean;
  grossProfit: number | null;
  grossMarginPercentage: number | null;
  statusText: string;
  incompleteReasons: string[];
  ingredientsCount: number;
  recipes: Array<{
    id: string;
    rawMaterialId: string;
    rawMaterialName: string;
    category: string;
    type: string;
    quantity: number;
    unit: UnitType;
    issueUnit: string;
    purchaseUnit: string;
    costPerUnit: number;
    isComplete: boolean;
    status: string;
    itemCost: number;
  }>;
}

export default function ProcurementManager({
  initialMaterials,
  initialProfitability,
}: {
  initialMaterials: RawMaterialItem[];
  initialProfitability: MenuItemProfitability[];
}) {
  const [activeTab, setActiveTab] = useState<"INVENTORY" | "PROFITABILITY">("INVENTORY");
  const [isPending, startTransition] = useTransition();

  // Materials State
  const [materials, setMaterials] = useState<RawMaterialItem[]>(initialMaterials);
  const [materialFilterCategory, setMaterialFilterCategory] = useState<string>("ALL");
  const [materialFilterType, setMaterialFilterType] = useState<string>("ALL");
  const [materialSearch, setMaterialSearch] = useState<string>("");

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<RawMaterialItem | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState<string>("");
  const [purchaseUnitCost, setPurchaseUnitCost] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("");
  const [purchaseNotes, setPurchaseNotes] = useState<string>("");

  // Recipe Editing State
  const [profitability, setProfitability] = useState<MenuItemProfitability[]>(initialProfitability);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItemProfitability | null>(null);
  const [menuFilterCategory, setMenuFilterCategory] = useState<string>("ALL");
  const [menuSearch, setMenuSearch] = useState<string>("");
  const [editingRecipeQuantities, setEditingRecipeQuantities] = useState<Record<string, number>>({});

  // Feedback Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(materials.map((m) => m.category).filter(Boolean));
    return ["ALL", ...Array.from(set)];
  }, [materials]);

  const menuCategories = useMemo(() => {
    const set = new Set(profitability.map((p) => p.categoryName).filter(Boolean));
    return ["ALL", ...Array.from(set)];
  }, [profitability]);

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchCat = materialFilterCategory === "ALL" || m.category === materialFilterCategory;
      const matchType = materialFilterType === "ALL" || m.type === materialFilterType;
      const matchSearch =
        !materialSearch.trim() ||
        m.name.toLowerCase().includes(materialSearch.toLowerCase().trim());
      return matchCat && matchType && matchSearch;
    });
  }, [materials, materialFilterCategory, materialFilterType, materialSearch]);

  // Filtered Menu Profitability
  const filteredProfitability = useMemo(() => {
    return profitability.filter((item) => {
      const matchCat = menuFilterCategory === "ALL" || item.categoryName === menuFilterCategory;
      const matchSearch =
        !menuSearch.trim() ||
        item.nameAr.toLowerCase().includes(menuSearch.toLowerCase().trim());
      return matchCat && matchSearch;
    });
  }, [profitability, menuFilterCategory, menuSearch]);

  // Statistics
  const totalStockedCount = materials.filter((m) => m.currentStock > 0).length;
  const outOfStockCount = materials.filter((m) => m.currentStock <= 0).length;
  const completedRecipesCount = profitability.filter((p) => p.isCostComplete).length;
  const incompleteRecipesCount = profitability.length - completedRecipesCount;

  // Handle Record Purchase Submit
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseTarget) return;

    const qty = parseFloat(purchaseQuantity);
    const cost = parseFloat(purchaseUnitCost);

    if (isNaN(qty) || qty <= 0) {
      setErrorMessage("يرجى إدخال كمية صحيحة أكبر من الصفر");
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setErrorMessage("يرجى إدخال سعر تكلفة صحيح");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await recordPurchase({
        rawMaterialId: purchaseTarget.id,
        quantity: qty,
        unitCost: cost,
        supplierName: supplierName.trim() || undefined,
        notes: purchaseNotes.trim() || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || "فشل تسجيل الشراء");
      } else {
        setSuccessMessage(res.message || "تم تسجيل عملية الشراء بنجاح ✓");
        if (res.material) {
          setMaterials((prev) =>
            prev.map((m) => (m.id === res.material.id ? { ...m, ...res.material } : m))
          );
        }
        setPurchaseTarget(null);
        setPurchaseQuantity("");
        setPurchaseUnitCost("");
        setSupplierName("");
        setPurchaseNotes("");
      }
    });
  };

  // Handle Recipe Item Quantity Save
  const handleSaveRecipeQuantities = async () => {
    if (!selectedMenuItem) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      for (const [recipeItemId, qty] of Object.entries(editingRecipeQuantities)) {
        await updateRecipeItemQuantity({
          recipeItemId,
          quantity: Number(qty) || 0,
          isComplete: (Number(qty) || 0) > 0,
        });
      }

      setSuccessMessage(`تم حفظ واعتماد مقادير وصفة (${selectedMenuItem.nameAr}) بنجاح ✓`);
      setSelectedMenuItem(null);
      // Refresh page data
      window.location.reload();
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Global Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab("INVENTORY")}
          className={`pb-3 px-2 font-black text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === "INVENTORY"
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>📦</span>
          <span>دليل الخامات والمخزون والتوريد ({materials.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("PROFITABILITY")}
          className={`pb-3 px-2 font-black text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === "PROFITABILITY"
              ? "border-amber-500 text-amber-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>🥩</span>
          <span>تكلفة أصناف المنيو وهامش الربح ({profitability.length})</span>
          {incompleteRecipesCount > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {incompleteRecipesCount} غير مكتمل
            </span>
          )}
        </button>
      </div>

      {/* Alert Notices */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-800 font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-800">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-800 font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800">
            ✕
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: RAW MATERIALS, PACKAGING & CLEANING INVENTORY           */}
      {/* ============================================================== */}
      {activeTab === "INVENTORY" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-400 font-bold block mb-1">إجمالي الخامات المسجلة</span>
              <span className="text-2xl font-black text-slate-800 font-mono">{materials.length}</span>
              <span className="text-[10px] text-slate-400 block mt-1">طعام + تغليف + نظافة</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-400 font-bold block mb-1">الخامات المتوفرة بالمخزن</span>
              <span className="text-2xl font-black text-emerald-600 font-mono">{totalStockedCount}</span>
              <span className="text-[10px] text-emerald-600/80 block mt-1">تم شراؤها ورصيدها كافي</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-400 font-bold block mb-1">أصناف لم يتم شراؤها بعد</span>
              <span className="text-2xl font-black text-amber-600 font-mono">{outOfStockCount}</span>
              <span className="text-[10px] text-amber-600/80 block mt-1">رصيدها صفر وحالتها غير متوفرة</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-stone-950 font-black py-2.5 px-4 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <span>➕</span>
                <span>إضافة صنف جديد للدليل</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="ابحث بالاسم (مثال: كفتة، طماطم، علب...)"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-amber-500 w-60"
              />

              {/* Type Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  onClick={() => setMaterialFilterType("ALL")}
                  className={`px-3 py-1 rounded-lg transition ${
                    materialFilterType === "ALL" ? "bg-white text-slate-900 shadow-sm" : ""
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setMaterialFilterType("FOOD")}
                  className={`px-3 py-1 rounded-lg transition ${
                    materialFilterType === "FOOD" ? "bg-white text-amber-700 shadow-sm" : ""
                  }`}
                >
                  🥩 غذائي
                </button>
                <button
                  onClick={() => setMaterialFilterType("PACKAGING")}
                  className={`px-3 py-1 rounded-lg transition ${
                    materialFilterType === "PACKAGING" ? "bg-white text-sky-700 shadow-sm" : ""
                  }`}
                >
                  📦 تغليف
                </button>
                <button
                  onClick={() => setMaterialFilterType("CLEANING")}
                  className={`px-3 py-1 rounded-lg transition ${
                    materialFilterType === "CLEANING" ? "bg-white text-teal-700 shadow-sm" : ""
                  }`}
                >
                  🧼 نظافة
                </button>
              </div>

              {/* Category Dropdown */}
              <select
                value={materialFilterCategory}
                onChange={(e) => setMaterialFilterCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-amber-500 font-bold text-slate-700"
              >
                <option value="ALL">جميع المجموعات ({categories.length - 1})</option>
                {categories
                  .filter((c) => c !== "ALL")
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            <span className="text-xs text-slate-400 font-bold">
              عرض {filteredMaterials.length} من أصل {materials.length} صنف
            </span>
          </div>

          {/* Materials Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">اسم الصنف</th>
                    <th className="py-3.5 px-4">المجموعة والنوع</th>
                    <th className="py-3.5 px-4">وحدات الشراء والصرف</th>
                    <th className="py-3.5 px-4">الرصيد الفعلي بالمخزن</th>
                    <th className="py-3.5 px-4">تكلفة الوحدة (المتوسط)</th>
                    <th className="py-3.5 px-4">حالة التوفر</th>
                    <th className="py-3.5 px-4 text-center">إجراءات التوريد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMaterials.map((mat) => {
                    const isOutOfStock = mat.currentStock <= 0;
                    const isLowStock = mat.currentStock > 0 && mat.currentStock <= mat.minStockLevel;

                    return (
                      <tr key={mat.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-black text-slate-800 text-sm">
                          {mat.name}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[11px]">
                              {mat.category}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                mat.type === "FOOD"
                                  ? "bg-amber-100 text-amber-800"
                                  : mat.type === "PACKAGING"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-teal-100 text-teal-800"
                              }`}
                            >
                              {mat.type === "FOOD" ? "طعام" : mat.type === "PACKAGING" ? "تغليف" : "نظافة"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-[11px] space-y-0.5">
                            <div>
                              <span className="text-slate-400">الشراء: </span>
                              <strong className="text-slate-700">{mat.purchaseUnit}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">الصرف: </span>
                              <span className="text-slate-600">
                                {mat.issueUnit} (1 {mat.purchaseUnit} = {mat.conversionFactor} {mat.issueUnit})
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-xs">
                            <span
                              className={`font-black text-sm ${
                                isOutOfStock
                                  ? "text-slate-400"
                                  : isLowStock
                                  ? "text-rose-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {mat.currentStock.toLocaleString("ar-EG")}
                            </span>
                            <span className="text-slate-400 mr-1 text-[11px]">{mat.issueUnit}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono">
                            <span className="font-bold text-slate-800 text-xs">
                              {mat.costPerUnit > 0 ? `${mat.costPerUnit.toFixed(3)} ج.م` : "—"}
                            </span>
                            <span className="text-[10px] text-slate-400 mr-1">/ {mat.issueUnit}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {isOutOfStock ? (
                            <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              غير متوفر (0)
                            </span>
                          ) : isLowStock ? (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              منخفض ⚠️
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              متوفر بالمخزن ✓
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setPurchaseTarget(mat);
                              setPurchaseQuantity("");
                              setPurchaseUnitCost("");
                              setSupplierName("");
                              setPurchaseNotes("");
                            }}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-xl font-bold text-xs transition"
                          >
                            ➕ تسجيل شراء وتوريد
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MENU COSTING & GROSS PROFIT MARGIN                      */}
      {/* ============================================================== */}
      {activeTab === "PROFITABILITY" && (
        <div className="space-y-6">
          {/* Rules Banner (Requirement 8) */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 space-y-1">
            <div className="flex items-center gap-2 font-black text-sm text-amber-900">
              <span>📊</span>
              <span>قواعد احتساب التكلفة وهامش مجمل الربح لمشويات بسيوني:</span>
            </div>
            <p className="leading-relaxed text-amber-800">
              • <strong>التكلفة المباشرة:</strong> إجمالي تكلفة خامات الطعام المستخدمة في الوجبة + تكلفة أدوات التغليف المستهلكة فعلياً.
              <br />
              • <strong>مجمل الربح (بالجنيه):</strong> سعر البيع المسجل بالمنيو − التكلفة المباشرة المعروفة.
              <br />
              • <strong>هامش مجمل الربح (%):</strong> (مجمل الربح ÷ سعر البيع) × 100.
              <br />
              • <strong>تنبيه الأمان والشفافية:</strong> في حال عدم تحديد كمية أي خامة في الوصفة، أو عدم شراء خامة بعد (تكلفتها صفر)، يُعرض الصنف بحالة <strong>«التكلفة غير مكتملة»</strong> ولا يتم عرض نسبة ربح مضللة، حتى يقوم المدير باعتماد المقادير وتسجيل الشراء الفعلي.
            </p>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="ابحث عن صنف بالمنيو (كفتة، سجق، فراخ...)"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-amber-500 w-60"
              />

              <select
                value={menuFilterCategory}
                onChange={(e) => setMenuFilterCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-amber-500 font-bold text-slate-700"
              >
                <option value="ALL">جميع أقسام المنيو ({menuCategories.length - 1})</option>
                {menuCategories
                  .filter((c) => c !== "ALL")
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg font-bold">
                {completedRecipesCount} وصفات مكتملة
              </span>
              <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg font-bold">
                {incompleteRecipesCount} وصفات بحاجة لتحديد مقادير
              </span>
            </div>
          </div>

          {/* Menu Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">صنف المنيو</th>
                    <th className="py-3.5 px-4">القسم</th>
                    <th className="py-3.5 px-4">سعر البيع</th>
                    <th className="py-3.5 px-4">تكلفة الخامات</th>
                    <th className="py-3.5 px-4">تكلفة التغليف</th>
                    <th className="py-3.5 px-4">إجمالي التكلفة المباشرة</th>
                    <th className="py-3.5 px-4">مجمل الربح (ج.م)</th>
                    <th className="py-3.5 px-4">هامش الربح (%)</th>
                    <th className="py-3.5 px-4">حالة الوصفة</th>
                    <th className="py-3.5 px-4 text-center">إدارة الوصفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProfitability.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-black text-slate-800 text-sm">
                        {item.nameAr}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {item.ingredientsCount} مكونات مرتبطة
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-600">
                        {item.categoryName}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900 text-xs">
                        {item.salePrice.toFixed(2)} ج.م
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {item.isCostComplete ? `${item.foodCost.toFixed(2)} ج.م` : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {item.isCostComplete ? `${item.packagingCost.toFixed(2)} ج.م` : "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {item.isCostComplete ? (
                          `${item.knownDirectCost.toFixed(2)} ج.م`
                        ) : (
                          <span className="text-amber-600 font-sans text-[11px]">غير مكتملة</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {item.isCostComplete && item.grossProfit !== null ? (
                          <span
                            className={`font-black text-sm ${
                              item.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {item.grossProfit.toFixed(2)} ج.م
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {item.isCostComplete && item.grossMarginPercentage !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                              item.grossMarginPercentage >= 40
                                ? "bg-emerald-100 text-emerald-800"
                                : item.grossMarginPercentage >= 20
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {item.grossMarginPercentage}%
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.isCostComplete ? (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            معتمدة ومكتملة ✓
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold inline-block">
                              التكلفة غير مكتملة
                            </span>
                            {item.incompleteReasons.length > 0 && (
                              <div className="text-[10px] text-amber-700 truncate max-w-[140px]" title={item.incompleteReasons.join(" • ")}>
                                {item.incompleteReasons[0]}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedMenuItem(item);
                            const qMap: Record<string, number> = {};
                            item.recipes.forEach((r) => {
                              qMap[r.id] = r.quantity;
                            });
                            setEditingRecipeQuantities(qMap);
                          }}
                          className="bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 font-bold px-3 py-1 rounded-xl text-xs transition"
                        >
                          ✏️ ضبط المقادير
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: RECORD PURCHASE & RESTOCK (Requirement 7)             */}
      {/* ============================================================== */}
      {purchaseTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div dir="rtl" className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📥</span>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    تسجيل شراء وتوريد مخزون
                  </h3>
                  <p className="text-xs text-amber-600 font-bold">{purchaseTarget.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPurchaseTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>وحدة الشراء المعتمدة:</span>
                  <strong className="text-slate-800">{purchaseTarget.purchaseUnit}</strong>
                </div>
                <div className="flex justify-between">
                  <span>معامل التحويل لوحدة الصرف:</span>
                  <span className="text-slate-700">
                    1 {purchaseTarget.purchaseUnit} = {purchaseTarget.conversionFactor} {purchaseTarget.issueUnit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>الرصيد الحالي بالمخزن:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {purchaseTarget.currentStock} {purchaseTarget.issueUnit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  الكمية المشتراة (بـ {purchaseTarget.purchaseUnit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(e.target.value)}
                  placeholder="مثال: 10"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono font-bold outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  سعر التكلفة للـ {purchaseTarget.purchaseUnit} (ج.م) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={purchaseUnitCost}
                  onChange={(e) => setPurchaseUnitCost(e.target.value)}
                  placeholder="مثال: 350"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono font-bold outline-none focus:border-amber-500"
                />
              </div>

              {/* Live Preview calculation */}
              {parseFloat(purchaseQuantity) > 0 && parseFloat(purchaseUnitCost) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-950 space-y-1">
                  <div className="flex justify-between">
                    <span>إجمالي فاتورة الشراء:</span>
                    <strong className="font-mono text-sm text-amber-900">
                      {(parseFloat(purchaseQuantity) * parseFloat(purchaseUnitCost)).toFixed(2)} ج.م
                    </strong>
                  </div>
                  <div className="flex justify-between text-[11px] text-amber-800">
                    <span>زيادة الرصيد المضاف:</span>
                    <span className="font-mono font-bold">
                      {(parseFloat(purchaseQuantity) * purchaseTarget.conversionFactor).toLocaleString("ar-EG")}{" "}
                      {purchaseTarget.issueUnit}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-amber-800">
                    <span>تكلفة وحدة الصرف ({purchaseTarget.issueUnit}):</span>
                    <span className="font-mono font-bold">
                      {(parseFloat(purchaseUnitCost) / purchaseTarget.conversionFactor).toFixed(4)} ج.م
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-600 mb-1">اسم المورد (اختياري)</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="مثال: جزارة الأمانة / تجارة التغليف"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">ملاحظات الفاتورة أو التوريد</label>
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder="رقم الفاتورة أو تفاصيل إضافية"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-stone-950 font-bold py-2.5 rounded-xl shadow-md transition disabled:opacity-50 text-xs"
                >
                  {isPending ? "جاري الحفظ والتسجيل..." : "اعتماد وتحديث المخزون"}
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EDIT RECIPE QUANTITIES (Requirement 6 & 8)           */}
      {/* ============================================================== */}
      {selectedMenuItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div dir="rtl" className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  تحديد مقادير وصفة: {selectedMenuItem.nameAr}
                </h3>
                <p className="text-xs text-slate-500">
                  سعر البيع: {selectedMenuItem.salePrice} ج.م — حدد المقدار المستهلك لكل وجبة
                </p>
              </div>
              <button
                onClick={() => setSelectedMenuItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-900 text-[11px]">
                ℹ️ أدخل الكمية بوحدة الصرف (مثال: اللحوم بالجرام، العلب بالحبة، الزيوت بالمل). لن يتم الخصم التلقائي إلا بعد تحديد الكمية واعتمادها.
              </div>

              {selectedMenuItem.recipes.map((r) => (
                <div
                  key={r.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <span>{r.type === "PACKAGING" ? "📦" : "🥩"}</span>
                      <span>{r.rawMaterialName}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {r.category} • التكلفة:{" "}
                      {r.costPerUnit > 0 ? `${r.costPerUnit.toFixed(3)} ج.م / ${r.issueUnit}` : "لم تسجل تكلفة بعد"}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editingRecipeQuantities[r.id] ?? r.quantity}
                      onChange={(e) =>
                        setEditingRecipeQuantities((prev) => ({
                          ...prev,
                          [r.id]: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                      className="w-20 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-800 font-mono font-bold text-center outline-none focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-600 font-bold w-10">{r.issueUnit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100 mt-3 shrink-0">
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveRecipeQuantities}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-md transition disabled:opacity-50 text-xs"
              >
                {isPending ? "جاري الحفظ..." : "حفظ واعتماد مقادير الوصفة"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedMenuItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ADD NEW RAW MATERIAL ITEM                             */}
      {/* ============================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div dir="rtl" className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span>➕</span>
                <span>إضافة صنف جديد لدليل الخامات</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                startTransition(async () => {
                  const res = await createRawMaterial(fd);
                  if (res.success && res.material) {
                    setMaterials((prev) => [res.material as any, ...prev]);
                    setShowAddModal(false);
                    setSuccessMessage("تمت إضافة الصنف الجديد للدليل بنجاح ✓");
                  } else {
                    setErrorMessage(res.error || "فشل إضافة الصنف");
                  }
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم الصنف أو الخامة *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="مثال: لحمة موزة / علب صوص خاصة"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">النوع *</label>
                  <select
                    name="type"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 outline-none font-bold"
                  >
                    <option value="FOOD">🥩 خامة غذائية</option>
                    <option value="PACKAGING">📦 أداة تغليف</option>
                    <option value="CLEANING">🧼 أداة نظافة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">المجموعة *</label>
                  <select
                    name="category"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 outline-none font-bold"
                  >
                    <option value="اللحوم والدواجن">اللحوم والدواجن</option>
                    <option value="الخضار والسلطات">الخضار والسلطات</option>
                    <option value="العطارة والتوابل">العطارة والتوابل</option>
                    <option value="الزيوت والصلصات والمكونات المساعدة">الزيوت والصلصات</option>
                    <option value="أدوات التغليف">أدوات التغليف</option>
                    <option value="أدوات النظافة والتشغيل">أدوات النظافة والتشغيل</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">وحدة الشراء</label>
                  <input
                    type="text"
                    name="purchaseUnit"
                    defaultValue="كجم"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">وحدة الصرف</label>
                  <input
                    type="text"
                    name="issueUnit"
                    defaultValue="جرام"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">معامل التحويل</label>
                  <input
                    type="number"
                    name="conversionFactor"
                    defaultValue="1000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-mono outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold py-2.5 rounded-xl shadow-md transition disabled:opacity-50 text-xs"
                >
                  {isPending ? "جاري الإضافة..." : "إضافة الصنف"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold transition text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
