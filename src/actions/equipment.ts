"use server";

import { prisma } from "@/lib/prisma";
import { EquipmentType, EquipmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getEquipment(typeFilter?: EquipmentType) {
  try {
    return await prisma.equipment.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return [];
  }
}

export async function createEquipment(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const type = formData.get("type") as EquipmentType;
    const location = formData.get("location") as string;
    const serialNumber = formData.get("serialNumber") as string;
    const status = formData.get("status") as EquipmentStatus;
    const notes = formData.get("notes") as string;

    if (!name) return { error: "يرجى إدخال اسم الجهاز أو المعدة" };

    await prisma.equipment.create({
      data: {
        name,
        type: type || EquipmentType.KITCHEN,
        status: status || EquipmentStatus.OPERATIONAL,
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
