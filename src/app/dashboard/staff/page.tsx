import { getStaffList, getAttendanceLogs } from "@/actions/staff";
import StaffView from "./staff-view";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const [staff, logs] = await Promise.all([
    getStaffList(),
    getAttendanceLogs(30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">
          إدارة شؤون الموظفين والورديات (Staff & Shifts Attendance)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          تسجيل بيانات طاقم العمل، تسجيل الحضور والانصراف، وحساب ساعات العمل في كل وردية بدقة.
        </p>
      </div>

      <StaffView
        initialStaff={staff as any}
        initialAttendanceLogs={logs as any}
      />
    </div>
  );
}
