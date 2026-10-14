"use server";

import { prisma } from "@/lib/prisma";
import { EquipmentStatus } from "@prisma/client";
import { EquipmentType } from "@/types/equipment";
import { revalidatePath } from "next/cache";

async function ensureEquipmentTypeColumnIsText() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ALTER COLUMN "type" DROP DEFAULT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ALTER COLUMN "type" SET DEFAULT 'KITCHEN';`);
  } catch {
    // Already TEXT or default set
  }
}

export async function getEquipment(typeFilter?: EquipmentType | string) {
  try {
    await ensureEquipmentTypeColumnIsText();

    const items = await prisma.equipment.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return items as any[];
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return [];
  }
}

export async function createEquipment(formData: FormData) {
  try {
    await ensureEquipmentTypeColumnIsText();

    const name = formData.get("name") as string;
    const type = (formData.get("type") as string) || "KITCHEN";
    const location = formData.get("location") as string;
    const serialNumber = formData.get("serialNumber") as string;
    const status = (formData.get("status") as EquipmentStatus) || EquipmentStatus.OPERATIONAL;
    const notes = formData.get("notes") as string;

    if (!name) return { error: "يرجى إدخال اسم الجهاز أو المعدة" };

    await prisma.equipment.create({
      data: {
        name,
        type,
        status,
        location: location || null,
        serialNumber: serialNumber || null,
        notes: notes || null,
      },
    });

    revalidatePath("/dashboard/equipment");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating equipment:", error);
    return { error: error.message || "حدث خطأ أثناء إضافة المعدة" };
  }
}

export async function updateEquipment(
  id: string,
  data: {
    name?: string;
    type?: EquipmentType | string;
    status?: EquipmentStatus;
    location?: string | null;
    serialNumber?: string | null;
    notes?: string | null;
  }
) {
  try {
    await ensureEquipmentTypeColumnIsText();

    await prisma.equipment.update({
      where: { id },
      data,
    });
    revalidatePath("/dashboard/equipment");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating equipment:", error);
    return { error: error.message || "فشل تعديل بيانات المعدة" };
  }
}

export async function updateEquipmentStatus(id: string, status: EquipmentStatus) {
  try {
    await prisma.equipment.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/dashboard/equipment");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating equipment status:", error);
    return { error: "فشل تحديث حالة المعدة" };
  }
}

export async function deleteEquipment(id: string) {
  try {
    await prisma.equipment.delete({
      where: { id },
    });
    revalidatePath("/dashboard/equipment");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting equipment:", error);
    return { error: "فشل حذف المعدة" };
  }
}

export async function clearSectionEquipment(type: EquipmentType | string) {
  try {
    await ensureEquipmentTypeColumnIsText();
    const result = await prisma.equipment.deleteMany({
      where: { type },
    });
    revalidatePath("/dashboard/equipment");
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("Error clearing section equipment:", error);
    return { error: "فشل حذف معدات هذا القسم" };
  }
}

