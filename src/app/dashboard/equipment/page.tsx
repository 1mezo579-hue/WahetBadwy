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
          متابعة وتوثيق وصيانة معدات المطبخ، الباريستا، ركن الشيشة، تجهيزات الصالة، ومعدات دورات المياه لضمان استمرارية التشغيل.
        </p>
      </div>

      <EquipmentManager initialEquipment={equipment} />
    </div>
  );
}
