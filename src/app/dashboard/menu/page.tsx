import { getCategories, getMenuItems } from "@/actions/menu";
import { getRawMaterials } from "@/actions/procurement";
import MenuManager from "./menu-manager";

export default async function MenuPage() {
  const [categories, menuItems, rawMaterials] = await Promise.all([
    getCategories(),
    getMenuItems(),
    getRawMaterials(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">قائمة الطعام وبناء الوصفات (Menu & Recipe Management)</h1>
        <p className="text-sm text-slate-500 mt-1">
          إدارة الأقسام والأصناف، وهندسة المعايير والمكونات (Recipes) وربطها بالمخزون لحساب تكلفة كل طبق ومشروب تلقائياً.
        </p>
      </div>

      <MenuManager
        initialCategories={categories}
        initialMenuItems={menuItems}
        rawMaterials={rawMaterials}
      />
    </div>
  );
}
