import { getEquipment } from "@/actions/equipment";
import EquipmentManager from "./equipment-manager";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const equipment = await getEquipment();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">إدارة ومتابعة المعدات (Equipment Management)</h1>
        <p className="text-sm text-slate-500 mt-1">
          متابعة وتوثيق وصيانة شوايات الفحم، معدات المطبخ، تجهيزات الصالة والضيافة، ركن التحضير السريع، ومرافق النظافة لضمان كفاءة تشغيل مطعم مشويات بسيوني.
        </p>
      </div>

      <EquipmentManager initialEquipment={equipment} />
    </div>
  );
}
