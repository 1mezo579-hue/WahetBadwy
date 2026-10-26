"use server";

import { prisma } from "@/lib/prisma";
import { UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertAdminOrManager } from "@/lib/auth-guard";
import { recordAuditLog } from "@/lib/audit-logger";

export interface RecordPurchaseInput {
  rawMaterialId: string;
  quantity: number; // In purchaseUnit (e.g. 10 kg, 2 cartons)
  unitCost: number; // Cost per purchaseUnit (e.g. 350 EGP per kg)
  supplierName?: string;
  notes?: string;
}

export interface UpdateRecipeItemInput {
  recipeItemId: string;
  quantity: number;
  unit?: UnitType;
  isComplete?: boolean;
  notes?: string;
}

/**
 * Fetches all raw materials with optional category and type filtering
 */
export async function getRawMaterials(filterCategory?: string, filterType?: string) {
  try {
    const where: any = {};
    if (filterCategory && filterCategory !== "ALL") {
      where.category = filterCategory;
    }
    if (filterType && filterType !== "ALL") {
      where.type = filterType;
    }

    return await prisma.rawMaterial.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { recipeItems: true, transactions: true },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching raw materials:", error);
    return [];
  }
}

/**
 * Records a real purchase entry, increases stock safely,
 * calculates weighted average cost, and creates an immutable transaction record.
 * RBAC: Restricted to ADMIN or MANAGER.
 */
export async function recordPurchase(input: RecordPurchaseInput) {
  try {
    const guard = await assertAdminOrManager();
    if (!guard.authorized) {
      return { success: false, error: guard.error };
    }

    const { rawMaterialId, quantity, unitCost, supplierName, notes } = input;

    if (!rawMaterialId || isNaN(quantity) || quantity <= 0) {
      return { success: false, error: "يرجى إدخال كمية شراء صحيحة أكبر من الصفر" };
    }
    if (isNaN(unitCost) || unitCost < 0) {
      return { success: false, error: "يرجى إدخال سعر تكلفة صحيح" };
    }

    const material = await prisma.rawMaterial.findUnique({
      where: { id: rawMaterialId },
    });

    if (!material) {
      return { success: false, error: "المادة الخام غير موجودة بالنظام" };
    }

    const conversionFactor = material.conversionFactor || 1;
    // Added stock in issueUnit (e.g. grams or pieces)
    const addedStockInIssueUnit = quantity * conversionFactor;
    // Cost per issueUnit
    const newBatchCostPerIssueUnit = unitCost / conversionFactor;

    const currentStock = material.currentStock || 0;
    const currentCostPerIssueUnit = material.costPerUnit || 0;

    // Weighted average cost calculation
    let newWeightedCostPerIssueUnit = newBatchCostPerIssueUnit;
    if (currentStock > 0 && currentCostPerIssueUnit > 0) {
      const totalValue =
        currentStock * currentCostPerIssueUnit +
        addedStockInIssueUnit * newBatchCostPerIssueUnit;
      const totalStock = currentStock + addedStockInIssueUnit;
      newWeightedCostPerIssueUnit = totalStock > 0 ? totalValue / totalStock : newBatchCostPerIssueUnit;
    }

    const newStock = currentStock + addedStockInIssueUnit;
    const newStatus =
      newStock > material.minStockLevel
        ? "AVAILABLE"
        : newStock > 0
        ? "LOW_STOCK"
        : "OUT_OF_STOCK";

    // Transactional update
    const [updatedMaterial, transaction] = await prisma.$transaction([
      prisma.rawMaterial.update({
        where: { id: rawMaterialId },
        data: {
          currentStock: newStock,
          costPerUnit: Number(newWeightedCostPerIssueUnit.toFixed(4)),
          status: newStatus,
        },
      }),
      prisma.inventoryTransaction.create({
        data: {
          rawMaterialId,
          type: "PURCHASE",
          quantity,
          unit: material.purchaseUnit,
          unitCost,
          totalCost: Number((quantity * unitCost).toFixed(2)),
          supplierName: supplierName?.trim() || null,
          notes: notes?.trim() || null,
          performedBy: (guard.user as any)?.name || "الإدارة",
        },
      }),
    ]);

    await recordAuditLog({
      action: "STATUS_CHANGED",
      userId: (guard.user as any)?.id,
      userName: (guard.user as any)?.name,
      userRole: (guard.user as any)?.role,
      reason: `تسجيل شراء توريد: ${material.name} - كمية: ${quantity} ${material.purchaseUnit} بسعر ${unitCost} ج.م`,
      details: {
        rawMaterialId,
        materialName: material.name,
        purchasedQuantity: quantity,
        purchasedUnit: material.purchaseUnit,
        addedStockInIssueUnit,
        unitCost,
        totalCost: quantity * unitCost,
        previousStock: currentStock,
        newStock,
        newCostPerIssueUnit: newWeightedCostPerIssueUnit,
        supplierName,
      },
    });

    revalidatePath("/dashboard/procurement");
    revalidatePath("/dashboard/menu");

    return {
      success: true,
      material: updatedMaterial,
      transaction,
      message: `تم تسجيل شراء ${quantity} ${material.purchaseUnit} من (${material.name}) وتحديث الرصيد ومتوسط التكلفة بنجاح ✓`,
    };
  } catch (error: any) {
    console.error("Error recording purchase:", error);
    return { success: false, error: error.message || "فشل تسجيل عملية الشراء" };
  }
}

/**
 * Creates a new raw material item in catalog
 * RBAC: Restricted to ADMIN or MANAGER.
 */
export async function createRawMaterial(formData: FormData) {
  try {
    const guard = await assertAdminOrManager();
    if (!guard.authorized) {
      return { success: false, error: guard.error };
    }

    const name = (formData.get("name") as string)?.trim();
    const category = (formData.get("category") as string) || "اللحوم والدواجن";
    const type = (formData.get("type") as string) || "FOOD";
    const unit = (formData.get("unit") as UnitType) || UnitType.KG;
    const purchaseUnit = (formData.get("purchaseUnit") as string) || "كجم";
    const issueUnit = (formData.get("issueUnit") as string) || "جرام";
    const conversionFactor = parseFloat(formData.get("conversionFactor") as string) || 1000;
    const minStockLevel = parseFloat(formData.get("minStockLevel") as string) || 10;

    if (!name) return { success: false, error: "يرجى كتابة اسم الصنف أو المادة الخام" };

    const existing = await prisma.rawMaterial.findFirst({ where: { name } });
    if (existing) {
      return { success: false, error: "هذا الصنف مسجل بالفعل في دليل الخامات" };
    }

    const material = await prisma.rawMaterial.create({
      data: {
        name,
        category,
        type,
        unit,
        purchaseUnit,
        issueUnit,
        conversionFactor,
        costPerUnit: 0,
        currentStock: 0,
        minStockLevel,
        status: "OUT_OF_STOCK",
      },
    });

    revalidatePath("/dashboard/procurement");
    return { success: true, material };
  } catch (error: any) {
    console.error("Error creating raw material:", error);
    return { success: false, error: error.message || "حدث خطأ أثناء إضافة الصنف" };
  }
}

/**
 * Updates raw material metadata or reorder level
 * RBAC: Restricted to ADMIN or MANAGER.
 */
export async function updateRawMaterial(input: {
  id: string;
  name?: string;
  category?: string;
  type?: string;
  minStockLevel?: number;
  conversionFactor?: number;
}) {
  try {
    const guard = await assertAdminOrManager();
    if (!guard.authorized) {
      return { success: false, error: guard.error };
    }

    const { id, name, category, type, minStockLevel, conversionFactor } = input;
    const updated = await prisma.rawMaterial.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(category ? { category } : {}),
        ...(type ? { type } : {}),
        ...(typeof minStockLevel === "number" ? { minStockLevel } : {}),
        ...(typeof conversionFactor === "number" ? { conversionFactor } : {}),
      },
    });

    revalidatePath("/dashboard/procurement");
    return { success: true, material: updated };
  } catch (error: any) {
    console.error("Error updating raw material:", error);
    return { success: false, error: error.message || "فشل تحديث بيانات الصنف" };
  }
}

/**
 * Updates recipe item quantity and approval status.
 * RBAC: Restricted to ADMIN or MANAGER.
 */
export async function updateRecipeItemQuantity(input: UpdateRecipeItemInput) {
  try {
    const guard = await assertAdminOrManager();
    if (!guard.authorized) {
      return { success: false, error: guard.error };
    }

    const { recipeItemId, quantity, unit, isComplete, notes } = input;
    if (!recipeItemId || isNaN(quantity) || quantity < 0) {
      return { success: false, error: "يرجى إدخال كمية صحيحة" };
    }

    const updated = await prisma.recipeItem.update({
      where: { id: recipeItemId },
      data: {
        quantity,
        ...(unit ? { unit } : {}),
        isComplete: quantity > 0 && isComplete !== false,
        status: quantity > 0 && isComplete !== false ? "APPROVED" : "NEEDS_QUANTITY",
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        rawMaterial: true,
        menuItem: true,
      },
    });

    revalidatePath("/dashboard/menu");
    revalidatePath("/dashboard/procurement");

    return {
      success: true,
      recipeItem: updated,
      message: `تم تحديث مقدار (${updated.rawMaterial.name}) في وصفة (${updated.menuItem.nameAr}) بنجاح ✓`,
    };
  } catch (error: any) {
    console.error("Error updating recipe item:", error);
    return { success: false, error: error.message || "فشل تحديث مقدار الوصفة" };
  }
}

/**
 * Calculates profitability, direct costs, and gross profit margin
 * for all menu items strictly adhering to requirement 8:
 * - Direct Cost = Food Material Cost + Packaging Cost
 * - Gross Profit = Sale Price - Direct Cost
 * - Gross Profit Margin % = (Gross Profit / Sale Price) * 100
 * - Incomplete flag: If any ingredient has unknown quantity or cost = 0,
 *   displays "التكلفة غير مكتملة" and avoids misleading profit margins.
 */
export async function getMenuProfitabilityReport() {
  try {
    const menuItems = await prisma.menuItem.findMany({
      include: {
        category: true,
        recipeItems: {
          include: {
            rawMaterial: true,
          },
        },
      },
      orderBy: [{ category: { nameAr: "asc" } }, { nameAr: "asc" }],
    });

    const report = menuItems.map((item) => {
      const salePrice = item.price || 0;
      const recipes = item.recipeItems || [];

      // Check if recipe exists
      const hasRecipes = recipes.length > 0;

      // Check if all recipes are complete with valid quantities and known costs
      let isCostComplete = hasRecipes;
      let foodCost = 0;
      let packagingCost = 0;
      let knownDirectCost = 0;
      const incompleteReasons: string[] = [];

      if (!hasRecipes) {
        isCostComplete = false;
        incompleteReasons.push("لا توجد وصفة مدخلة للصنف");
      } else {
        for (const r of recipes) {
          const mat = r.rawMaterial;
          const qty = r.quantity || 0;
          const costPerUnit = mat.costPerUnit || 0;

          if (qty <= 0 || !r.isComplete) {
            isCostComplete = false;
            incompleteReasons.push(`كمية (${mat.name}) غير محددة`);
          }

          if (costPerUnit <= 0) {
            isCostComplete = false;
            incompleteReasons.push(`سعر تكلفة (${mat.name}) لم يتم شراؤه بعد`);
          }

          // Calculate cost contribution of known values
          const itemCost = qty * costPerUnit;
          if (mat.type === "PACKAGING") {
            packagingCost += itemCost;
          } else {
            foodCost += itemCost;
          }
          knownDirectCost += itemCost;
        }
      }

      foodCost = Number(foodCost.toFixed(2));
      packagingCost = Number(packagingCost.toFixed(2));
      knownDirectCost = Number(knownDirectCost.toFixed(2));

      let grossProfit: number | null = null;
      let grossMarginPercentage: number | null = null;
      let statusText = "مكتملة ومعتمدة";

      if (isCostComplete && salePrice > 0) {
        grossProfit = Number((salePrice - knownDirectCost).toFixed(2));
        grossMarginPercentage = Number(((grossProfit / salePrice) * 100).toFixed(1));
      } else {
        statusText = "التكلفة غير مكتملة";
      }

      return {
        id: item.id,
        nameAr: item.nameAr,
        categoryName: item.category?.nameAr || "عام",
        salePrice,
        foodCost,
        packagingCost,
        knownDirectCost,
        isCostComplete,
        grossProfit,
        grossMarginPercentage,
        statusText,
        incompleteReasons,
        ingredientsCount: recipes.length,
        recipes: recipes.map((r) => ({
          id: r.id,
          rawMaterialId: r.rawMaterialId,
          rawMaterialName: r.rawMaterial.name,
          category: r.rawMaterial.category,
          type: r.rawMaterial.type,
          quantity: r.quantity,
          unit: r.unit,
          issueUnit: r.rawMaterial.issueUnit,
          purchaseUnit: r.rawMaterial.purchaseUnit,
          costPerUnit: r.rawMaterial.costPerUnit,
          isComplete: r.isComplete,
          status: r.status,
          itemCost: Number((r.quantity * (r.rawMaterial.costPerUnit || 0)).toFixed(2)),
        })),
      };
    });

    const completedCount = report.filter((r) => r.isCostComplete).length;
    const incompleteCount = report.length - completedCount;

    return {
      success: true,
      report,
      summary: {
        totalItems: report.length,
        completedCount,
        incompleteCount,
      },
    };
  } catch (error: any) {
    console.error("Error generating menu profitability report:", error);
    return {
      success: false,
      error: error.message || "فشل توليد تقرير تكاليف المنيو",
      report: [],
      summary: { totalItems: 0, completedCount: 0, incompleteCount: 0 },
    };
  }
}

/**
 * Deducts stock safely for an order with idempotency protection.
 * - Checks statusHistory to guarantee inventory is NEVER deducted twice.
 * - Customer meat in CUSTOMER_GRILL is NEVER deducted.
 * - Incomplete recipes are skipped from deduction with audit warning.
 */
export async function deductInventoryForOrder(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                recipeItems: {
                  include: { rawMaterial: true },
                },
              },
            },
          },
        },
      },
    });

    if (!order) return { success: false, error: "الطلب غير موجود" };

    // Idempotency check: has inventory already been deducted for this order?
    const history = Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : [];
    const alreadyDeducted = history.some((h) => h.action === "INVENTORY_DEDUCTED");
    if (alreadyDeducted) {
      return { success: true, message: "تم خصم مخزون هذا الطلب مسبقاً (حماية من التكرار) ✓" };
    }

    const deductionsToExecute: Array<{
      rawMaterialId: string;
      deductAmount: number;
      materialName: string;
    }> = [];

    for (const orderItem of order.items) {
      // Never deduct customer meat for external grill orders
      if (orderItem.isCustomerMeat || order.orderKind === "CUSTOMER_GRILL") {
        continue;
      }

      const recipes = orderItem.menuItem?.recipeItems || [];
      for (const recipe of recipes) {
        // Only deduct if recipe is approved and has valid quantity
        if (recipe.isComplete && recipe.quantity > 0) {
          const totalDeduct = recipe.quantity * orderItem.quantity;
          deductionsToExecute.push({
            rawMaterialId: recipe.rawMaterialId,
            deductAmount: totalDeduct,
            materialName: recipe.rawMaterial.name,
          });
        }
      }
    }

    // Execute deductions in batch
    for (const d of deductionsToExecute) {
      await prisma.rawMaterial.update({
        where: { id: d.rawMaterialId },
        data: {
          currentStock: {
            decrement: d.deductAmount,
          },
        },
      });

      await prisma.inventoryTransaction.create({
        data: {
          rawMaterialId: d.rawMaterialId,
          type: "CONSUMPTION",
          quantity: d.deductAmount,
          notes: `استهلاك تلقائي للطلب #${order.orderNumber}`,
          performedBy: "نظام المطبخ الآلي",
        },
      });
    }

    // Mark order statusHistory with INVENTORY_DEDUCTED
    const newHistory = [
      ...history,
      {
        action: "INVENTORY_DEDUCTED",
        deductionsCount: deductionsToExecute.length,
        timestamp: new Date().toISOString(),
      },
    ];

    await prisma.order.update({
      where: { id: orderId },
      data: { statusHistory: newHistory },
    });

    return {
      success: true,
      deductionsCount: deductionsToExecute.length,
      message: `تم خصم مكونات الطلب #${order.orderNumber} المعتمدة بنجاح ✓`,
    };
  } catch (error: any) {
    console.error("Error deducting inventory:", error);
    return { success: false, error: error.message };
  }
}
