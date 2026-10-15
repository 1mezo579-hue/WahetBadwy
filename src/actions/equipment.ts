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

const heroInvoiceEquipmentData = [
  // من رقم 1 إلى 29: عدة شيشة
  { itemNo: 1, name: "قلب كورة منقوش 1 دور", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 6, unitPrice: 240, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #1" },
  { itemNo: 2, name: "قلب كورة منقوش 2 دور", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 4, unitPrice: 275, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #2" },
  { itemNo: 3, name: "قلب كورة 2 دور", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 10, unitPrice: 225, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #3" },
  { itemNo: 4, name: "قلب سبك نحاس رماية 2 دور", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 5, unitPrice: 750, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #4" },
  { itemNo: 5, name: "فوارغ شمعي 12 ق", type: EquipmentType.SHISHA, unit: "كرتونة 12 ق", quantity: 2, unitPrice: 410, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #5" },
  { itemNo: 6, name: "طاسة 23 سم دهب", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 5, unitPrice: 50, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #6" },
  { itemNo: 7, name: "مبسم دهب", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 5, unitPrice: 45, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #7" },
  { itemNo: 8, name: "كسوة جامبو دهب", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 5, unitPrice: 65, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #8" },
  { itemNo: 9, name: "فارغة دهب", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 5, unitPrice: 80, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #9" },
  { itemNo: 10, name: "طاسة 20 سم", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 20, unitPrice: 30, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #10" },
  { itemNo: 11, name: "كسوة جامبو فضي", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 20, unitPrice: 50, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #11" },
  { itemNo: 12, name: "مبسم استانليس 1 دور", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 20, unitPrice: 45, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #12" },
  { itemNo: 13, name: "قاعدة فارغة وسط", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 25, unitPrice: 8, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #13" },
  { itemNo: 14, name: "ل شمعدان اسيوطي", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 20, unitPrice: 150, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #14" },
  { itemNo: 15, name: "ماشة شاكوش", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 2, unitPrice: 25, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #15" },
  { itemNo: 16, name: "ماشة نصية", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 80, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #16" },
  { itemNo: 17, name: "كبشة نار جامبو", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 150, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #17" },
  { itemNo: 18, name: "رمالة سخان كهربائي", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 9500, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #18" },
  { itemNo: 19, name: "بيت نار كامل", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 1000, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #19" },
  { itemNo: 20, name: "كعب زان", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 25, unitPrice: 7, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #20" },
  { itemNo: 21, name: "بلي رقاص", type: EquipmentType.SHISHA, unit: "كيس", quantity: 1, unitPrice: 50, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #21" },
  { itemNo: 22, name: "طقم فرشاة تنظيف", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 30, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #22" },
  { itemNo: 23, name: "شيشة لوكس HR-9013", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 3, unitPrice: 1950, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #23" },
  { itemNo: 24, name: "شيشة لوكس HR-9012", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 2, unitPrice: 1900, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #24" },
  { itemNo: 25, name: "شيشة لوكس HR-9030", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 2, unitPrice: 2000, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #25" },
  { itemNo: 26, name: "شيشة لوكس HR-9025", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 1900, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #26" },
  { itemNo: 27, name: "شيشة لوكس HR-9026", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 1900, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #27" },
  { itemNo: 28, name: "شيشة لوكس HR-9021", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 1950, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #28" },
  { itemNo: 29, name: "براد رقم 1", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 10, unitPrice: 180, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #29" },

  // من رقم 30 إلى 48: بار (عدة القهوة البلدي والبار)
  { itemNo: 30, name: "براد رقم 2", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 10, unitPrice: 210, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #30" },
  { itemNo: 31, name: "براد رقم 3", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 10, unitPrice: 260, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #31" },
  { itemNo: 32, name: "طقم لبانة استانليس", type: EquipmentType.BALADI_COFFEE, unit: "طقم 4 ق", quantity: 1, unitPrice: 1200, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #32" },
  { itemNo: 33, name: "كنكة رقم 3", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 10, unitPrice: 38, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #33" },
  { itemNo: 34, name: "كنكة رقم 2", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 5, unitPrice: 50, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #34" },
  { itemNo: 35, name: "كنكة رقم 1", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 1, unitPrice: 145, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #35" },
  { itemNo: 36, name: "لبانة شعبي", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 1, unitPrice: 130, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #36" },
  { itemNo: 37, name: "سكرية نمرة 2 ك", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 1, unitPrice: 480, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #37" },
  { itemNo: 38, name: "عمال رقم 1", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 1, unitPrice: 480, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #38" },
  { itemNo: 39, name: "عمال رقم 2", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 1, unitPrice: 600, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #39" },
  { itemNo: 40, name: "تيرية وسط", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 1, unitPrice: 140, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #40" },
  { itemNo: 41, name: "تيرية كبير", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 1, unitPrice: 160, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #41" },
  { itemNo: 42, name: "طفاية استانليس", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 15, unitPrice: 25, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #42" },
  { itemNo: 43, name: "سكرية كاس", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 5, unitPrice: 10, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #43" },
  { itemNo: 44, name: "سكرية بغطاء", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 10, unitPrice: 15, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار صنف #44" },
  { itemNo: 45, name: "خشبة دومينو عمولة", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 5, unitPrice: 120, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار/صالة صنف #45" },
  { itemNo: 46, name: "قشاط دومينو مستورد", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 5, unitPrice: 170, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار/صالة صنف #46" },
  { itemNo: 47, name: "قشاط طاولة مستورد", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 3, unitPrice: 150, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار/صالة صنف #47" },
  { itemNo: 48, name: "طاولة زان", type: EquipmentType.BALADI_COFFEE, unit: "قطعة", quantity: 3, unitPrice: 300, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - بار/صالة صنف #48" },

  // من رقم 49 إلى 57: عدة شيشة
  { itemNo: 49, name: "بفتة", type: EquipmentType.SHISHA, unit: "متر مربع", quantity: 6, unitPrice: 70, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #49" },
  { itemNo: 50, name: "حجر سيراميك مسطح", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 15, unitPrice: 7, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #50" },
  { itemNo: 51, name: "حجر نجال دوبل", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 270, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #51" },
  { itemNo: 52, name: "فويل رول 1300", type: EquipmentType.SHISHA, unit: "كرتونة 100 ق", quantity: 1, unitPrice: 350, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #52" },
  { itemNo: 53, name: "فويل مخرم", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 1, unitPrice: 300, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #53" },
  { itemNo: 54, name: "طبق كوستر", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 2, unitPrice: 65, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #54" },
  { itemNo: 55, name: "دندش 100 جم", type: EquipmentType.SHISHA, unit: "دستة 12 ق", quantity: 95, unitPrice: 50, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #55" },
  { itemNo: 56, name: "دندش 1000 جم سطل", type: EquipmentType.SHISHA, unit: "قطعة", quantity: 4, unitPrice: 470, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #56" },
  { itemNo: 57, name: "مباسم 1000", type: EquipmentType.SHISHA, unit: "كيس 1000 ق", quantity: 1, unitPrice: 130, purchaseDate: new Date("2026-09-30"), notes: "فاتورة شيشة هيرو - صنف #57" },
];

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
