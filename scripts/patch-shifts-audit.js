const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/actions/shifts.ts");
let code = fs.readFileSync(filePath, "utf8");

// 1. Add import
if (!code.includes("recordAuditLog")) {
  code = code.replace(
    'import { revalidatePath } from "next/cache";',
    'import { revalidatePath } from "next/cache";\r\nimport { recordAuditLog } from "@/lib/audit-logger";'
  );
}

// 2. Add audit log in startShift
if (!code.includes('action: "SHIFT_STARTED"')) {
  const target = 'revalidatePath("/pos");';
  const replacement = `await recordAuditLog({
      action: "SHIFT_STARTED",
      userId: shift.userId,
      userName: shift.user?.name || "كاشير",
      userRole: shift.user?.role || "CASHIER",
      details: {
        shiftId: shift.id,
        shiftNumber: shift.shiftNumber,
        initialCash,
      },
      reason: \`فتح وردية جديدة بعهدة افتتاحية \${initialCash.toFixed(2)} ج.م\`,
    });

    revalidatePath("/pos");`;
  code = code.replace(target, replacement);
}

// 3. Add audit log in endShift
if (!code.includes('action: "SHIFT_ENDED"')) {
  const target2 = 'return {\r\n      success: true,\r\n      shift: updatedShift,';
  const target2Alt = 'return {\n      success: true,\n      shift: updatedShift,';
  const replacement2 = `await recordAuditLog({
      action: "SHIFT_ENDED",
      userId: updatedShift.userId,
      userName: updatedShift.user?.name || "كاشير",
      userRole: updatedShift.user?.role || "CASHIER",
      details: {
        shiftId: updatedShift.id,
        shiftNumber: updatedShift.shiftNumber,
        initialCash: shift.initialCash,
        grossSales: finalGrossSales,
        actualCash,
        expectedCash,
        shortageOverage,
        receivedBy: receivedBy || null,
      },
      reason: \`تقفيل الوردية رقم #\${updatedShift.shiftNumber} (عجز/زيادة: \${shortageOverage.toFixed(2)} ج.م)\`,
    });

    return {
      success: true,
      shift: updatedShift,`;

  if (code.includes(target2)) {
    code = code.replace(target2, replacement2);
  } else if (code.includes(target2Alt)) {
    code = code.replace(target2Alt, replacement2);
  }
}

fs.writeFileSync(filePath, code, "utf8");
console.log("Successfully patched shifts.ts with recordAuditLog");
