"use server";

import { prisma } from "@/lib/prisma";
import { AttendanceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  nationalId?: string | null;
  hourlyRate?: number | null;
  monthlySalary?: number | null;
  active: boolean;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  attendances?: any[];
  activeAttendance?: any;
}

// 1. Get all staff members with their current attendance status
export async function getStaffList() {
  try {
    const staff = await prisma.staff.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        attendances: {
          orderBy: { checkIn: "desc" },
          take: 5,
        },
      },
    });

    // Attach activeAttendance (currently checked in)
    return staff.map((s) => {
      const activeAttendance = s.attendances.find(
        (a) => a.status === AttendanceStatus.PRESENT && !a.checkOut
      );
      return {
        ...s,
        activeAttendance: activeAttendance || null,
      };
    });
  } catch (error) {
    console.error("Error fetching staff list:", error);
    return [];
  }
}

// 2. Add new staff member
export async function createStaff(formData: FormData) {
  try {
    const name = (formData.get("name") as string)?.trim();
    const role = (formData.get("role") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim() || null;
    const nationalId = (formData.get("nationalId") as string)?.trim() || null;
    const hourlyRateStr = formData.get("hourlyRate") as string;
    const monthlySalaryStr = formData.get("monthlySalary") as string;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!name || !role) {
      return { error: "يرجى إدخال اسم الموظف والمسمى الوظيفي" };
    }

    await prisma.staff.create({
      data: {
        name,
        role,
        phone,
        nationalId,
        hourlyRate: hourlyRateStr ? parseFloat(hourlyRateStr) : 0,
        monthlySalary: monthlySalaryStr ? parseFloat(monthlySalaryStr) : 0,
        active: true,
        notes,
      },
    });

    revalidatePath("/dashboard/staff");
    return { success: true, message: `تمت إضافة الموظف ${name} بنجاح` };
  } catch (error: any) {
    console.error("Error creating staff:", error);
    return { error: error.message || "فشلت إضافة الموظف" };
  }
}

// 3. Update staff member
export async function updateStaff(formData: FormData) {
  try {
    const id = formData.get("id") as string;
    const name = (formData.get("name") as string)?.trim();
    const role = (formData.get("role") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim() || null;
    const nationalId = (formData.get("nationalId") as string)?.trim() || null;
    const hourlyRateStr = formData.get("hourlyRate") as string;
    const monthlySalaryStr = formData.get("monthlySalary") as string;
    const activeStr = formData.get("active") as string;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!id || !name || !role) {
      return { error: "بيانات الموظف غير مكتملة" };
    }

    await prisma.staff.update({
      where: { id },
      data: {
        name,
        role,
        phone,
        nationalId,
        hourlyRate: hourlyRateStr ? parseFloat(hourlyRateStr) : 0,
        monthlySalary: monthlySalaryStr ? parseFloat(monthlySalaryStr) : 0,
        active: activeStr === "true" || activeStr === "on",
        notes,
      },
    });

    revalidatePath("/dashboard/staff");
    return { success: true, message: "تم تحديث بيانات الموظف بنجاح" };
  } catch (error: any) {
    console.error("Error updating staff:", error);
    return { error: error.message || "فشل تحديث بيانات الموظف" };
  }
}

// 4. Toggle staff status (نشط / معطل)
export async function toggleStaffStatus(id: string, active: boolean) {
  try {
    await prisma.staff.update({
      where: { id },
      data: { active },
    });
    revalidatePath("/dashboard/staff");
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling staff:", error);
    return { error: "فشل تغيير حالة الموظف" };
  }
}

// 5. Delete staff member
export async function deleteStaff(id: string) {
  try {
    await prisma.staff.delete({
      where: { id },
    });
    revalidatePath("/dashboard/staff");
    return { success: true, message: "تم حذف الموظف وسجلاته بنجاح" };
  } catch (error: any) {
    console.error("Error deleting staff:", error);
    return { error: "فشل حذف الموظف" };
  }
}

// 6. Record Check-In (تسجيل حضور لموظف في وردية محددة)
export async function recordCheckIn(
  staffId: string,
  shiftName: string,
  notes?: string
) {
  try {
    if (!staffId) return { error: "يرجى تحديد الموظف" };

    // Check if already clocked in without clocking out
    const existing = await prisma.staffAttendance.findFirst({
      where: {
        staffId,
        status: AttendanceStatus.PRESENT,
        checkOut: null,
      },
    });

    if (existing) {
      return { error: "هذا الموظف مسجل حضور بالفعل حالياً!" };
    }

    const attendance = await prisma.staffAttendance.create({
      data: {
        staffId,
        checkIn: new Date(),
        shiftName: shiftName || "وردية أساسية",
        status: AttendanceStatus.PRESENT,
        notes: notes || null,
      },
      include: {
        staff: true,
      },
    });

    revalidatePath("/dashboard/staff");
    return {
      success: true,
      message: `تم تسجيل حضور ${attendance.staff.name} في ${attendance.shiftName}`,
      attendance,
    };
  } catch (error: any) {
    console.error("Check-in error:", error);
    return { error: error.message || "فشل تسجيل الحضور" };
  }
}

// 7. Record Check-Out (تسجيل انصراف وحساب الساعات تلقائياً)
export async function recordCheckOut(attendanceId: string, notes?: string) {
  try {
    if (!attendanceId) return { error: "معرف الحضور غير موجود" };

    const record = await prisma.staffAttendance.findUnique({
      where: { id: attendanceId },
      include: { staff: true },
    });

    if (!record) return { error: "سجل الحضور غير موجود" };
    if (record.checkOut) return { error: "تم تسجيل انصراف هذا الموظف مسبقاً" };

    const checkOutTime = new Date();
    const diffMs = Math.max(0, checkOutTime.getTime() - record.checkIn.getTime());
    // Calculate hours worked with 2 decimal precision (e.g., 7.50 hrs)
    const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    await prisma.staffAttendance.update({
      where: { id: attendanceId },
      data: {
        checkOut: checkOutTime,
        hoursWorked,
        status: AttendanceStatus.COMPLETED,
        notes: notes ? (record.notes ? `${record.notes} | ${notes}` : notes) : record.notes,
      },
    });

    revalidatePath("/dashboard/staff");
    return {
      success: true,
      message: `تم تسجيل انصراف ${record.staff.name}. عدد ساعات العمل: ${hoursWorked} ساعة`,
      hoursWorked,
    };
  } catch (error: any) {
    console.error("Check-out error:", error);
    return { error: error.message || "فشل تسجيل الانصراف" };
  }
}

// 8. Get full attendance logs
export async function getAttendanceLogs(daysLimit: number = 30) {
  try {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysLimit);

    return await prisma.staffAttendance.findMany({
      where: {
        date: { gte: sinceDate },
      },
      include: {
        staff: true,
      },
      orderBy: { checkIn: "desc" },
      take: 100,
    });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return [];
  }
}
