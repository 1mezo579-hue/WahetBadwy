"use client";

import { useState, useTransition } from "react";
import {
  createStaff,
  updateStaff,
  deleteStaff,
  toggleStaffStatus,
  recordCheckIn,
  recordCheckOut,
  StaffMember,
} from "@/actions/staff";

interface StaffViewProps {
  initialStaff: StaffMember[];
  initialAttendanceLogs: any[];
}

export default function StaffView({
  initialStaff,
  initialAttendanceLogs,
}: StaffViewProps) {
  const [activeTab, setActiveTab] = useState<"ATTENDANCE" | "STAFF_LIST" | "LOGS">("ATTENDANCE");
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>(initialAttendanceLogs);
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [checkInModalStaff, setCheckInModalStaff] = useState<StaffMember | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>("وردية صباحية");
  const [customShift, setCustomShift] = useState<string>("");
  const [shiftNotes, setShiftNotes] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Metrics
  const activeStaffCount = staffList.filter((s) => s.active).length;
  const currentlyPresentCount = staffList.filter((s) => s.activeAttendance).length;
  const totalHoursCompleted = attendanceLogs.reduce(
    (sum, log) => sum + (log.hoursWorked || 0),
    0
  );

  const filteredStaff = staffList.filter((s) => {
    const matchRole = roleFilter === "ALL" || s.role === roleFilter;
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchRole && matchSearch;
  });

  const availableRoles = Array.from(new Set(staffList.map((s) => s.role)));

  // Handle Add Staff
  const handleAddStaffSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createStaff(formData);
      if (res.error) {
        alert(res.error);
      } else {
        setShowAddModal(false);
        form.reset();
        setFeedback(res.message || "تمت إضافة الموظف بنجاح");
        setTimeout(() => setFeedback(null), 4000);
        window.location.reload();
      }
    });
  };

  // Handle Edit Staff
  const handleEditStaffSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await updateStaff(formData);
      if (res.error) {
        alert(res.error);
      } else {
        setEditingStaff(null);
        setFeedback(res.message || "تم تحديث بيانات الموظف بنجاح");
        setTimeout(() => setFeedback(null), 4000);
        window.location.reload();
      }
    });
  };

  // Handle Delete Staff
  const handleDeleteStaff = (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف الموظف: ${name}؟ سيتم حذف سجلات حضوره أيضاً!`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteStaff(id);
      if (res.error) {
        alert(res.error);
      } else {
        setStaffList((prev) => prev.filter((s) => s.id !== id));
      }
    });
  };

  // Handle Toggle Active Status
  const handleToggleActive = (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleStaffStatus(id, !current);
      setStaffList((prev) =>
        prev.map((s) => (s.id === id ? { ...s, active: !current } : s))
      );
    });
  };

  // Handle Check-In Submission
  const handleConfirmCheckIn = () => {
    if (!checkInModalStaff) return;
    const finalShiftName = selectedShift === "CUSTOM" ? customShift : selectedShift;

    startTransition(async () => {
      const res = await recordCheckIn(
        checkInModalStaff.id,
        finalShiftName,
        shiftNotes
      );
      if (res.error) {
        alert(res.error);
      } else {
        setCheckInModalStaff(null);
        setShiftNotes("");
        setCustomShift("");
        setFeedback(res.message || "تم تسجيل الحضور بنجاح");
        setTimeout(() => setFeedback(null), 4000);
        window.location.reload();
      }
    });
  };

  // Handle Check-Out
  const handleCheckOut = (attendanceId: string, staffName: string) => {
    startTransition(async () => {
      const res = await recordCheckOut(attendanceId);
      if (res.error) {
        alert(res.error);
      } else {
        setFeedback(res.message || `تم تسجيل انصراف ${staffName}`);
        setTimeout(() => setFeedback(null), 5000);
        window.location.reload();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي طاقم العمل</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{activeStaffCount} موظف</p>
            <p className="text-[11px] text-slate-400 mt-0.5">موظف مسجل ونشط</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl font-bold border border-amber-200">
            👥
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">الحاضرين بالوردية الآن</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{currentlyPresentCount} حاضرين</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">مسجلين حضور حالياً</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl font-bold border border-emerald-200">
            ⏱️
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي ساعات العمل المسجلة</p>
            <p className="text-2xl font-black text-indigo-700 mt-1">{totalHoursCompleted.toFixed(1)} ساعة</p>
            <p className="text-[11px] text-slate-400 mt-0.5">ساعات منتهية ومحسوبة</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-xl font-bold border border-indigo-200">
            ⏳
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <span>✓</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Navigation Tabs Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab("ATTENDANCE")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "ATTENDANCE"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>⏱️</span>
            <span>تسجيل الحضور والانصراف</span>
          </button>

          <button
            onClick={() => setActiveTab("STAFF_LIST")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "STAFF_LIST"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>👥</span>
            <span>بيانات الموظفين ({staffList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("LOGS")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "LOGS"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>📊</span>
            <span>سجل الورديات والساعات ({attendanceLogs.length})</span>
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-900 hover:bg-primary-950 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
        >
          <span>+</span>
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {/* TAB 1: ATTENDANCE (Clock-In / Clock-Out) */}
      {activeTab === "ATTENDANCE" && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <p className="font-bold text-amber-900">سجل الحضور والانصراف المباشر لطاقم العمل</p>
              <p className="text-[11px] text-amber-800/80 mt-0.5">
                سجل حضور الموظف باختيار ورديته، وعند الانتهاء اضغط "تسجيل انصراف" ليتم احتساب عدد ساعات العمل بدقة وتوثيقها.
              </p>
            </div>
            <div className="text-[11px] font-mono font-bold bg-amber-100 px-3 py-1 rounded-lg border border-amber-300">
              {new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffList
              .filter((s) => s.active)
              .map((staff) => {
                const isPresent = Boolean(staff.activeAttendance);
                const att = staff.activeAttendance;

                return (
                  <div
                    key={staff.id}
                    className={`bg-white rounded-2xl p-4 border transition flex flex-col justify-between shadow-sm ${
                      isPresent
                        ? "border-emerald-300 ring-2 ring-emerald-100"
                        : "border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200">
                          {staff.role}
                        </span>
                        {isPresent ? (
                          <span className="text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>حاضر بالعمل</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
                            غير حاضر
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-slate-800">{staff.name}</h3>
                      {staff.phone && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">📞 {staff.phone}</p>
                      )}

                      {isPresent && att && (
                        <div className="mt-3 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-xs">
                          <div className="flex justify-between text-emerald-950 font-bold">
                            <span>الوردية:</span>
                            <span className="text-emerald-800">{att.shiftName}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>وقت الحضور:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {new Date(att.checkIn).toLocaleTimeString("ar-EG", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {att.notes && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">
                              ملاحظات: {att.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100">
                      {isPresent && att ? (
                        <button
                          disabled={isPending}
                          onClick={() => handleCheckOut(att.id, staff.name)}
                          className="w-full py-2.5 px-3 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition shadow flex items-center justify-center gap-1.5"
                        >
                          <span>🚪</span>
                          <span>تسجيل انصراف وحساب الساعات</span>
                        </button>
                      ) : (
                        <button
                          disabled={isPending}
                          onClick={() => setCheckInModalStaff(staff)}
                          className="w-full py-2.5 px-3 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition shadow flex items-center justify-center gap-1.5"
                        >
                          <span>⏱️</span>
                          <span>تسجيل حضور (بدء وردية)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 2: STAFF LIST DIRECTORY */}
      {activeTab === "STAFF_LIST" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو رقم الموبايل أو الوظيفة..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            >
              <option value="ALL">جميع الوظائف ({staffList.length})</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3.5 px-4">اسم الموظف</th>
                    <th className="py-3.5 px-4">المسمى الوظيفي</th>
                    <th className="py-3.5 px-4">رقم الموبايل</th>
                    <th className="py-3.5 px-4">الأجر / الراتب</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs">
                            {staff.name[0]}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm">{staff.name}</p>
                            {staff.nationalId && (
                              <p className="text-[10px] text-slate-400 font-mono">الرقم القومي: {staff.nationalId}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700 font-bold">
                          {staff.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {staff.phone || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        {staff.hourlyRate && staff.hourlyRate > 0 ? (
                          <span className="font-mono font-bold text-slate-900">
                            {staff.hourlyRate} ج.م / ساعة
                          </span>
                        ) : staff.monthlySalary && staff.monthlySalary > 0 ? (
                          <span className="font-mono font-bold text-slate-900">
                            {staff.monthlySalary} ج.م / شهر
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive(staff.id, staff.active)}
                          className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold transition ${
                            staff.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {staff.active ? "نشط" : "معطل"}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingStaff(staff)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="تعديل"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(staff.id, staff.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="حذف"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE & WORK HOURS LOGS */}
      {activeTab === "LOGS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-sm">سجل الورديات وساعات العمل السابقة</h3>
                <p className="text-[11px] text-slate-500">توثيق كامل لكل وردية وحساب عدد ساعات العمل الفعلي</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="py-3.5 px-4">الموظف</th>
                    <th className="py-3.5 px-4">الوردية المسجلة</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4">وقت الحضور</th>
                    <th className="py-3.5 px-4">وقت الانصراف</th>
                    <th className="py-3.5 px-4">ساعات العمل</th>
                    <th className="py-3.5 px-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {attendanceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        لا توجد سجلات حضور مسجلة بعد.
                      </td>
                    </tr>
                  ) : (
                    attendanceLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-black text-slate-900">{log.staff?.name}</p>
                          <p className="text-[10px] text-slate-400">{log.staff?.role}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold">
                            {log.shiftName || "وردية أساسية"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {new Date(log.date).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold">
                          {new Date(log.checkIn).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-rose-700 font-bold">
                          {log.checkOut
                            ? new Date(log.checkOut).toLocaleTimeString("ar-EG", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "قيد العمل..."}
                        </td>
                        <td className="py-3.5 px-4">
                          {log.hoursWorked ? (
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                              {log.hoursWorked} ساعة
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold text-[11px] animate-pulse">
                              مستمر بالعمل
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              log.status === "COMPLETED"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            }`}
                          >
                            {log.status === "COMPLETED" ? "تم الانصراف" : "حاضر الآن"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CLOCK-IN MODAL (اختيار الوردية وتسجيل الحضور) */}
      {checkInModalStaff && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏱️</span>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    تسجيل حضور: {checkInModalStaff.name}
                  </h3>
                  <p className="text-xs text-slate-500">{checkInModalStaff.role}</p>
                </div>
              </div>
              <button
                onClick={() => setCheckInModalStaff(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  حدد الوردية الحالية (في أنه وردية):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "وردية صباحية (صباحي)",
                    "وردية مسائية (مسائي)",
                    "وردية ليلية (سهر)",
                    "وردية إضافية (أوفر تايم)",
                  ].map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setSelectedShift(sh)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                        selectedShift === sh
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {sh}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  أو كتابة اسم وردية مخصصة:
                </label>
                <input
                  type="text"
                  value={customShift}
                  onChange={(e) => {
                    setCustomShift(e.target.value);
                    if (e.target.value) setSelectedShift("CUSTOM");
                  }}
                  placeholder="مثال: وردية حفلات ومناسبات..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ملاحظات الحضور (اختياري):
                </label>
                <input
                  type="text"
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="مثال: استلم محطة الشواية / تبديل مع الزميل..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setCheckInModalStaff(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleConfirmCheckIn}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow"
                >
                  {isPending ? "جاري التسجيل..." : "تأكيد تسجيل الحضور"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-right">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <div>
                  <h3 className="font-black text-slate-800 text-base">تسجيل موظف جديد في الطاقم</h3>
                  <p className="text-xs text-slate-500">إضافة بيانات الموظف والوظيفة والراتب</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف بالكامل *</label>
                  <input
                    name="name"
                    required
                    placeholder="مثال: محمود عبد الرازق"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي *</label>
                  <input
                    name="role"
                    required
                    placeholder="مثال: شيف مشويات / كابتن صالة / باريستا"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الموبايل</label>
                  <input
                    name="phone"
                    placeholder="010xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرقم القومي (اختياري)</label>
                  <input
                    name="nationalId"
                    placeholder="14 رقم"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الأجر بالساعة (ج.م)</label>
                  <input
                    name="hourlyRate"
                    type="number"
                    step="any"
                    placeholder="مثال: 30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الراتب الشهري (ج.م)</label>
                  <input
                    name="monthlySalary"
                    type="number"
                    step="any"
                    placeholder="مثال: 5000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="ملاحظات حول أوقات التفرغ، السكن، أو رخصة القيادة للدليفري..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition shadow"
                >
                  {isPending ? "جاري الحفظ..." : "حفظ الموظف"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-right">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <div>
                  <h3 className="font-black text-slate-800 text-base">تعديل بيانات: {editingStaff.name}</h3>
                  <p className="text-xs text-slate-500">تحديث المسمى الوظيفي أو الراتب أو بيانات الاتصال</p>
                </div>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="space-y-4">
              <input type="hidden" name="id" value={editingStaff.id} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف *</label>
                  <input
                    name="name"
                    defaultValue={editingStaff.name}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي *</label>
                  <input
                    name="role"
                    defaultValue={editingStaff.role}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الموبايل</label>
                  <input
                    name="phone"
                    defaultValue={editingStaff.phone || ""}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرقم القومي</label>
                  <input
                    name="nationalId"
                    defaultValue={editingStaff.nationalId || ""}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الأجر بالساعة (ج.م)</label>
                  <input
                    name="hourlyRate"
                    type="number"
                    step="any"
                    defaultValue={editingStaff.hourlyRate || 0}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الراتب الشهري (ج.م)</label>
                  <input
                    name="monthlySalary"
                    type="number"
                    step="any"
                    defaultValue={editingStaff.monthlySalary || 0}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة الحساب</label>
                <select
                  name="active"
                  defaultValue={editingStaff.active ? "true" : "false"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
                >
                  <option value="true">🟢 موظف نشط بالعمل</option>
                  <option value="false">🔴 موظف موقوف / إجازة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingStaff.notes || ""}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition shadow"
                >
                  {isPending ? "جاري الحفظ..." : "تأكيد التعديل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
