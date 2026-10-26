import { getRawMaterials, getMenuProfitabilityReport } from "@/actions/procurement";
import ProcurementManager from "./procurement-manager";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const [materials, profitabilityData] = await Promise.all([
    getRawMaterials(),
    getMenuProfitabilityReport(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            المخزون والمشتريات والوصفات (Inventory & Procurement)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            مشويات بسيوني — دليل الخامات والتغليف والنظافة، تسجيل المشتريات، واعتماد مقادير الوصفات وحساب هوامش الربح.
          </p>
        </div>
      </div>

      <ProcurementManager
        initialMaterials={materials as any}
        initialProfitability={profitabilityData?.report || []}
      />
    </div>
  );
}
