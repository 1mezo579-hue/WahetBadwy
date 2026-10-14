"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface CustomerInput {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

export async function getCustomers(search?: string) {
  try {
    const where: any = {};
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { phone: { contains: search.trim() } },
        { address: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            orderType: true,
            createdAt: true,
            status: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = customers.map((c) => {
      const totalSpent = c.orders.reduce((sum, o) => sum + (o.status === "PAID" ? o.totalAmount : 0), 0);
      const ordersCount = c.orders.length;
      return {
        ...c,
        totalSpent,
        ordersCount,
        lastOrder: c.orders[0] || null,
      };
    });

    return { success: true, customers: enriched };
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return { success: false, error: error.message || "فشل تحميل قائمة العملاء", customers: [] };
  }
}

export async function createCustomer(data: CustomerInput) {
  try {
    if (!data.name || !data.phone) {
      return { success: false, error: "اسم العميل ورقم الهاتف مطلوبان" };
    }

    const existing = await prisma.customer.findUnique({
      where: { phone: data.phone.trim() },
    });

    if (existing) {
      return { success: false, error: "رقم الهاتف مسجل مسبقاً لعميل آخر", customer: existing };
    }

    const customer = await prisma.customer.create({
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    revalidatePath("/dashboard/customers");
    revalidatePath("/pos");
    return { success: true, customer, message: "تم تسجيل العميل بنجاح" };
  } catch (error: any) {
    console.error("Error creating customer:", error);
    return { success: false, error: error.message || "فشل تسجيل العميل" };
  }
}

export async function updateCustomer(id: string, data: Partial<CustomerInput>) {
  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.phone && { phone: data.phone.trim() }),
        address: data.address !== undefined ? data.address.trim() : undefined,
        notes: data.notes !== undefined ? data.notes.trim() : undefined,
      },
    });

    revalidatePath("/dashboard/customers");
    revalidatePath("/pos");
    return { success: true, customer, message: "تم تحديث بيانات العميل بنجاح" };
  } catch (error: any) {
    console.error("Error updating customer:", error);
    return { success: false, error: error.message || "فشل تحديث بيانات العميل" };
  }
}

export async function deleteCustomer(id: string) {
  try {
    await prisma.customer.delete({
      where: { id },
    });

    revalidatePath("/dashboard/customers");
    return { success: true, message: "تم حذف العميل بنجاح" };
  } catch (error: any) {
    console.error("Error deleting customer:", error);
    return { success: false, error: error.message || "فشل حذف العميل" };
  }
}

export async function searchCustomerByPhone(phone: string) {
  try {
    if (!phone || phone.trim().length < 3) return null;
    const customer = await prisma.customer.findFirst({
      where: {
        phone: {
          contains: phone.trim(),
        },
      },
      include: {
        orders: {
          take: 3,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return customer;
  } catch (error) {
    console.error("Search customer error:", error);
    return null;
  }
}
