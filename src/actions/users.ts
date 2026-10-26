"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertAdminOnly, assertAdminOrManager } from "@/lib/auth-guard";

export interface UserInput {
  name: string;
  username: string;
  password?: string;
  role: Role;
  active?: boolean;
}

export async function getUsers() {
  try {
    const auth = await assertAdminOrManager();
    if (!auth.authorized) {
      return { success: false, error: auth.error, users: [] };
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            shifts: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return { success: true, users };
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return { success: false, error: error.message || "فشل تحميل المستخدمين", users: [] };
  }
}

export async function createUser(data: UserInput) {
  try {
    const auth = await assertAdminOnly();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    if (!data.name || !data.username || !data.password) {
      return { success: false, error: "الاسم واسم الدخول وكلمة المرور مطلوبة" };
    }

    const existing = await prisma.user.findUnique({
      where: { username: data.username.trim().toLowerCase() },
    });

    if (existing) {
      return { success: false, error: "اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم آخر" };
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        username: data.username.trim().toLowerCase(),
        password: hashedPassword,
        role: data.role || Role.CASHIER,
        active: data.active !== undefined ? data.active : true,
      },
    });

    revalidatePath("/dashboard/users");
    return { success: true, message: `تم إنشاء حساب ${user.name} بنجاح` };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return { success: false, error: error.message || "فشل إنشاء المستخدم" };
  }
}

export async function updateUser(id: string, data: Partial<UserInput>) {
  try {
    const auth = await assertAdminOnly();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.role) updateData.role = data.role;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.password && data.password.trim().length > 0) {
      updateData.password = await bcrypt.hash(data.password.trim(), 12);
    }
    if (data.username) {
      const cleanUsername = data.username.trim().toLowerCase();
      const existing = await prisma.user.findFirst({
        where: { username: cleanUsername, NOT: { id } },
      });
      if (existing) {
        return { success: false, error: "اسم المستخدم مأخوذ من قِبل مستخدم آخر" };
      }
      updateData.username = cleanUsername;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/dashboard/users");
    return { success: true, message: `تم تحديث حساب ${user.name} بنجاح` };
  } catch (error: any) {
    console.error("Error updating user:", error);
    return { success: false, error: error.message || "فشل تحديث بيانات المستخدم" };
  }
}

export async function toggleUserStatus(id: string) {
  try {
    const auth = await assertAdminOnly();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return { success: false, error: "المستخدم غير موجود" };

    const updated = await prisma.user.update({
      where: { id },
      data: { active: !current.active },
    });

    revalidatePath("/dashboard/users");
    return {
      success: true,
      message: updated.active ? "تم تفعيل حساب المستخدم" : "تم تعطيل حساب المستخدم",
    };
  } catch (error: any) {
    console.error("Error toggling user status:", error);
    return { success: false, error: error.message || "فشل تغيير حالة الحساب" };
  }
}

export async function deleteUser(id: string) {
  try {
    const auth = await assertAdminOnly();
    if (!auth.authorized) {
      return { success: false, error: auth.error };
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.username === "admin") {
      return { success: false, error: "لا يمكن حذف حساب المدير الرئيسي (admin)" };
    }

    await prisma.user.delete({ where: { id } });
    revalidatePath("/dashboard/users");
    return { success: true, message: "تم حذف المستخدم بنجاح" };
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return { success: false, error: error.message || "فشل حذف المستخدم" };
  }
}
