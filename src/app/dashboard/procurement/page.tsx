import { getRawMaterials } from "@/actions/procurement";
import ProcurementManager from "./procurement-manager";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const materials = await getRawMaterials();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">المشتريات والمواد الخام (Procurement & Raw Materials)</h1>
        <p className="text-sm text-slate-500 mt-1">
          إدارة أرصدة المخازن وتكاليف التوريد وتتبع مستويات الأمان للمواد الخام المستخدمة في وجبات ومشروبات المطعم.
        </p>
      </div>

      <ProcurementManager initialMaterials={materials} />
    </div>
  );
}
