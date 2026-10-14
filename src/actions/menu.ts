"use server";

import { prisma } from "@/lib/prisma";
import { UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";

// --- Categories ---

export async function getCategories() {
  try {
    return await prisma.category.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export async function createCategory(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const nameAr = formData.get("nameAr") as string;
    const description = formData.get("description") as string;
    const orderStr = formData.get("order") as string;

    if (!nameAr) return { error: "يرجى كتابة الاسم بالعربية" };

    await prisma.category.create({
      data: {
        name: name || nameAr,
        nameAr,
        description: description || null,
        order: orderStr ? parseInt(orderStr) : 0,
      },
    });

    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating category:", error);
    return { error: error.message || "حدث خطأ أثناء إضافة التصنيف" };
  }
}

export async function deleteCategory(id: string) {
  try {
    await prisma.category.delete({
      where: { id },
    });
    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting category:", error);
    return { error: "فشل حذف التصنيف" };
  }
}

// --- Menu Items ---

export async function getMenuItems(categoryId?: string) {
  try {
    return await prisma.menuItem.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: {
        category: true,
        recipeItems: {
          include: {
            rawMaterial: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    return [];
  }
}

export async function createMenuItem(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const nameAr = formData.get("nameAr") as string;
    const description = formData.get("description") as string;
    const priceStr = formData.get("price") as string;
    const categoryId = formData.get("categoryId") as string;

    if (!nameAr || !priceStr || !categoryId) {
      return { error: "يرجى ملء الاسم العربي والسعر والتصنيف" };
    }

    await prisma.menuItem.create({
      data: {
        name: name || nameAr,
        nameAr,
        description: description || null,
        price: parseFloat(priceStr),
        categoryId,
        active: true,
      },
    });

    revalidatePath("/dashboard/menu");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating menu item:", error);
    return { error: error.message || "حدث خطأ أثناء إضافة الصنف" };
  }
}

export async function updateMenuItem(formData: FormData) {
  try {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const nameAr = formData.get("nameAr") as string;
    const description = formData.get("description") as string;
    const priceStr = formData.get("price") as string;
    const categoryId = formData.get("categoryId") as string;
    const activeVal = formData.get("active");

    if (!id || !nameAr || !priceStr || !categoryId) {
      return { error: "يرجى ملء الاسم العربي والسعر والتصنيف" };
    }

    await prisma.menuItem.update({
      where: { id },
      data: {
        name: name || nameAr,
        nameAr,
        description: description ? description.trim() : null,
        price: parseFloat(priceStr),
        categoryId,
        active: activeVal === "true" || activeVal === "on",
      },
    });

    revalidatePath("/dashboard/menu");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating menu item:", error);
    return { error: error.message || "حدث خطأ أثناء تعديل الصنف" };
  }
}

export async function toggleMenuItemStatus(id: string, active: boolean) {
  try {
    await prisma.menuItem.update({
      where: { id },
      data: { active },
    });
    revalidatePath("/dashboard/menu");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling menu item:", error);
    return { error: "فشل تحديث حالة الصنف" };
  }
}

export async function deleteMenuItem(id: string) {
  try {
    await prisma.menuItem.delete({
      where: { id },
    });
    revalidatePath("/dashboard/menu");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting menu item:", error);
    return { error: "فشل حذف الصنف" };
  }
}

// --- Recipe Builder ---

export async function addRecipeItem(
  menuItemId: string,
  rawMaterialId: string,
  quantity: number,
  unit: UnitType
) {
  try {
    if (!menuItemId || !rawMaterialId || quantity <= 0) {
      return { error: "يرجى تحديد الصنف والمادة الخام والكمية بشكل صحيح" };
    }

    await prisma.recipeItem.upsert({
      where: {
        menuItemId_rawMaterialId: {
          menuItemId,
          rawMaterialId,
        },
      },
      update: {
        quantity,
        unit,
      },
      create: {
        menuItemId,
        rawMaterialId,
        quantity,
        unit,
      },
    });

    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: any) {
    console.error("Error adding recipe item:", error);
    return { error: "فشل إضافة مكون الوصفة" };
  }
}

export async function removeRecipeItem(recipeItemId: string) {
  try {
    await prisma.recipeItem.delete({
      where: { id: recipeItemId },
    });
    revalidatePath("/dashboard/menu");
    return { success: true };
  } catch (error: any) {
    console.error("Error removing recipe item:", error);
    return { error: "فشل حذف مكون الوصفة" };
  }
}
