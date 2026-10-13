import { getTables } from "@/actions/tables";
import TablesManager from "./tables-manager";

export default async function TablesPage() {
  const tables = await getTables();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">إدارة الطاولات والصالة (Table Management)</h1>
          <p className="text-sm text-slate-500 mt-1">
            متابعة حالة وتوزيع الطاولات: 6 باكيات عائلات، 8 طاولات VIP، 12 طاولة عادية، وطاولات الإدارة والمالك.
          </p>
        </div>
      </div>

      <TablesManager initialTables={tables} />
    </div>
  );
}
