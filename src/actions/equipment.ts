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
  } catch {
    // Column already exists
  }
}

async function seedInitialBaladiCoffeeGear() {
  try {
    const existingBaladi = await prisma.equipment.count({
      where: { type: EquipmentType.BALADI_COFFEE },
    });

    if (existingBaladi === 0) {
      const defaultBaladiGear = [
        {
          name: "رمالة قهوة تركي كهربائية بالرمل الحراري",
          type: EquipmentType.BALADI_COFFEE,
          status: EquipmentStatus.OPERATIONAL,
          quantity: 2,
          location: "ركن القهوة البلدي",
          notes: "رمالة استيل حرارية لصنع القهوة على الرمل الساخن بدرجة غليان هادئة",
        },
        {
          name: "عمالات شاي نحاسية وبن على الفحم",
          type: EquipmentType.BALADI_COFFEE,
          status: EquipmentStatus.OPERATIONAL,
          quantity: 4,
          location: "ركن القهوة البلدي",
          notes: "عمالة نحاس تقليدية أصيلة للتحضير المستمر ومياه الغليان للشاي والقهوة",
        },
        {
          name: "طقم كنك قهوة مقاسات مختلفة (أحجام 1 و 2 و 3)",
          type: EquipmentType.BALADI_COFFEE,
          status: EquipmentStatus.OPERATIONAL,
          quantity: 12,
          location: "ركن القهوة البلدي",
          notes: "كنك نحاس واستانلس لعمل فنجان أو فنجانين أو كنكة عائلية",
        },
        {
          name: "برادات شاي بدوي استانلس وألومنيوم ومينا",
          type: EquipmentType.BALADI_COFFEE,
          status: EquipmentStatus.OPERATIONAL,
          quantity: 8,
          location: "ركن القهوة البلدي",
          notes: "برادات تلقيمة للشاي الزرد والشاي بالنعناع والمرمرية البدوي",
        },
        {
          name: "سكريات زجاجية واستانلس بملاعقها",
          type: EquipmentType.BALADI_COFFEE,
          status: EquipmentStatus.OPERATIONAL,
          quantity: 15,
          location: "ركن القهوة وطاولات الصالة",
          notes: "سكريات لحفظ السكر وتقديمه مع صواني الشاي والقهوة",
        },
        {
          name: "شيالات كبايات وصواني تقديم نحاسية واستكانات",
          type: EquipmentType.BALADI_COFFEE,
          status: EquipmentStatus.OPERATIONAL,
          quantity: 6,
          location: "ركن القهوة البلدي",
          notes: "شيالات تقليدية لحمل الكبايات والوصول السريع لزبائن الصالة والباكيات",
        },
      ];

      for (const gear of defaultBaladiGear) {
        await prisma.equipment.create({
          data: gear as any,
        });
      }
    }
  } catch (err) {
    console.error("Error auto-seeding baladi coffee gear:", err);
  }
}

export async function getEquipment(typeFilter?: EquipmentType | string) {
  try {
    await ensureEquipmentColumns();
    await seedInitialBaladiCoffeeGear();

    const items = await prisma.equipment.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: { createdAt: "desc" },
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
