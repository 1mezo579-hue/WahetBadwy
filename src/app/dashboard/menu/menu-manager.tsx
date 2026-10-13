"use client";

import { useState, useTransition } from "react";
import { UnitType } from "@prisma/client";
import {
  createCategory,
  deleteCategory,
  createMenuItem,
  toggleMenuItemStatus,
  deleteMenuItem,
  addRecipeItem,
  removeRecipeItem,
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
  const [showAddItemModal, setShowAddItemModal] = useState(false);
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
        await deleteMenuItem(id);
      });
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف القسم: ${name}؟ سيتم حذف جميع الأصناف التابعة له!`)) {
      startTransition(async () => {
        await deleteCategory(id);
      });
    }
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

                {item.description && (
                  <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
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
                  placeholder="مثال: الطواجن البدوية"
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
    </div>
  );
}
