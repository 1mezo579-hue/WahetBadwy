"use server";
import { getSystemLockState } from "@/lib/system-lock";

import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus, TableType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface CartItemInput {
  menuItemId: string;
  nameAr: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface OrderPayload {
  orderId?: string;
  tableId?: string;
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "CUSTOMER_GRILL" | string;
  orderKind?: "NORMAL" | "CUSTOMER_GRILL";
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  items: CartItemInput[];
  notes?: string;
  customerMeatWeight?: number;
  cookedWeight?: number;
  grillingFee?: number;
  meatType?: string;
  pricingMode?: "PER_KG" | "PER_PIECE" | "FIXED" | string;
  expectedPickupTime?: string;
  receivedBy?: string;
  deliveredBy?: string;
  workflowStatus?: string;
}

// 1. Get POS Initial Data (Tables with their active open order, Categories, MenuItems, and Customers)
export async function getPosData() {
  try {
    const [tables, categories, menuItems, customers] = await Promise.all([
      prisma.diningTable.findMany({
        orderBy: [{ type: "asc" }, { number: "asc" }, { name: "asc" }],
        include: {
          orders: {
            where: { status: OrderStatus.OPEN },
            include: {
              items: {
                include: {
                  menuItem: true,
                },
              },
            },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.category.findMany({
        orderBy: { order: "asc" },
      }),
      prisma.menuItem.findMany({
        where: { active: true },
        orderBy: { nameAr: "asc" },
      }),
      prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return { tables, categories, menuItems, customers };
  } catch (error) {
    console.error("Error fetching POS data:", error);
    return { tables: [], categories: [], menuItems: [], customers: [] };
  }
}

// Helper to deduct raw materials based on recipes when an order is placed
// Helper to ensure any ordered item exists in database without foreign key failure
async function ensureMenuItemsExist(items: CartItemInput[]) {
  try {
    const defaultCategory = await prisma.category.findFirst({
      orderBy: { order: "asc" },
    });
    const defaultCatId = defaultCategory?.id;

    for (const item of items) {
      if (!item.menuItemId) continue;
      const existing = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
      });
      if (!existing) {
        const byName = await prisma.menuItem.findFirst({
          where: { nameAr: item.nameAr },
        });
        if (byName) {
          item.menuItemId = byName.id;
        } else if (defaultCatId) {
          const created = await prisma.menuItem.create({
            data: {
              id: item.menuItemId,
              name: item.nameAr,
              nameAr: item.nameAr,
              price: item.price,
              categoryId: defaultCatId,
              active: true,
            },
          });
          item.menuItemId = created.id;
        }
      }
    }
  } catch (e) {
    console.warn("ensureMenuItemsExist note:", e);
  }
}

async function deductInventoryForItems(items: CartItemInput[]) {
  try {
    const itemIds = items.map((i) => i.menuItemId);
    const menuItemsWithRecipes = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        recipeItems: true,
      },
    });

    for (const orderItem of items) {
      const foundItem = menuItemsWithRecipes.find(
        (m) => m.id === orderItem.menuItemId
      );
      if (foundItem && foundItem.recipeItems.length > 0) {
        for (const recipe of foundItem.recipeItems) {
          const deduction = recipe.quantity * orderItem.quantity;
          await prisma.rawMaterial.update({
            where: { id: recipe.rawMaterialId },
            data: {
              currentStock: {
                decrement: deduction,
              },
            },
          });
        }
      }
    }
  } catch (err) {
    console.error("Inventory deduction error:", err);
  }
}

// Helper to resolve virtual table for Delivery / Takeaway if none provided
async function resolveTableId(tableId?: string, orderType?: string) {
  if (tableId && tableId !== "DIRECT_TAKEAWAY" && tableId !== "NONE" && tableId !== "FAST_TAKEAWAY") return tableId;
  if (orderType === "DELIVERY") {
    const deliveryTable = await prisma.diningTable.findFirst({
      where: { name: { contains: "دليفري" } },
    });
    return deliveryTable?.id || null;
  }
  if (orderType === "TAKEAWAY") {
    const fastTakeawayTable = await prisma.diningTable.findFirst({
      where: { name: { contains: "مباشر" } },
    });
    if (fastTakeawayTable) return fastTakeawayTable.id;
    const takeawayTable = await prisma.diningTable.findFirst({
      where: { name: { contains: "تيك أواي" } },
    });
    return takeawayTable?.id || null;
  }
  return null;
}

// 2. Action A: Send to Prep (حفظ وطباعة الأوردر -> Saves order as OPEN)
export async function sendOrderToPrep(payload: OrderPayload) {
  try {
    const lockState = await getSystemLockState();
    if (lockState.isLocked) {
      return {
        error: "النظام مقفول حالياً بواسطة الإدارة (" + (lockState.lockedBy || "المدير") + "). يرجى التواصل مع الإدارة لإعادة فتح النظام.",
      };
    }

    const {
      orderId,
      items,
      notes,
      orderType = "DINE_IN",
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryFee = 0,
    } = payload;

    if (!items || items.length === 0) {
      return { error: "يرجى إضافة أصناف للطلب" };
    }

    await ensureMenuItemsExist(items);

    const resolvedTableId = await resolveTableId(payload.tableId, orderType);

    let table = null;
    if (resolvedTableId) {
      table = await prisma.diningTable.findUnique({
        where: { id: resolvedTableId },
      });
    }

    // Find active shift to link to order
    const activeShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
      orderBy: { startTime: "desc" },
    });

    // SPECIAL LOGIC: Orders on Owner or Manager table are flagged as 'Complimentary' (ضيافة)
    const isComplimentary =
      table?.type === TableType.OWNER || table?.type === TableType.MANAGER;

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const finalDeliveryFee = orderType === "DELIVERY" ? (Number(deliveryFee) || 0) : 0;
    const discount = isComplimentary ? (subtotal + finalDeliveryFee) : 0;
    const totalAmount = isComplimentary ? 0 : (subtotal + finalDeliveryFee);

    let order;

    if (orderId) {
      // Update existing OPEN order: delete old items and rewrite new items
      await prisma.orderItem.deleteMany({
        where: { orderId },
      });

      order = await prisma.order.update({
        where: { id: orderId },
        data: {
          subtotal,
          discount,
          totalAmount,
          isComplimentary,
          orderType: orderType as any,
          customerId: customerId || null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: finalDeliveryFee,
          notes,
          shiftId: activeShift?.id || null,
          status: OrderStatus.OPEN,
          items: {
            create: items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: i.price,
              totalPrice: i.price * i.quantity,
              notes: i.notes || null,
            })),
          },
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          customer: true,
        },
      });
    } else {
      // Create new OPEN order
      order = await prisma.order.create({
        data: {
          tableId: resolvedTableId,
          subtotal,
          discount,
          totalAmount,
          isComplimentary,
          orderType: orderType as any,
          customerId: customerId || null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: finalDeliveryFee,
          shiftId: activeShift?.id || null,
          status: OrderStatus.OPEN,
          notes,
          items: {
            create: items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: i.price,
              totalPrice: i.price * i.quantity,
              notes: i.notes || null,
            })),
          },
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          customer: true,
        },
      });

      // SPRINT 5 REQUIREMENT 4: Deduct RawMaterial stock based on recipes
      await deductInventoryForItems(items);
    }

    // Update table status to OCCUPIED if it's a real dining table (not delivery/takeaway)
    if (resolvedTableId && table && table.number && table.number < 900) {
      await prisma.diningTable.update({
        where: { id: resolvedTableId },
        data: { status: TableStatus.OCCUPIED },
      });
    }

    revalidatePath("/pos");
    revalidatePath("/dashboard/tables");
    revalidatePath("/dashboard/procurement");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard");

    return {
      success: true,
      order,
      message: isComplimentary
        ? "تم حفظ الطلب وإرساله للتحضير (ضيافة - Complimentary)"
        : orderType === "DELIVERY"
        ? `تم حفظ وتوجيه طلب الدليفري للتحضير (رسوم التوصيل: ${finalDeliveryFee} ج.م)`
        : "تم حفظ الطلب وإرساله للتحضير والطباعة بنجاح",
    };
  } catch (error: any) {
    console.error("Error sending order to prep:", error);
    return { error: error.message || "فشل إرسال الطلب للتحضير" };
  }
}

// 3. Action B: Collect Payment (تحصيل -> Changes status to PAID)
export async function collectOrderPayment(payload: OrderPayload) {
  try {
    const lockState = await getSystemLockState();
    if (lockState.isLocked) {
      return {
        error: "النظام مقفول حالياً بواسطة الإدارة (" + (lockState.lockedBy || "المدير") + "). يرجى التواصل مع الإدارة لإعادة فتح النظام.",
      };
    }

    const {
      orderId,
      items,
      notes,
      orderType = "DINE_IN",
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryFee = 0,
    } = payload;

    const resolvedTableId = await resolveTableId(payload.tableId, orderType);

    let table = null;
    if (resolvedTableId) {
      table = await prisma.diningTable.findUnique({
        where: { id: resolvedTableId },
      });
    }

    const isComplimentary =
      table?.type === TableType.OWNER || table?.type === TableType.MANAGER;

    // Find active shift to link order to shift
    const activeShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
      orderBy: { startTime: "desc" },
    });

    let targetOrderId = orderId;
    const finalDeliveryFee = orderType === "DELIVERY" ? (Number(deliveryFee) || 0) : 0;

    // If order was not sent to prep yet, save it directly as PAID
    if (!targetOrderId && items && items.length > 0) {
      await ensureMenuItemsExist(items);
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const discount = isComplimentary ? (subtotal + finalDeliveryFee) : 0;
      const totalAmount = isComplimentary ? 0 : (subtotal + finalDeliveryFee);

      const created = await prisma.order.create({
        data: {
          tableId: resolvedTableId,
          subtotal,
          discount,
          totalAmount,
          isComplimentary,
          orderType: orderType as any,
          customerId: customerId || null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: finalDeliveryFee,
          shiftId: activeShift?.id || null,
          status: OrderStatus.PAID,
          notes,
          items: {
            create: items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: i.price,
              totalPrice: i.price * i.quantity,
              notes: i.notes || null,
            })),
          },
        },
      });
      targetOrderId = created.id;

      // SPRINT 5 REQUIREMENT 4: Deduct RawMaterial stock based on recipes
      await deductInventoryForItems(items);
    } else if (targetOrderId) {
      // Mark existing order as PAID and update delivery fee if provided
      await prisma.order.update({
        where: { id: targetOrderId },
        data: {
          status: OrderStatus.PAID,
          ...(finalDeliveryFee > 0 ? { deliveryFee: finalDeliveryFee } : {}),
          ...(activeShift?.id ? { shiftId: activeShift.id } : {}),
        },
      });
    } else {
      return { error: "لا يوجد طلب مفتوح للتحصيل" };
    }

    // Release table back to AVAILABLE if it's a dining table
    if (resolvedTableId && table && table.number && table.number < 900) {
      await prisma.diningTable.update({
        where: { id: resolvedTableId },
        data: { status: TableStatus.AVAILABLE },
      });
    }

    revalidatePath("/pos");
    revalidatePath("/dashboard/tables");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: isComplimentary
        ? "تم إغلاق طلب الضيافة بنجاح (المبلغ: 0 ج.م - ضيافة)"
        : orderType === "DELIVERY"
        ? `تم تحصيل طلب الدليفري بنجاح مع رسوم التوصيل (${finalDeliveryFee} ج.م)`
        : "تم تسجيل الدفع وتحصيل الحساب بنجاح وإخلاء الطاولة",
    };
  } catch (error: any) {
    console.error("Error collecting payment:", error);
    return { error: error.message || "فشل تسجيل الدفع" };
  }
}
