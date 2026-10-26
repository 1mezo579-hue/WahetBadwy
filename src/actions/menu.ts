"use server";
import { getSystemLockState } from "@/lib/system-lock";
import { OFFICIAL_CATEGORIES, OFFICIAL_MENU_ITEMS } from "@/data/official-menu";
import { assertAdminOrManager } from "@/lib/auth-guard";

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
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

    const lockState = await getSystemLockState();
    if (lockState.isLocked) return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };

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
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating category:", error);
    return { error: error.message || "حدث خطأ أثناء إضافة التصنيف" };
  }
}

export async function updateCategory(formData: FormData) {
  try {
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

    const lockState = await getSystemLockState();
    if (lockState.isLocked) return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };

    const id = formData.get("id") as string;
    const nameAr = formData.get("nameAr") as string;
    const name = (formData.get("name") as string) || nameAr;
    const description = (formData.get("description") as string) || null;
    const orderStr = formData.get("order") as string;

    if (!id) return { error: "معرف القسم غير محدد" };
    if (!nameAr) return { error: "يرجى كتابة اسم القسم بالعربية" };

    await prisma.category.update({
      where: { id },
      data: {
        nameAr,
        name,
        description,
        order: orderStr ? parseInt(orderStr) : 0,
      },
    });

    revalidatePath("/dashboard/menu");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating category:", error);
    return { error: error.message || "فشل تعديل بيانات القسم" };
  }
}

export async function deleteCategory(id: string) {
  try {
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

    const lockState = await getSystemLockState();
    if (lockState.isLocked) return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };

    if (!id) return { error: "معرف القسم غير محدد" };

    // Check items in this category
    const items = await prisma.menuItem.findMany({
      where: { categoryId: id },
      select: { id: true, nameAr: true },
    });

    const itemIds = items.map((i) => i.id);

    if (itemIds.length > 0) {
      // Check if any items have associated order items
      const orderItemsCount = await prisma.orderItem.count({
        where: { menuItemId: { in: itemIds } },
      });

      if (orderItemsCount > 0) {
        // Items exist in order history: move to an archive category so financial logs aren't broken
        let fallbackCat = await prisma.category.findFirst({
          where: { name: "uncategorized" },
        });
        if (!fallbackCat) {
          fallbackCat = await prisma.category.create({
            data: {
              name: "uncategorized",
              nameAr: "أصناف أرشيفية",
              description: "أصناف من أقسام تم حذفها للحفاظ على سجلات الفواتير",
              order: 999,
            },
          });
        }
        await prisma.menuItem.updateMany({
          where: { categoryId: id },
          data: { categoryId: fallbackCat.id, active: false },
        });
        await prisma.category.delete({ where: { id } });
      } else {
        // Safe to remove recipes and items completely
        await prisma.recipeItem.deleteMany({
          where: { menuItemId: { in: itemIds } },
        });
        await prisma.menuItem.deleteMany({
          where: { categoryId: id },
        });
        await prisma.category.delete({ where: { id } });
      }
    } else {
      await prisma.category.delete({ where: { id } });
    }

    revalidatePath("/dashboard/menu");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting category:", error);
    return { error: error.message || "فشل حذف القسم" };
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
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

    const lockState = await getSystemLockState();
    if (lockState.isLocked) return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };

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
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

    const lockState = await getSystemLockState();
    if (lockState.isLocked) return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };

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
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

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
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

    const lockState = await getSystemLockState();
    if (lockState.isLocked) return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };

    // Check if item has order history
    const orderItemsCount = await prisma.orderItem.count({
      where: { menuItemId: id },
    });

    if (orderItemsCount > 0) {
      // Deactivate instead of hard delete to preserve financial reports integrity
      await prisma.menuItem.update({
        where: { id },
        data: { active: false },
      });
      revalidatePath("/dashboard/menu");
      revalidatePath("/pos");
      return {
        success: true,
        message: "الصنف مرتبط بفواتير سابقة، تم إيقافه وتعطيل ظهوره في الكاشير بنجاح للحفاظ على دقة الحسابات.",
      };
    }

    // Delete recipe associations first
    await prisma.recipeItem.deleteMany({
      where: { menuItemId: id },
    });

    await prisma.menuItem.delete({
      where: { id },
    });

    revalidatePath("/dashboard/menu");
    revalidatePath("/pos");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting menu item:", error);
    return { error: error.message || "فشل حذف الصنف" };
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
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

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
    const auth = await assertAdminOrManager();
    if (!auth.authorized) return { error: auth.error };

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


export async function importOfficialBasionyMenu() {
  try {
    const lockState = await getSystemLockState();
    if (lockState.isLocked) {
      return { error: `النظام مقفول حالياً بواسطة الإدارة (${lockState.lockedBy || "المدير"})` };
    }

    const catMap = new Map<string, string>();
    for (const c of OFFICIAL_CATEGORIES) {
      if (c.id === "ALL") continue;
      const catId = `cat_${c.id.toLowerCase()}`;
      const created = await prisma.category.upsert({
        where: { id: catId },
        update: { nameAr: c.nameAr, name: c.id },
        create: {
          id: catId,
          name: c.id,
          nameAr: c.nameAr,
          order: 0,
        },
      });
      catMap.set(c.id, created.id);
    }

    for (const item of OFFICIAL_MENU_ITEMS) {
      const dbCatId = catMap.get(item.categoryId) || Array.from(catMap.values())[0];
      await prisma.menuItem.upsert({
        where: { id: item.id },
        update: {
          nameAr: item.nameAr,
          name: item.nameAr,
          price: item.price,
          description: item.description || null,
          imageUrl: item.image || null,
          categoryId: dbCatId,
          active: true,
        },
        create: {
          id: item.id,
          nameAr: item.nameAr,
          name: item.nameAr,
          price: item.price,
          description: item.description || null,
          imageUrl: item.image || null,
          categoryId: dbCatId,
          active: true,
        },
      });
    }

    revalidatePath("/dashboard/menu");
    revalidatePath("/pos");
    return { success: true, count: OFFICIAL_MENU_ITEMS.length };
  } catch (err: any) {
    console.error("Error importing official menu:", err);
    return { error: err.message || "فشل استيراد قائمة الأصناف" };
  }
}
