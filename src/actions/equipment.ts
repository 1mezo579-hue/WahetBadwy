"use server";

import { prisma } from "@/lib/prisma";
import { EquipmentStatus } from "@prisma/client";
import { EquipmentType } from "@/types/equipment";
import { revalidatePath } from "next/cache";

async function ensureEquipmentColumns() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ALTER COLUMN "type" DROP DEFAULT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ALTER COLUMN "type" SET DEFAULT 'KITCHEN';`);
  } catch {
    // Already TEXT or default set
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;`);
  } catch {}

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'قطعة';`);
  } catch {}

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "unit_price" DOUBLE PRECISION DEFAULT 0;`);
  } catch {}

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "purchase_date" TIMESTAMP WITH TIME ZONE;`);
  } catch {}
}
import { heroInvoiceEquipmentData } from "@/data/hero-invoice-data";


export async function syncHeroInvoiceEquipment() {
  try {
    await ensureEquipmentColumns();

    for (const item of heroInvoiceEquipmentData) {
      const existing = await prisma.equipment.findFirst({
        where: {
          name: item.name,
          type: item.type,
        },
      });

      if (existing) {
        await prisma.equipment.update({
          where: { id: existing.id },
          data: {
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            purchaseDate: item.purchaseDate,
            notes: item.notes,
          } as any,
        });
      } else {
        await prisma.equipment.create({
          data: {
            name: item.name,
            type: item.type,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            purchaseDate: item.purchaseDate,
            status: EquipmentStatus.OPERATIONAL,
            notes: item.notes,
          } as any,
        });
      }
    }

    revalidatePath("/dashboard/equipment");
    return { success: true, count: heroInvoiceEquipmentData.length };
  } catch (error: any) {
    console.error("Error syncing hero invoice equipment:", error);
    return { error: error.message || "فشل مزامنة عهدة الشيشة والبار" };
  }
}

export async function getEquipment(typeFilter?: EquipmentType | string) {
  try {
    await ensureEquipmentColumns();

    // Auto-sync invoice items if not present
    const count = await prisma.equipment.count();
    if (count < 40) {
      await syncHeroInvoiceEquipment();
    }

    const items = await prisma.equipment.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: { createdAt: "asc" },
    });

    return items as any[];
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return [];
  }
}

export async function createEquipment(formData: FormData) {
  try {
    await ensureEquipmentColumns();

    const name = formData.get("name") as string;
    const type = (formData.get("type") as string) || "KITCHEN";
    const quantity = parseInt(formData.get("quantity") as string) || 1;
    const unit = (formData.get("unit") as string) || "قطعة";
    const unitPrice = parseFloat(formData.get("unitPrice") as string) || 0;
    const purchaseDateStr = formData.get("purchaseDate") as string;
    const location = formData.get("location") as string;
    const serialNumber = formData.get("serialNumber") as string;
    const status = (formData.get("status") as EquipmentStatus) || EquipmentStatus.OPERATIONAL;
    const notes = formData.get("notes") as string;

    if (!name) return { error: "يرجى إدخال اسم الجهاز أو المعدة" };

    await prisma.equipment.create({
      data: {
        name,
        type,
        quantity: Math.max(1, quantity),
        unit,
        unitPrice,
        purchaseDate: purchaseDateStr ? new Date(purchaseDateStr) : null,
        status,
        location: location || null,
        serialNumber: serialNumber || null,
        notes: notes || null,
      } as any,
    });

    revalidatePath("/dashboard/equipment");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating equipment:", error);
    return { error: error.message || "حدث خطأ أثناء إضافة المعدة" };
  }
}

export async function updateEquipment(
  id: string,
  data: {
    name?: string;
    type?: EquipmentType | string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    purchaseDate?: Date | null;
    status?: EquipmentStatus;
    location?: string | null;
    serialNumber?: string | null;
    notes?: string | null;
  }
) {
  try {
    await ensureEquipmentColumns();

    await prisma.equipment.update({
      where: { id },
      data: {
        ...data,
        quantity: data.quantity !== undefined ? Math.max(1, data.quantity) : undefined,
      } as any,
    });
    revalidatePath("/dashboard/equipment");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating equipment:", error);
    return { error: error.message || "فشل تعديل بيانات المعدة" };
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

export async function clearSectionEquipment(type: EquipmentType | string) {
  try {
    await ensureEquipmentColumns();
    const result = await prisma.equipment.deleteMany({
      where: { type },
    });
    revalidatePath("/dashboard/equipment");
    return { success: true, count: result.count };
  } catch (error: any) {
    console.error("Error clearing section equipment:", error);
    return { error: "فشل حذف معدات هذا القسم" };
  }
}
