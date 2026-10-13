"use server";

import { prisma } from "@/lib/prisma";
import { UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getRawMaterials() {
  try {
    return await prisma.rawMaterial.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { recipeItems: true },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching raw materials:", error);
    return [];
  }
}

export async function createRawMaterial(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const unit = formData.get("unit") as UnitType;
    const costPerUnit = parseFloat(formData.get("costPerUnit") as string) || 0;
    const currentStock = parseFloat(formData.get("currentStock") as string) || 0;
    const minStockLevel = parseFloat(formData.get("minStockLevel") as string) || 10;

    if (!name) return { error: "يرجى كتابة اسم المادة الخام" };

    await prisma.rawMaterial.create({
      data: {
        name,
        unit: unit || UnitType.KG,
        costPerUnit,
        currentStock,
        minStockLevel,
      },
    });

    revalidatePath("/dashboard/procurement");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating raw material:", error);
    return { error: error.message || "حدث خطأ أثناء إضافة المادة الخام" };
  }
}

export async function updateStock(id: string, addedStock: number) {
  try {
    if (isNaN(addedStock) || addedStock <= 0) {
      return { error: "الكمية المضافة يجب أن تكون أكبر من صفر" };
    }

    await prisma.rawMaterial.update({
      where: { id },
      data: {
        currentStock: {
          increment: addedStock,
        },
      },
    });

    revalidatePath("/dashboard/procurement");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating stock:", error);
    return { error: "فشل تحديث رصيد المخزون" };
  }
}

export async function deleteRawMaterial(id: string) {
  try {
    await prisma.rawMaterial.delete({
      where: { id },
    });
    revalidatePath("/dashboard/procurement");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting raw material:", error);
    return { error: "فشل حذف المادة الخام، قد تكون مرتبطة بوصفات قائمة طعام" };
  }
}
