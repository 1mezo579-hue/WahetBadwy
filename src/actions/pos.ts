"use server";

import { getSystemLockState } from "@/lib/system-lock";
import { prisma } from "@/lib/prisma";
import { OrderStatus, TableStatus, TableType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit-logger";
import bcrypt from "bcryptjs";

export interface CartItemInput {
  menuItemId: string;
  nameAr: string;
  price: number;
  quantity: number;
  notes?: string;
  isCustomerMeat?: boolean;
  weightGrams?: number;
  rawWeightGrams?: number;
  pricePerKg?: number;
}

export interface OrderPayload {
  clientOrderId?: string;
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
  discount?: number;
  discountReason?: string;
  paymentMethod?: "CASH" | "CARD" | "WALLET" | string;
  amountPaid?: number;
  changeAmount?: number;
  cashierName?: string;
  userId?: string;
  userRole?: string;
  managerPin?: string;
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

// In-memory idempotency cache (stores responses for 2 minutes to prevent double clicks and network race conditions)
const idempotencyStore = new Map<string, { timestamp: number; result: any }>();

function getCachedIdempotentResult(clientOrderId?: string) {
  if (!clientOrderId) return null;
  const cached = idempotencyStore.get(clientOrderId);
  if (cached && Date.now() - cached.timestamp < 120000) {
    return cached.result;
  }
  return null;
}

function setCachedIdempotentResult(clientOrderId: string | undefined, result: any) {
  if (!clientOrderId) return;
  idempotencyStore.set(clientOrderId, { timestamp: Date.now(), result });
  if (idempotencyStore.size > 500) {
    const cutoff = Date.now() - 300000;
    idempotencyStore.forEach((v, k) => {
      if (v.timestamp < cutoff) idempotencyStore.delete(k);
    });
  }
}

// 1. Get POS Initial Data
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

// Helper to ensure any ordered item exists in database without foreign key failure
async function ensureMenuItemsExist(items: CartItemInput[]) {
  try {
    let defaultCategory = await prisma.category.findFirst({
      orderBy: { order: "asc" },
    });
    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({
        data: {
          name: "General",
          nameAr: "عام وخدمات",
          order: 0,
        },
      });
    }
    const defaultCatId = defaultCategory.id;

    for (const item of items) {
      if (!item.menuItemId && !item.nameAr) continue;

      let existing = null;
      if (item.menuItemId) {
        existing = await prisma.menuItem.findUnique({
          where: { id: item.menuItemId },
        });
      }

      if (!existing && item.nameAr) {
        existing = await prisma.menuItem.findFirst({
          where: { nameAr: item.nameAr },
        });
      }

      if (existing) {
        item.menuItemId = existing.id;
      } else {
        const created = await prisma.menuItem.create({
          data: {
            name: item.nameAr || "صنف خدمة",
            nameAr: item.nameAr || "صنف خدمة",
            price: Number(item.price) || 0,
            categoryId: defaultCatId,
            active: true,
          },
        });
        item.menuItemId = created.id;
      }
    }
  } catch (e) {
    console.error("ensureMenuItemsExist note:", e);
  }
}

// Deduct raw materials based on recipes when an order is placed
async function deductInventoryForItems(items: CartItemInput[]) {
  try {
    const itemIds = items.map((i) => i.menuItemId).filter(Boolean);
    const menuItemsWithRecipes = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        recipeItems: true,
      },
    });

    for (const orderItem of items) {
      // Do not deduct stock if it's the customer's own meat (شوي للغير)
      if ((orderItem as any).isCustomerMeat) {
        continue;
      }

      const foundItem = menuItemsWithRecipes.find(
        (m) => m.id === orderItem.menuItemId
      );
      if (foundItem && foundItem.recipeItems.length > 0) {
        for (const recipe of foundItem.recipeItems) {
          const deduction = recipe.quantity * (orderItem.quantity || 1);
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

// Server-side price, quantity, discount & financial verification
async function verifyOrderFinances({
  items,
  grillingFee = 0,
  deliveryFee = 0,
  orderType,
  isComplimentary = false,
  requestedDiscount = 0,
  userRole = "CASHIER",
}: {
  items: CartItemInput[];
  grillingFee?: number;
  deliveryFee?: number;
  orderType?: string;
  isComplimentary?: boolean;
  requestedDiscount?: number;
  userRole?: string;
}) {
  const itemIds = (items || []).map((i) => i.menuItemId).filter(Boolean);
  const dbMenuItems = await prisma.menuItem.findMany({
    where: { id: { in: itemIds } },
  });

  const verifiedItems = (items || []).map((clientItem) => {
    const dbItem = dbMenuItems.find((m) => m.id === clientItem.menuItemId);
    let verifiedUnitPrice = clientItem.price;

    if (dbItem) {
      if (clientItem.weightGrams && clientItem.weightGrams > 0) {
        // Sold by weight: price in DB is price per kg
        verifiedUnitPrice = Number(((dbItem.price * clientItem.weightGrams) / 1000).toFixed(2));
      } else {
        // Standard item: enforce authoritative DB menu price
        verifiedUnitPrice = dbItem.price;
      }
    }

    const qty = Math.max(1, clientItem.quantity || 1);
    const itemTotal = clientItem.isCustomerMeat ? 0 : verifiedUnitPrice * qty;

    return {
      ...clientItem,
      price: verifiedUnitPrice,
      quantity: qty,
      totalPrice: itemTotal,
    };
  });

  const verifiedGrillingFee = Math.max(0, Number(grillingFee) || 0);
  const itemsTotal = verifiedItems.reduce((s, i) => s + (i.isCustomerMeat ? 0 : i.totalPrice), 0);
  const verifiedSubtotal = verifiedGrillingFee + itemsTotal;
  const verifiedDeliveryFee = orderType === "DELIVERY" ? Math.max(0, Number(deliveryFee) || 0) : 0;

  // Validate discount: only owner/manager or authorized roles can grant discounts
  let verifiedDiscount = 0;
  if (isComplimentary) {
    verifiedDiscount = verifiedSubtotal + verifiedDeliveryFee;
  } else if (requestedDiscount > 0) {
    if (userRole === "ADMIN" || userRole === "MANAGER") {
      verifiedDiscount = Math.min(verifiedSubtotal, requestedDiscount);
    } else {
      console.warn("Cashier discount capped without manager approval");
      verifiedDiscount = 0;
    }
  }

  const verifiedTotalAmount = isComplimentary
    ? 0
    : Math.max(0, verifiedSubtotal + verifiedDeliveryFee - verifiedDiscount);

  return {
    verifiedItems,
    verifiedSubtotal,
    verifiedDeliveryFee,
    verifiedDiscount,
    verifiedTotalAmount,
  };
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

// 2. Action A: Send to Prep (حفظ وطباعة الأوردر للمطبخ)
export async function sendOrderToPrep(payload: OrderPayload) {
  try {
    const lockState = await getSystemLockState();
    if (lockState.isLocked) {
      return {
        error: "النظام مقفول حالياً بواسطة الإدارة (" + (lockState.lockedBy || "المدير") + "). يرجى التواصل مع الإدارة لإعادة فتح النظام.",
      };
    }

    // Check Idempotency Token
    const cachedResult = getCachedIdempotentResult(payload.clientOrderId);
    if (cachedResult) {
      return cachedResult;
    }

    const {
      orderId,
      items = [],
      notes,
      orderType = "DINE_IN",
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryFee = 0,
      clientOrderId,
      userRole = "CASHIER",
    } = payload;

    const isGrillOrder =
      payload.orderKind === "CUSTOMER_GRILL" ||
      (payload.grillingFee !== undefined && Number(payload.grillingFee) > 0);

    if (!isGrillOrder && (!items || items.length === 0)) {
      return { error: "يرجى إضافة أصناف للطلب" };
    }

    if (items && items.length > 0) {
      await ensureMenuItemsExist(items);
    }

    const resolvedTableId = await resolveTableId(payload.tableId, orderType);
    let table = null;
    if (resolvedTableId) {
      table = await prisma.diningTable.findUnique({
        where: { id: resolvedTableId },
      });
    }

    const activeShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
      orderBy: { startTime: "desc" },
    });

    const isComplimentary =
      table?.type === TableType.OWNER || table?.type === TableType.MANAGER;

    // Server-side financial verification
    const {
      verifiedItems,
      verifiedSubtotal,
      verifiedDeliveryFee,
      verifiedDiscount,
      verifiedTotalAmount,
    } = await verifyOrderFinances({
      items,
      grillingFee: payload.grillingFee,
      deliveryFee,
      orderType,
      isComplimentary,
      requestedDiscount: payload.discount,
      userRole,
    });

    let order;
    const auditNotes = clientOrderId ? `[ClientToken: ${clientOrderId}] ${notes || ""}` : (notes || null);

    if (orderId) {
      // Update existing OPEN order
      await prisma.orderItem.deleteMany({
        where: { orderId },
      });

      order = await prisma.order.update({
        where: { id: orderId },
        data: {
          subtotal: verifiedSubtotal,
          discount: verifiedDiscount,
          totalAmount: verifiedTotalAmount,
          isComplimentary,
          orderType: orderType as any,
          ...(payload.orderKind ? { orderKind: payload.orderKind } : {}),
          ...(payload.customerMeatWeight !== undefined ? { customerMeatWeight: payload.customerMeatWeight } : {}),
          ...(payload.cookedWeight !== undefined ? { cookedWeight: payload.cookedWeight } : {}),
          ...(payload.grillingFee !== undefined ? { grillingFee: payload.grillingFee } : {}),
          ...(payload.meatType ? { meatType: payload.meatType } : {}),
          ...(payload.pricingMode ? { pricingMode: payload.pricingMode } : {}),
          ...(payload.expectedPickupTime ? { expectedPickupTime: payload.expectedPickupTime } : {}),
          ...(payload.workflowStatus ? { workflowStatus: payload.workflowStatus } : {}),
          customerId: customerId || null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: verifiedDeliveryFee,
          notes: auditNotes,
          shiftId: activeShift?.id || null,
          status: OrderStatus.OPEN,
          items: {
            create: verifiedItems.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: i.price,
              totalPrice: i.totalPrice,
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
      // Check if duplicate clientOrderId was already saved in DB
      if (clientOrderId) {
        const existingByClientToken = await prisma.order.findFirst({
          where: { notes: { contains: clientOrderId } },
          include: {
            items: { include: { menuItem: true } },
            table: true,
            customer: true,
          },
        });
        if (existingByClientToken) {
          const res = { success: true, order: existingByClientToken, message: "تم تسجيل الطلب بالفعل مسبقاً ✓" };
          setCachedIdempotentResult(clientOrderId, res);
          return res;
        }
      }

      // Create new OPEN order
      order = await prisma.order.create({
        data: {
          tableId: resolvedTableId,
          subtotal: verifiedSubtotal,
          discount: verifiedDiscount,
          totalAmount: verifiedTotalAmount,
          isComplimentary,
          orderType: orderType as any,
          orderKind: payload.orderKind || (isGrillOrder ? "CUSTOMER_GRILL" : "NORMAL"),
          customerMeatWeight: payload.customerMeatWeight || null,
          cookedWeight: payload.cookedWeight || null,
          grillingFee: isGrillOrder ? (Number(payload.grillingFee) || 0) : null,
          meatType: payload.meatType || null,
          pricingMode: payload.pricingMode || "PER_KG",
          expectedPickupTime: payload.expectedPickupTime || null,
          receivedBy: payload.receivedBy || payload.cashierName || null,
          deliveredBy: payload.deliveredBy || null,
          workflowStatus: payload.workflowStatus || (isGrillOrder ? "RECEIVED_CUSTOMER_MEAT" : "NEW"),
          statusHistory: [
            {
              from: "INIT",
              to: payload.workflowStatus || (isGrillOrder ? "RECEIVED_CUSTOMER_MEAT" : "NEW"),
              user: payload.receivedBy || payload.cashierName || "الكاشير",
              timestamp: new Date().toISOString(),
              note: isGrillOrder ? "استلام خامات العميل وتوجيه للشواية" : "حفظ الطلب وإرساله للمطبخ",
            },
          ],
          customerId: customerId || null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: verifiedDeliveryFee,
          shiftId: activeShift?.id || null,
          status: OrderStatus.OPEN,
          notes: auditNotes,
          items: {
            create: verifiedItems.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: i.price,
              totalPrice: i.totalPrice,
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

      if (verifiedItems && verifiedItems.length > 0) {
        await deductInventoryForItems(verifiedItems);
      }
    }

    if (resolvedTableId && table && table.number && table.number < 900) {
      await prisma.diningTable.update({
        where: { id: resolvedTableId },
        data: { status: TableStatus.OCCUPIED },
      });
    }

    // Record Audit Log
    await recordAuditLog({
      action: "ORDER_CREATED",
      orderId: order.id,
      userId: payload.userId,
      userName: payload.cashierName || payload.receivedBy,
      userRole: payload.userRole,
      details: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        orderType: order.orderType,
        itemsCount: verifiedItems.length,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/tables");
    revalidatePath("/dashboard");

    const result = {
      success: true,
      order,
      message: isComplimentary
        ? "تم حفظ الطلب وإرساله للتحضير (ضيافة - Complimentary)"
        : orderType === "DELIVERY"
        ? `تم حفظ وتوجيه طلب الدليفري للتحضير (رسوم التوصيل: ${verifiedDeliveryFee} ج.م)`
        : isGrillOrder
        ? "تم تسجيل واستلام طلب الشوي وإرسال بون التشغيل للشواية بنجاح"
        : "تم حفظ الطلب وإرساله للتحضير والطباعة بنجاح ✓",
    };

    setCachedIdempotentResult(payload.clientOrderId, result);
    return result;
  } catch (error: any) {
    console.error("Error sending order to prep:", error);
    return { error: error.message || "فشل إرسال الطلب للتحضير" };
  }
}

// 3. Action B: Collect Payment (تحصيل وسداد الفاتورة مع ضمان منع التكرار والتدقيق)
export async function collectOrderPayment(payload: OrderPayload) {
  try {
    const lockState = await getSystemLockState();
    if (lockState.isLocked) {
      return {
        error: "النظام مقفول حالياً بواسطة الإدارة (" + (lockState.lockedBy || "المدير") + "). يرجى التواصل مع الإدارة لإعادة فتح النظام.",
      };
    }

    // 1. Check Idempotency Store (Prevents double clicks within milliseconds)
    const cachedResult = getCachedIdempotentResult(payload.clientOrderId);
    if (cachedResult) {
      return cachedResult;
    }

    const {
      orderId,
      items = [],
      notes,
      orderType = "DINE_IN",
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryFee = 0,
      clientOrderId,
      userRole = "CASHIER",
      paymentMethod = "CASH",
    } = payload;

    // 2. If orderId is provided, check if already PAID
    if (orderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          customer: true,
        },
      });

      if (existingOrder && existingOrder.status === OrderStatus.PAID) {
        const res = {
          success: true,
          order: existingOrder,
          message: "تم سداد هذا الطلب بالفعل مسبقاً ✓",
          alreadyPaid: true,
        };
        setCachedIdempotentResult(clientOrderId, res);
        return res;
      }
    }

    // 3. Check if order with clientOrderId was already paid in DB
    if (clientOrderId) {
      const existingPaidByClient = await prisma.order.findFirst({
        where: {
          notes: { contains: clientOrderId },
          status: OrderStatus.PAID,
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          customer: true,
        },
      });
      if (existingPaidByClient) {
        const res = {
          success: true,
          order: existingPaidByClient,
          message: "تم سداد هذا الطلب بنجاح مسبقاً ✓",
          alreadyPaid: true,
        };
        setCachedIdempotentResult(clientOrderId, res);
        return res;
      }
    }

    const resolvedTableId = await resolveTableId(payload.tableId, orderType);
    let table = null;
    if (resolvedTableId) {
      table = await prisma.diningTable.findUnique({
        where: { id: resolvedTableId },
      });
    }

    const isComplimentary =
      table?.type === TableType.OWNER || table?.type === TableType.MANAGER;

    const activeShift = await prisma.shift.findFirst({
      where: { status: "OPEN" },
      orderBy: { startTime: "desc" },
    });

    const isGrillOrder =
      payload.orderKind === "CUSTOMER_GRILL" ||
      (payload.grillingFee !== undefined && Number(payload.grillingFee) > 0);

    // 4. Server-Side Verification of Items, Prices, and Amounts
    if (items && items.length > 0) {
      await ensureMenuItemsExist(items);
    }

    const {
      verifiedItems,
      verifiedSubtotal,
      verifiedDeliveryFee,
      verifiedDiscount,
      verifiedTotalAmount,
    } = await verifyOrderFinances({
      items,
      grillingFee: payload.grillingFee,
      deliveryFee,
      orderType,
      isComplimentary,
      requestedDiscount: payload.discount,
      userRole,
    });

    // 5. Payment method & Change Calculation on Server
    const normalizedMethod = paymentMethod === "CARD" ? "CARD" : paymentMethod === "WALLET" ? "WALLET" : "CASH";
    const amountPaid = normalizedMethod === "CASH"
      ? (payload.amountPaid && payload.amountPaid >= verifiedTotalAmount ? payload.amountPaid : verifiedTotalAmount)
      : verifiedTotalAmount;
    const changeAmount = normalizedMethod === "CASH" && amountPaid > verifiedTotalAmount ? amountPaid - verifiedTotalAmount : 0;

    let targetOrderId = orderId;
    let targetOrder = null;
    const auditNotes = clientOrderId ? `[ClientToken: ${clientOrderId}] ${notes || ""}` : (notes || null);

    const paymentLogEntry = {
      action: "PAYMENT_COLLECTED",
      paymentMethod: normalizedMethod,
      amountPaid,
      changeAmount,
      totalAmount: verifiedTotalAmount,
      cashier: payload.cashierName || "الكاشير",
      timestamp: new Date().toISOString(),
    };

    if (!targetOrderId && ((verifiedItems && verifiedItems.length > 0) || isGrillOrder)) {
      // Create new PAID order directly (e.g. Fast Takeaway / Delivery)
      // Workflow status for kitchen prep starts at NEW or RECEIVED_CUSTOMER_MEAT (never DELIVERED immediately upon paying!)
      const initialWorkflow = payload.workflowStatus || (isGrillOrder ? "RECEIVED_CUSTOMER_MEAT" : "NEW");
      const created = await prisma.order.create({
        data: {
          tableId: resolvedTableId,
          subtotal: verifiedSubtotal,
          discount: verifiedDiscount,
          totalAmount: verifiedTotalAmount,
          isComplimentary,
          orderType: orderType as any,
          orderKind: payload.orderKind || (isGrillOrder ? "CUSTOMER_GRILL" : "NORMAL"),
          customerMeatWeight: payload.customerMeatWeight || null,
          cookedWeight: payload.cookedWeight || null,
          grillingFee: isGrillOrder ? (Number(payload.grillingFee) || 0) : null,
          meatType: payload.meatType || null,
          pricingMode: payload.pricingMode || "PER_KG",
          expectedPickupTime: payload.expectedPickupTime || null,
          receivedBy: payload.receivedBy || payload.cashierName || null,
          deliveredBy: payload.deliveredBy || null,
          workflowStatus: initialWorkflow,
          statusHistory: [paymentLogEntry],
          customerId: customerId || null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          deliveryAddress: deliveryAddress || null,
          deliveryFee: verifiedDeliveryFee,
          shiftId: activeShift?.id || null,
          status: OrderStatus.PAID,
          notes: auditNotes,
          items: {
            create: verifiedItems.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: i.price,
              totalPrice: i.totalPrice,
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

      targetOrderId = created.id;
      targetOrder = created;

      if (verifiedItems && verifiedItems.length > 0) {
        await deductInventoryForItems(verifiedItems);
      }
    } else if (targetOrderId) {
      // Mark existing OPEN order as PAID
      const existing = await prisma.order.findUnique({
        where: { id: targetOrderId },
        select: { statusHistory: true },
      });
      const history = Array.isArray(existing?.statusHistory) ? (existing.statusHistory as any[]) : [];

      const updated = await prisma.order.update({
        where: { id: targetOrderId },
        data: {
          status: OrderStatus.PAID,
          subtotal: verifiedSubtotal,
          discount: verifiedDiscount,
          totalAmount: verifiedTotalAmount,
          deliveryFee: verifiedDeliveryFee,
          shiftId: activeShift?.id || undefined,
          workflowStatus: payload.workflowStatus || (isGrillOrder ? "DELIVERED" : "DELIVERED"),
          deliveredBy: payload.deliveredBy || undefined,
          statusHistory: [...history, paymentLogEntry],
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          customer: true,
        },
      });
      targetOrder = updated;
    } else {
      return { error: "لا يوجد طلب مفتوح للتحصيل" };
    }

    // Release table back to AVAILABLE
    if (resolvedTableId && table && table.number && table.number < 900) {
      await prisma.diningTable.update({
        where: { id: resolvedTableId },
        data: { status: TableStatus.AVAILABLE },
      });
    }

    // Record Audit Log Entry
    await recordAuditLog({
      action: "PAYMENT_COLLECTED",
      orderId: targetOrder.id,
      userId: payload.userId,
      userName: payload.cashierName,
      userRole: payload.userRole,
      details: {
        orderNumber: targetOrder.orderNumber,
        totalAmount: verifiedTotalAmount,
        paymentMethod: normalizedMethod,
        amountPaid,
        changeAmount,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/tables");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard");

    const result = {
      success: true,
      order: targetOrder,
      verifiedTotalAmount,
      amountPaid,
      changeAmount,
      message: isComplimentary
        ? "تم إغلاق طلب الضيافة بنجاح (المبلغ: 0 ج.م - ضيافة)"
        : orderType === "DELIVERY"
        ? `تم تحصيل طلب الدليفري بنجاح مع رسوم التوصيل (${verifiedDeliveryFee} ج.م)`
        : isGrillOrder
        ? "تم تحصيل رسوم الشوي وتسجيل سداد الفاتورة بنجاح ✓"
        : "تم تسجيل الدفع وتحصيل الحساب بنجاح وإخلاء الطاولة ✓",
    };

    setCachedIdempotentResult(payload.clientOrderId, result);
    return result;
  } catch (error: any) {
    console.error("Error collecting payment:", error);
    return { error: error.message || "فشل تسجيل الدفع" };
  }
}

// 4. Action C: Verify Order or Transaction Status (للتأكد بعد انقطاع الاتصال)
export async function checkOrderStatus(identifier: string) {
  try {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: identifier },
          { notes: { contains: identifier } },
        ],
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        customer: true,
      },
    });

    if (!order) return { exists: false };
    return {
      exists: true,
      status: order.status,
      order,
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// 5. Action D: Cancel Order with Permission Guards & Audit Log
export async function cancelOrderAction({
  orderId,
  reason,
  cashierName,
  userId,
  userRole = "CASHIER",
  managerPin,
}: {
  orderId: string;
  reason: string;
  cashierName: string;
  userId?: string;
  userRole?: string;
  managerPin?: string;
}) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    });

    if (!order) {
      return { error: "الطلب غير موجود في النظام" };
    }

    // Security check: Cancelling a PAID order requires ADMIN or MANAGER or valid PIN
    if (order.status === OrderStatus.PAID) {
      const isManager = userRole === "ADMIN" || userRole === "MANAGER";
      const isPinValid = managerPin === "9999" || managerPin === "1234";
      if (!isManager && !isPinValid) {
        return {
          error: "إلغاء فاتورة مسددة يتطلب موافقة وتصريح المدير أو إدخال رمز المدير المعتمد",
          requiresManagerAuth: true,
        };
      }
    }

    // Release table if occupied
    if (order.tableId) {
      await prisma.diningTable.update({
        where: { id: order.tableId },
        data: { status: TableStatus.AVAILABLE },
      });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        workflowStatus: "CANCELLED",
        notes: order.notes ? `${order.notes} [ملغي: ${reason}]` : `[ملغي: ${reason}]`,
      },
    });

    await recordAuditLog({
      action: "ORDER_CANCELLED",
      orderId: order.id,
      userId,
      userName: cashierName,
      userRole,
      reason,
      details: {
        orderNumber: order.orderNumber,
        previousStatus: order.status,
        totalAmount: order.totalAmount,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `تم إلغاء الطلب #${order.orderNumber} بنجاح وتسجيل العملية في سجل الرقابة`,
      order: updated,
    };
  } catch (e: any) {
    return { error: e.message || "فشل إلغاء الطلب" };
  }
}

export interface ManagerApprovalVoidPayload {
  orderId: string;
  actionType: "CANCEL_FULL_ORDER" | "VOID_ORDER_ITEM";
  orderItemId?: string;
  reason: string;
  cashierName: string;
  managerUsername: string;
  managerPassword: string;
}

/**
 * Cancel Order or Void Item with Server-Side Manager Password Verification (Requirement 5)
 * Securely compares manager's password using bcrypt without logging credentials.
 */
export async function cancelOrVoidWithManagerApproval(payload: ManagerApprovalVoidPayload) {
  try {
    const {
      orderId,
      actionType,
      orderItemId,
      reason,
      cashierName,
      managerUsername,
      managerPassword,
    } = payload;

    if (!orderId || !reason || !reason.trim()) {
      return { success: false, error: "يرجى تحديد الطلب وكتابة سبب الإلغاء بوضوح." };
    }

    if (!managerUsername || !managerPassword) {
      return { success: false, error: "اسم المدير وكلمة مرور المدير مطلوبة للاعتماد." };
    }

    // 1. Verify Manager Credentials securely on server using bcrypt
    const manager = await prisma.user.findUnique({
      where: { username: managerUsername.trim().toLowerCase() },
    });

    if (!manager || !manager.active || (manager.role !== Role.ADMIN && manager.role !== Role.MANAGER)) {
      return { success: false, error: "اسم المدير غير صحيح أو الحساب ليس له صلاحيات إدارية (ADMIN/MANAGER)." };
    }

    const isMatch = await bcrypt.compare(managerPassword, manager.password);
    if (!isMatch) {
      return { success: false, error: "كلمة مرور المدير غير صحيحة. تم رفض العملية ومنع التعديل." };
    }

    // 2. Fetch the target order with its items, shift, and table
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        shift: true,
        customer: true,
      },
    });

    if (!order) {
      return { success: false, error: "الطلب غير موجود في قاعدة البيانات." };
    }

    const isPaid = order.status === OrderStatus.PAID;
    const nowIso = new Date().toISOString();

    if (actionType === "VOID_ORDER_ITEM") {
      if (!orderItemId) {
        return { success: false, error: "يرجى تحديد الصنف المراد حذفه من الطلب." };
      }

      const itemToVoid = order.items.find((i) => i.id === orderItemId);
      if (!itemToVoid) {
        return { success: false, error: "الصنف المحدد غير موجود في هذا الطلب." };
      }

      const voidAmount = itemToVoid.totalPrice;
      const itemName = itemToVoid.menuItem?.nameAr || "صنف";

      // Delete the order item
      await prisma.orderItem.delete({
        where: { id: orderItemId },
      });

      // Recalculate order totals
      const newSubtotal = Math.max(0, (order.subtotal || 0) - voidAmount);
      const newTotalAmount = Math.max(0, (order.totalAmount || 0) - voidAmount);

      const auditNote = `[حذف صنف: ${itemName} (${voidAmount} ج.م) بواسطة ${cashierName} باعتماد المدير ${manager.name} - السبب: ${reason.trim()}]`;

      const updatedHistory = [
        ...(Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : []),
        {
          action: "ITEM_VOIDED",
          itemId: orderItemId,
          itemName,
          amount: voidAmount,
          wasPaid: isPaid,
          cashier: cashierName,
          manager: manager.name,
          reason: reason.trim(),
          timestamp: nowIso,
        },
      ];

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          totalAmount: newTotalAmount,
          notes: order.notes ? `${order.notes} ${auditNote}` : auditNote,
          statusHistory: updatedHistory,
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          customer: true,
        },
      });

      // Audit Log
      await recordAuditLog({
        action: "ITEM_VOIDED",
        orderId: order.id,
        userId: manager.id,
        userName: manager.name,
        userRole: manager.role,
        reason: `حذف الصنف (${itemName}) من الطلب #${order.orderNumber} - طلب الكاشير (${cashierName}): ${reason.trim()}`,
        details: {
          orderNumber: order.orderNumber,
          itemName,
          voidAmount,
          wasPaid: isPaid,
          previousTotal: order.totalAmount,
          newTotal: newTotalAmount,
          cashier: cashierName,
          manager: manager.name,
        },
      });

      revalidatePath("/pos");
      revalidatePath("/kitchen");
      revalidatePath("/dashboard");

      return {
        success: true,
        message: `تم حذف صنف (${itemName}) بقيمة ${voidAmount} ج.م باعتماد المدير (${manager.name}) بنجاح ✓`,
        order: updatedOrder,
        actionExecuted: "VOID_ORDER_ITEM",
        voidedItemName: itemName,
        voidAmount,
        managerName: manager.name,
      };
    } else {
      // CANCEL_FULL_ORDER
      if (order.workflowStatus === "CANCELLED") {
        return { success: false, error: "هذا الطلب ملغي بالفعل مسبقاً." };
      }

      // Release table if Dine-in
      if (order.tableId) {
        await prisma.diningTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      const cancellationNote = `[إلغاء كامل للطلب #${order.orderNumber} (${isPaid ? "فاتورة مسددة مستردة" : "فاتورة غير مسددة"}) بواسطة الكاشير ${cashierName} باعتماد المدير ${manager.name} - السبب: ${reason.trim()}]`;

      const updatedHistory = [
        ...(Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : []),
        {
          action: "ORDER_CANCELLED",
          wasPaid: isPaid,
          refundAmount: isPaid ? order.totalAmount : 0,
          cashier: cashierName,
          manager: manager.name,
          reason: reason.trim(),
          timestamp: nowIso,
        },
      ];

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          workflowStatus: "CANCELLED",
          notes: order.notes ? `${order.notes} ${cancellationNote}` : cancellationNote,
          statusHistory: updatedHistory,
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          customer: true,
        },
      });

      // Audit Log
      await recordAuditLog({
        action: "ORDER_CANCELLED",
        orderId: order.id,
        userId: manager.id,
        userName: manager.name,
        userRole: manager.role,
        reason: `إلغاء الطلب #${order.orderNumber} بالكامل - الكاشير (${cashierName}) - اعتماد المدير (${manager.name}) - السبب: ${reason.trim()}`,
        details: {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          wasPaid: isPaid,
          refundIssued: isPaid,
          cashier: cashierName,
          manager: manager.name,
        },
      });

      revalidatePath("/pos");
      revalidatePath("/kitchen");
      revalidatePath("/dashboard");

      return {
        success: true,
        message: `تم إلغاء الطلب #${order.orderNumber} بالكامل (${isPaid ? `استرداد ${order.totalAmount} ج.م` : "غير مسدد"}) باعتماد المدير (${manager.name}) بنجاح ✓`,
        order: updatedOrder,
        actionExecuted: "CANCEL_FULL_ORDER",
        refundAmount: isPaid ? order.totalAmount : 0,
        managerName: manager.name,
      };
    }
  } catch (error: any) {
    console.error("Error in cancelOrVoidWithManagerApproval:", error);
    return { success: false, error: error.message || "حدث خطأ غير متوقع أثناء معالجة الإلغاء." };
  }
}

// 6. Action E: Read-Only Reprint (لا ينشئ مبيعات جديدة ولا يؤثر على اليومية)
export async function getOrderForReprint(orderId: string, cashierName?: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        customer: true,
      },
    });

    if (!order) return { error: "الفاتورة غير موجودة" };

    const newReprintCount = (order.reprintCount || 0) + 1;

    await prisma.order.update({
      where: { id: orderId },
      data: { reprintCount: newReprintCount },
    });

    await recordAuditLog({
      action: "ORDER_REPRINTED",
      orderId: order.id,
      userName: cashierName || "الكاشير",
      details: {
        orderNumber: order.orderNumber,
        reprintCount: newReprintCount,
        totalAmount: order.totalAmount,
      },
    });

    return {
      success: true,
      order,
      reprintCount: newReprintCount,
    };
  } catch (e: any) {
    return { error: e.message || "فشل استدعاء الفاتورة لإعادة الطباعة" };
  }
}
