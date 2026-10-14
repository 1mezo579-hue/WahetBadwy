"use server";

import { prisma } from "@/lib/prisma";
import { TableType, TableStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getTables(typeFilter?: TableType) {
  try {
    // Ensure all 6-seat tables (excluding family booths) are set to 4 seats
    await prisma.diningTable.updateMany({
      where: {
        capacity: 6,
        type: { not: TableType.FAMILY_BOOTH },
      },
      data: { capacity: 4 },
    });

    return await prisma.diningTable.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: [{ type: "asc" }, { number: "asc" }, { name: "asc" }],
    });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return [];
  }
}

export async function updateTable(
  id: string,
  data: {
    name?: string;
    number?: number | null;
    type?: TableType;
    capacity?: number;
    status?: TableStatus;
  }
) {
  try {
    await prisma.diningTable.update({
      where: { id },
      data,
    });
    revalidatePath("/dashboard/tables");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating table:", error);
    return { error: error.message || "فشل تعديل بيانات الطاولة" };
  }
}

export async function createTable(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const numberStr = formData.get("number") as string;
    const type = formData.get("type") as TableType;
    const capacityStr = formData.get("capacity") as string;

    if (!name) return { error: "يرجى كتابة اسم الطاولة" };

    await prisma.diningTable.create({
      data: {
        name,
        number: numberStr ? parseInt(numberStr) : null,
        type: type || TableType.REGULAR,
        status: TableStatus.AVAILABLE,
        capacity: capacityStr ? parseInt(capacityStr) : 4,
      },
    });

    revalidatePath("/dashboard/tables");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating table:", error);
    return { error: error.message || "حدث خطأ أثناء إضافة الطاولة" };
  }
}

export async function updateTableStatus(id: string, status: TableStatus) {
  try {
    await prisma.diningTable.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/dashboard/tables");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating table status:", error);
    return { error: "فشل تغيير حالة الطاولة" };
  }
}

export async function deleteTable(id: string) {
  try {
    await prisma.diningTable.delete({
      where: { id },
    });
    revalidatePath("/dashboard/tables");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting table:", error);
    return { error: "فشل حذف الطاولة" };
  }
}
