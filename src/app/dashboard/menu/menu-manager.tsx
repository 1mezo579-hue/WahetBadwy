"use client";

import { useState, useTransition } from "react";
import { UnitType } from "@prisma/client";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  toggleMenuItemStatus,
  deleteMenuItem,
  addRecipeItem,
  removeRecipeItem,
  importOfficialBasionyMenu,
} from "@/actions/menu";

interface CategoryItem {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
  order: number;
  _count: {
    items: number;
  };
}

interface RecipeItemData {
  id: string;
  quantity: number;
  unit: UnitType;
  rawMaterial: {
    id: string;
    name: string;
    costPerUnit: number;
    unit: UnitType;
  };
}

interface MenuItemData {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
  price: number;
  active: boolean;
  categoryId: string;
  category: {
    id: string;
    nameAr: string;
  };
  recipeItems: RecipeItemData[];
}

interface RawMaterialSimple {
  id: string;
  name: string;
  unit: UnitType;
  costPerUnit: number;
}

export default function MenuManager({
  initialCategories,
  initialMenuItems,
  rawMaterials,
}: {
  initialCategories: CategoryItem[];
  initialMenuItems: MenuItemData[];
  rawMaterials: RawMaterialSimple[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  // Modals
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemData | null>(null);
  const [recipeModalItem, setRecipeModalItem] = useState<MenuItemData | null>(null);

  // Recipe Builder Form State
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [recipeQuantity, setRecipeQuantity] = useState<string>("");
  const [recipeUnit, setRecipeUnit] = useState<UnitType>(UnitType.KG);

  const [errorMessage, setErrorMessage] = useState("");

  const filteredItems = initialMenuItems.filter((item) => {
    if (selectedCategory === "ALL") return true;
    return item.categoryId === selectedCategory;
  });

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      await toggleMenuItemStatus(id, !currentStatus);
    });
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الصنف: ${name}؟`)) {
      startTransition(async () => {
        const res = await deleteMenuItem(id);
        if (res?.message) {
          alert(res.message);
        } else if (res?.error) {
          alert(res.error);
        }
      });
    }
  };

  const handleUpdateCategorySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCategory) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const res = await updateCategory(formData);
      if (res?.error) {
        alert(res.error);
      } else {
        setEditingCategory(null);
      }
    });
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!categoryToDelete) return;
    startTransition(async () => {
      const res = await deleteCategory(categoryToDelete.id);
      if (res?.error) {
        alert(res.error);
      } else {
        if (selectedCategory === categoryToDelete.id) {
          setSelectedCategory("ALL");
        }
        setCategoryToDelete(null);
      }
    });
  };

  const handleAddCategorySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createCategory(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        form.reset();
        setShowAddCategoryModal(false);
      }
    });
  };

  const handleAddItemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createMenuItem(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        form.reset();
        setShowAddItemModal(false);
      }
    });
  };

  const handleEditItemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await updateMenuItem(formData);
      if (res?.error) {
        alert(res.error);
      } else {
        setEditingItem(null);
      }
    });
  };

  const handleAddRecipeIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeModalItem || !selectedMaterialId || !recipeQuantity) return;

    const qty = parseFloat(recipeQuantity);
    startTransition(async () => {
      const res = await addRecipeItem(recipeModalItem.id, selectedMaterialId, qty, recipeUnit);
      if (res?.error) {
        alert(res.error);
      } else {
        setSelectedMaterialId("");
        setRecipeQuantity("");
        // Keep modal updated with newly fetched state
        const updatedItem = initialMenuItems.find((i) => i.id === recipeModalItem.id);
        if (updatedItem) setRecipeModalItem(updatedItem);
      }
    });
  };

  const handleRemoveRecipeIngredient = async (recipeItemId: string) => {
    startTransition(async () => {
      await removeRecipeItem(recipeItemId);
      if (recipeModalItem) {
        const updatedItem = initialMenuItems.find((i) => i.id === recipeModalItem.id);
        if (updatedItem) setRecipeModalItem(updatedItem);
      }
    });
  };

  // Calculate estimated plate cost
  const calculatePlateCost = (items: RecipeItemData[]) => {
    return items.reduce((total, r) => {
      // Simple unit scaling if units match or basic conversion
      let cost = r.quantity * r.rawMaterial.costPerUnit;
      if (r.unit === UnitType.GRAM && r.rawMaterial.unit === UnitType.KG) {
        cost = (r.quantity / 1000) * r.rawMaterial.costPerUnit;
      } else if (r.unit === UnitType.ML && r.rawMaterial.unit === UnitType.LITER) {
        cost = (r.quantity / 1000) * r.rawMaterial.costPerUnit;
      }
      return total + cost;
    }, 0);
  };

  return (
    <div className="space-y-6">
      {/* Empty Menu State & Quick Official Importer */}
      {initialMenuItems.length === 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/20 border-2 border-dashed border-amber-500/40 rounded-3xl p-6 text-center space-y-3">
          <div className="text-3xl">🍖</div>
          <h3 className="text-lg font-black text-amber-950">قائمة الطعام فارغة حالياً (جاهز للتشغيل من الصفر)</h3>
          <p className="text-sm text-stone-600 max-w-xl mx-auto">
            تم تصفير النظام بنجاح من كافة البيانات السابقة. يمكنك إضافة أقسامك وأصنافك يدويًا من الأزرار أدناه، أو استيراد القائمة الرسمية المعتمدة لمشويات بسيوني (45 صنفاً في 6 أقسام) بضغطة زر واحدة.
          </p>
          <button
            onClick={() => {
              if (confirm("هل تريد استيراد قائمة مشويات بسيوني الرسمية (45 صنف في المشويات، السندوتشات، الصواني، الوجبات، الإضافات، والحلويات)؟")) {
                startTransition(async () => {
                  const res = await importOfficialBasionyMenu();
                  if (res?.error) alert(res.error);
                });
              }
            }}
            disabled={isPending}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-sm shadow-lg shadow-orange-600/30 transition inline-flex items-center gap-2 cursor-pointer"
          >
            <span>📥</span>
            <span>استيراد قائمة مشويات بسيوني الرسمية (45 صنف)</span>
          </button>
        </div>
      )}
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition ${
              selectedCategory === "ALL"
                ? "bg-primary-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            كل الأصناف ({initialMenuItems.length})
          </button>
          {initialCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <span>{cat.nameAr}</span>
              <span className="text-[11px] opacity-80">({cat._count.items})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowManageCategoriesModal(true)}
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-1.5 shadow-sm"
            title="إدارة وتعديل وحذف كافة الأقسام"
          >
            <span>⚙️</span>
            <span>إدارة الأقسام</span>
          </button>
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition"
          >
            + إضافة قسم
          </button>
          <button
            onClick={() => setShowAddItemModal(true)}
            className="bg-primary-700 hover:bg-primary-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      </div>

      {/* Selected Category Action Banner */}
      {selectedCategory !== "ALL" && (() => {
        const activeCat = initialCategories.find((c) => c.id === selectedCategory);
        if (!activeCat) return null;
        return (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/50 border border-amber-300/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0">
                📁
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    قسم: {activeCat.nameAr}
                  </h3>
                  {activeCat.name && (
                    <span className="text-xs text-slate-500 font-mono bg-white/70 px-2 py-0.5 rounded-md border border-slate-200">
                      {activeCat.name}
                    </span>
                  )}
                  <span className="text-xs bg-amber-200 text-amber-950 font-black px-2.5 py-0.5 rounded-full border border-amber-300">
                    {activeCat._count.items} أصناف مدرجة
                  </span>
                </div>
                {activeCat.description ? (
                  <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                    {activeCat.description}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1 italic">
                    لا يوجد وصف لهذا القسم حتى الآن.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-amber-200">
              <button
                type="button"
                onClick={() => setEditingCategory(activeCat)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>✏️</span>
                <span>تعديل هذا القسم</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryToDelete(activeCat)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>🗑️</span>
                <span>حذف هذا القسم بالكامل</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredItems.map((item) => {
          const estimatedCost = calculatePlateCost(item.recipeItems);
          const margin = item.price > 0 && estimatedCost > 0 
            ? (((item.price - estimatedCost) / item.price) * 100).toFixed(0)
            : null;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl p-5 border transition flex flex-col justify-between shadow-sm hover:shadow-md ${
                item.active ? "border-slate-200" : "border-rose-200 bg-rose-50/20 opacity-80"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-lg font-bold">
                    {item.category.nameAr}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(item.id, item.active)}
                      className={`text-[11px] px-2 py-0.5 rounded-md font-bold transition ${
                        item.active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                      title="تغيير الإتاحة"
                    >
                      {item.active ? "نشط" : "معطل"}
                    </button>
                    {/* Edit Item Button */}
                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                      title="تعديل الصنف والوصف"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id, item.nameAr)}
                      className="p-1 text-slate-300 hover:text-rose-500 transition"
                      title="حذف"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-black text-slate-800 mb-1">{item.nameAr}</h3>
                {item.name !== item.nameAr && (
                  <p className="text-xs text-slate-400 font-medium mb-2">{item.name}</p>
                )}

                {/* Description & Ingredients Box */}
                {item.description ? (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 mb-3 text-xs text-amber-950">
                    <span className="font-bold text-amber-900 text-[10px] block mb-0.5">المكونات والمحتويات:</span>
                    <p className="leading-relaxed line-clamp-3 font-normal">{item.description}</p>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-2 mb-3 text-center">
                    <span className="text-[11px] text-slate-400">لا يوجد وصف للمكونات (اضغط ✏️ للتعديل)</span>
                  </div>
                )}

                {/* Pricing & Cost Badge */}
                <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">سعر البيع:</span>
                    <span className="font-mono font-black text-slate-900 text-base">
                      {item.price.toFixed(2)} ج.م
                    </span>
                  </div>
                  {estimatedCost > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">تكلفة المكونات:</span>
                      <span className="font-mono font-bold text-amber-700">
                        {estimatedCost.toFixed(2)} ج.م
                        {margin && (
                          <span className="text-emerald-600 mr-1.5 font-sans">
                            (هامش {margin}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recipe Builder Trigger Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  {item.recipeItems.length > 0 ? `🌿 ${item.recipeItems.length} مكونات في الوصفة` : "⚠️ لا توجد وصفة مدخلة"}
                </span>
                <button
                  onClick={() => setRecipeModalItem(item)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary-50 text-primary-800 border border-primary-200 hover:bg-primary-100 transition"
                >
                  هندسة الوصفة ⚙️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recipe Builder Modal */}
      {recipeModalItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  معايير ووصفة: {recipeModalItem.nameAr}
                </h3>
                <p className="text-xs text-slate-500">
                  ربط مكونات الطبق بالمواد الخام لحساب التكلفة وخصم الرصيد تلقائياً.
                </p>
              </div>
              <button
                onClick={() => setRecipeModalItem(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Recipe Ingredients */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">المكونات الحالية للوجبة:</h4>
              {recipeModalItem.recipeItems.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 font-medium">
                  لم يتم ربط أي مواد خام بهذا الصنف بعد. استخدم النموذج بالأسفل للإضافة.
                </div>
              ) : (
                <div className="space-y-2">
                  {recipeModalItem.recipeItems.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <strong className="text-slate-800 font-bold">{r.rawMaterial.name}</strong>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-slate-700">
                          {r.quantity} {r.unit}
                        </span>
                        <button
                          onClick={() => handleRemoveRecipeIngredient(r.id)}
                          className="text-rose-500 hover:text-rose-700 font-bold"
                          title="حذف المكون"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Ingredient Form */}
            <form onSubmit={handleAddRecipeIngredient} className="p-4 rounded-xl border border-primary-200 bg-primary-50/40 space-y-3">
              <h4 className="text-xs font-bold text-primary-900">إضافة مكون جديد للوصفة:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">المادة الخام *</label>
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white outline-none"
                  >
                    <option value="">اختر مادة خام...</option>
                    {rawMaterials.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.costPerUnit} ج.م/{rm.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الكمية لكل وجبة *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    required
                    value={recipeQuantity}
                    onChange={(e) => setRecipeQuantity(e.target.value)}
                    placeholder="مثال: 0.25 أو 150"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">وحدة القياس *</label>
                  <select
                    value={recipeUnit}
                    onChange={(e) => setRecipeUnit(e.target.value as UnitType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white outline-none"
                  >
                    <option value={UnitType.KG}>كيلوجرام (كجم)</option>
                    <option value={UnitType.GRAM}>جرام</option>
                    <option value={UnitType.LITER}>لتر</option>
                    <option value={UnitType.ML}>مليلتر</option>
                    <option value={UnitType.PIECE}>قطعة</option>
                    <option value={UnitType.PORTION}>حصة</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary-800 hover:bg-primary-900 disabled:opacity-50"
                >
                  {isPending ? "جاري الإضافة..." : "+ إضافة للوصفة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-4">إضافة قسم منيو جديد</h3>
            <form onSubmit={handleAddCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالعربية *</label>
                <input
                  name="nameAr"
                  required
                  placeholder="مثال: مشويات مشكلة"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالإنجليزية</label>
                <input
                  name="name"
                  placeholder="Bedouin Clay Pots"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف مختصر</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="وصف هذا القسم من القائمة..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ..." : "حفظ القسم"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Menu Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-4">إضافة صنف جديد لقائمة الطعام</h3>
            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">القسم / التصنيف *</label>
                <select
                  name="categoryId"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                >
                  <option value="">اختر القسم التابع له...</option>
                  {initialCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالعربية *</label>
                  <input
                    name="nameAr"
                    required
                    placeholder="مثال: مندي لحم ضأن"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالإنجليزية</label>
                  <input
                    name="name"
                    placeholder="Mandi Lamb"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع (ج.م) *</label>
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  required
                  placeholder="250.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف الصنف ومكوناته</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="يقدم مع أرز بسمتي وسلطة دقوس..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-primary-700 hover:bg-primary-800 disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ..." : "إضافة الصنف"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Menu Item Modal (تعديل الصنف والوصف والمكونات) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-right">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-bold">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    تعديل صنف: {editingItem.nameAr}
                  </h3>
                  <p className="text-xs text-slate-500">
                    تعديل الاسم، السعر، التصنيف، ووصف المكونات بالتفصيل
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditItemSubmit} className="space-y-4">
              <input type="hidden" name="id" value={editingItem.id} />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  القسم / التصنيف *
                </label>
                <select
                  name="categoryId"
                  defaultValue={editingItem.categoryId}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white font-medium"
                >
                  {initialCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الاسم بالعربية *
                  </label>
                  <input
                    name="nameAr"
                    defaultValue={editingItem.nameAr}
                    required
                    placeholder="مثال: كفتة مشوية"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الاسم بالإنجليزية
                  </label>
                  <input
                    name="name"
                    defaultValue={editingItem.name || ""}
                    placeholder="Grilled Kofta"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر البيع (ج.م) *
                  </label>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    defaultValue={editingItem.price}
                    required
                    placeholder="250.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    حالة الصنف
                  </label>
                  <select
                    name="active"
                    defaultValue={editingItem.active ? "true" : "false"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
                  >
                    <option value="true">🟢 متاح ونشط في المنيو</option>
                    <option value="false">🔴 غير متاح حالياً / معطل</option>
                  </select>
                </div>
              </div>

              {/* خانة الديسكربشن والمكونات */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black text-slate-800">
                    وصف ومحتويات الصنف (مكونات الصينية أو الوجبة أو المشروب)
                  </label>
                  <span className="text-[11px] text-amber-800 font-bold bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300">
                    بيتكون من إيه
                  </span>
                </div>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingItem.description || ""}
                  placeholder="اكتب هنا تفاصيل مكونات الوجبة أو المشروب أو الصينية بالتفصيل (مثال: نص كفتة مشوية + ربع طرب + أرز بسمتي بالمكسرات + سلطات خضراء وطحينة وعيش سخن)..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 تظهر هذه المكونات لطاقم الكاشير داخل شاشة الـ POS لمساعدة فريق العمل في الإجابة على استفسارات الزبائن.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>{isPending ? "جاري الحفظ..." : "حفظ التعديلات"}</span>
                  <span>✓</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal (تعديل بيانات القسم) */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-right">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-bold">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    تعديل القسم: {editingCategory.nameAr}
                  </h3>
                  <p className="text-xs text-slate-500">
                    تعديل اسم القسم، ترتيبه في المنيو والوصف
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCategorySubmit} className="space-y-4">
              <input type="hidden" name="id" value={editingCategory.id} />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم القسم بالعربية *
                </label>
                <input
                  name="nameAr"
                  defaultValue={editingCategory.nameAr}
                  required
                  placeholder="مثال: مشويات بسيوني"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الاسم بالإنجليزية
                </label>
                <input
                  name="name"
                  defaultValue={editingCategory.name || ""}
                  placeholder="Bedouin Grill"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الترتيب في القائمة
                </label>
                <input
                  name="order"
                  type="number"
                  defaultValue={editingCategory.order || 0}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وصف القسم
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingCategory.description || ""}
                  placeholder="وصف مختصر لمحتويات القسم..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>{isPending ? "جاري الحفظ..." : "حفظ التعديلات"}</span>
                  <span>✓</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal (تأكيد حذف القسم بالكامل) */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-right">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-4">
              🗑️
            </div>
            <h3 className="text-lg font-black text-slate-900 text-center mb-2">
              حذف قسم: {categoryToDelete.nameAr}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed text-center mb-4">
              هل أنت متأكد من حذف هذا القسم بالكامل؟ يحتوي القسم حالياً على{" "}
              <strong className="text-rose-600 font-bold">{categoryToDelete._count.items}</strong> صنف.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-5 text-right">
              <p className="text-[11px] text-amber-900 leading-relaxed">
                🛡️ <strong>حماية البيانات:</strong> الأصناف التي لها سجل مبيعات سابق ستُنقل تلقائياً لقسم الأرشيف للحفاظ على الحسابات والفواتير السابقة، بينما سيتم حذف القسم نهائياً من المنيو.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleDeleteCategoryConfirm}
                className="w-1/2 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isPending ? "جاري الحذف..." : "نعم، حذف القسم الآن"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage All Categories Modal (نافذة إدارة وتعديل وحذف كافة الأقسام) */}
      {showManageCategoriesModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col text-right">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-bold">
                  ⚙️
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    إدارة أقسام المنيو
                  </h3>
                  <p className="text-xs text-slate-500">
                    تعديل أسماء الأقسام، ترتيبها، أو حذف أي قسم غير مطلوب
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManageCategoriesModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
              {initialCategories.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  لا توجد أقسام مسجلة حالياً
                </div>
              ) : (
                initialCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-amber-300 transition flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center font-black text-sm">
                        📁
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-800">
                            {cat.nameAr}
                          </h4>
                          {cat.name && (
                            <span className="text-xs text-slate-400 font-mono">
                              ({cat.name})
                            </span>
                          )}
                          <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                            {cat._count.items} صنف
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {cat.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(cat);
                          setShowManageCategoriesModal(false);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 transition flex items-center gap-1"
                        title="تعديل هذا القسم"
                      >
                        <span>✏️</span>
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryToDelete(cat);
                          setShowManageCategoriesModal(false);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 transition flex items-center gap-1"
                        title="حذف هذا القسم"
                      >
                        <span>🗑️</span>
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowManageCategoriesModal(false);
                  setShowAddCategoryModal(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 transition flex items-center gap-1.5"
              >
                <span>+</span>
                <span>إضافة قسم جديد للمنيو</span>
              </button>
              <button
                type="button"
                onClick={() => setShowManageCategoriesModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
