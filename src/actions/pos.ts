"use server";

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

// 1. Get POS Initial Data (Tables with their active open order, Categories, MenuItems)
export async function getPosData() {
  try {
    const [tables, categories, menuItems] = await Promise.all([
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
    ]);

    return { tables, categories, menuItems };
  } catch (error) {
    console.error("Error fetching POS data:", error);
    return { tables: [], categories: [], menuItems: [] };
  }
}

// 2. Action A: Send to Prep (حفظ وطباعة الأوردر -> Saves order as OPEN)
export async function sendOrderToPrep({
  orderId,
  tableId,
  items,
  notes,
}: {
  orderId?: string;
  tableId: string;
  items: CartItemInput[];
  notes?: string;
}) {
  try {
    if (!tableId || items.length === 0) {
      return { error: "يرجى اختيار طاولة وإضافة أصناف للطلب" };
    }

    const table = await prisma.diningTable.findUnique({
      where: { id: tableId },
    });

    if (!table) return { error: "الطاولة غير موجودة" };

    // SPECIAL LOGIC: Orders on Owner or Manager table are flagged as 'Complimentary' (ضيافة)
    const isComplimentary =
      table.type === TableType.OWNER || table.type === TableType.MANAGER;

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const discount = isComplimentary ? subtotal : 0;
    const totalAmount = isComplimentary ? 0 : subtotal;

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
          notes,
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
        },
      });
    } else {
      // Create new OPEN order
      order = await prisma.order.create({
        data: {
          tableId,
          subtotal,
          discount,
          totalAmount,
          isComplimentary,
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
        },
      });
    }

    // Update table status to OCCUPIED
    await prisma.diningTable.update({
      where: { id: tableId },
      data: { status: TableStatus.OCCUPIED },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/tables");
    revalidatePath("/dashboard");

    return {
      success: true,
      order,
      message: isComplimentary
        ? "تم حفظ الطلب وإرساله للتحضير (ضيافة - Complimentary)"
        : "تم حفظ الطلب وإرساله للتحضير والطباعة بنجاح",
    };
  } catch (error: any) {
    console.error("Error sending order to prep:", error);
    return { error: error.message || "فشل إرسال الطلب للتحضير" };
  }
}

// 3. Action B: Collect Payment (تحصيل -> Changes status to PAID)
export async function collectOrderPayment({
  orderId,
  tableId,
  items,
  notes,
}: {
  orderId?: string;
  tableId: string;
  items?: CartItemInput[];
  notes?: string;
}) {
  try {
    if (!tableId) return { error: "يرجى تحديد الطاولة" };

    const table = await prisma.diningTable.findUnique({
      where: { id: tableId },
    });

    if (!table) return { error: "الطاولة غير موجودة" };

    const isComplimentary =
      table.type === TableType.OWNER || table.type === TableType.MANAGER;

    let targetOrderId = orderId;

    // If order was not sent to prep yet, save it directly as PAID
    if (!targetOrderId && items && items.length > 0) {
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const discount = isComplimentary ? subtotal : 0;
      const totalAmount = isComplimentary ? 0 : subtotal;

      const created = await prisma.order.create({
        data: {
          tableId,
          subtotal,
          discount,
          totalAmount,
          isComplimentary,
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
    } else if (targetOrderId) {
      // Mark existing order as PAID
      await prisma.order.update({
        where: { id: targetOrderId },
        data: {
          status: OrderStatus.PAID,
        },
      });
    } else {
      return { error: "لا يوجد طلب مفتوح للتحصيل" };
    }

    // Release table back to AVAILABLE
    await prisma.diningTable.update({
      where: { id: tableId },
      data: { status: TableStatus.AVAILABLE },
    });

    revalidatePath("/pos");
    revalidatePath("/dashboard/tables");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: isComplimentary
        ? "تم إغلاق طلب الضيافة بنجاح (المبلغ: 0 ج.م - ضيافة)"
        : "تم تسجيل الدفع وتحصيل الحساب بنجاح وإخلاء الطاولة",
    };
  } catch (error: any) {
    console.error("Error collecting payment:", error);
    return { error: error.message || "فشل تسجيل الدفع" };
  }
}
