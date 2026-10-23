/**
 * ESC/POS Command Generator for Thermal POS Printers (58mm & 80mm)
 * Implements hardware commands for text formatting, cutting, and cash drawer kick.
 */

// Basic ESC/POS command constants
export const ESC_COMMANDS = {
  // Initialize printer
  INIT: new Uint8Array([0x1b, 0x40]),

  // Alignment
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),

  // Font weight & sizes
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
  SIZE_NORMAL: new Uint8Array([0x1d, 0x21, 0x00]),
  SIZE_DOUBLE_HEIGHT: new Uint8Array([0x1d, 0x21, 0x01]),
  SIZE_DOUBLE_WIDTH: new Uint8Array([0x1d, 0x21, 0x10]),
  SIZE_TITLE_LARGE: new Uint8Array([0x1d, 0x21, 0x11]), // 2x Width & 2x Height

  // Paper cutting
  FEED_3_LINES: new Uint8Array([0x1b, 0x64, 0x03]),
  FEED_5_LINES: new Uint8Array([0x1b, 0x64, 0x05]),
  PARTIAL_CUT: new Uint8Array([0x1d, 0x56, 0x01]), // Partial cut
  FULL_CUT: new Uint8Array([0x1d, 0x56, 0x42, 0x00]), // Feed and cut paper

  // CRITICAL REQUIREMENT 2: Cash Drawer Kick command (Pin 2 and Pin 5)
  // ESC p m t1 t2: 0x1B 0x70 0x00 0x19 0xFA (Pulse pin 2, 50ms on, 500ms off)
  DRAWER_KICK_PIN2: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
  DRAWER_KICK_PIN5: new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa]),
};

/**
 * Helper to combine multiple Uint8Array chunks into a single byte stream
 */
export function concatByteArrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Encode string to UTF-8 bytes with line endings
 */
export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text + "\n");
}

/**
 * CASH DRAWER KICK: Dedicated command stream to open cash drawer
 * Only called during "Collect Payment" (تحصيل)
 */
export function buildCashDrawerKickCommand(): Uint8Array {
  return concatByteArrays(
    ESC_COMMANDS.DRAWER_KICK_PIN2,
    ESC_COMMANDS.DRAWER_KICK_PIN5
  );
}

export interface TicketItem {
  nameAr: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface PrepTicketOptions {
  departmentTitle: string; // e.g. "المطبخ (KITCHEN)", "الباريستا (BARISTA)", "الشيشة (SHISHA)"
  tableName: string; // CRITICAL: Table name MUST be displayed prominently
  orderNumber?: number;
  items: TicketItem[];
  notes?: string;
  timestamp?: Date;
}

export interface CustomerCheckOptions {
  tableName: string;
  orderNumber?: number;
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  items: TicketItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  isComplimentary: boolean;
  notes?: string;
  timestamp?: Date;
  cashierName?: string;
}

/**
 * Format a 2-column text line for standard 80mm/58mm width receipt
 */
function formatTwoColumns(left: string, right: string, totalWidth = 32): string {
  const spaces = Math.max(1, totalWidth - (left.length + right.length));
  return left + " ".repeat(spaces) + right;
}

/**
 * 1. KITCHEN PREPARATION TICKET
 * CRITICAL: Displays DiningTable name. NEVER sends cash drawer command.
 */
export function buildKitchenTicket(options: PrepTicketOptions): Uint8Array {
  const timeStr = (options.timestamp || new Date()).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const chunks: Uint8Array[] = [
    ESC_COMMANDS.INIT,
    ESC_COMMANDS.ALIGN_CENTER,
    ESC_COMMANDS.BOLD_ON,
    ESC_COMMANDS.SIZE_DOUBLE_WIDTH,
    encodeText("مشويات اولاد بسيوني - MASHWEYAT AWLAD BASIONY"),
    ESC_COMMANDS.SIZE_TITLE_LARGE,
    encodeText(`*** بون المطبخ ***`),
    ESC_COMMANDS.SIZE_NORMAL,
    encodeText("================================"),

    // CRITICAL: DiningTable Name prominently displayed
    ESC_COMMANDS.SIZE_DOUBLE_HEIGHT,
    encodeText(`>> الطاولة: ${options.tableName} <<`),
    ESC_COMMANDS.SIZE_NORMAL,
    options.orderNumber ? encodeText(`رقم الطلب: #${options.orderNumber}`) : new Uint8Array(),
    encodeText(`الوقت: ${timeStr}`),
    encodeText("--------------------------------"),

    // Items list
    ESC_COMMANDS.ALIGN_LEFT,
    ESC_COMMANDS.BOLD_ON,
    ...options.items.flatMap((item) => {
      const itemChunks: Uint8Array[] = [
        encodeText(`• ${item.quantity}x ${item.nameAr}`),
      ];
      if (item.notes) {
        itemChunks.push(
          ESC_COMMANDS.BOLD_OFF,
          encodeText(`   (ملاحظة: ${item.notes})`),
          ESC_COMMANDS.BOLD_ON
        );
      }
      return itemChunks;
    }),
    ESC_COMMANDS.BOLD_OFF,

    encodeText("--------------------------------"),
    options.notes ? encodeText(`ملاحظات عامة: ${options.notes}`) : new Uint8Array(),
    ESC_COMMANDS.ALIGN_CENTER,
    encodeText("================================"),
    encodeText("قسم المطبخ والمشويات"),
    ESC_COMMANDS.FEED_5_LINES,
    ESC_COMMANDS.FULL_CUT,
  ];

  return concatByteArrays(...chunks);
}

/**
 * 2. BARISTA PREPARATION TICKET
 * CRITICAL: Displays DiningTable name. NEVER sends cash drawer command.
 */
export function buildBaristaTicket(options: PrepTicketOptions): Uint8Array {
  const timeStr = (options.timestamp || new Date()).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const chunks: Uint8Array[] = [
    ESC_COMMANDS.INIT,
    ESC_COMMANDS.ALIGN_CENTER,
    ESC_COMMANDS.BOLD_ON,
    ESC_COMMANDS.SIZE_DOUBLE_WIDTH,
    encodeText("مشويات اولاد بسيوني - MASHWEYAT AWLAD BASIONY"),
    ESC_COMMANDS.SIZE_TITLE_LARGE,
    encodeText(`*** بون الباريستا والمشروبات ***`),
    ESC_COMMANDS.SIZE_NORMAL,
    encodeText("================================"),

    // CRITICAL: DiningTable Name prominently displayed
    ESC_COMMANDS.SIZE_DOUBLE_HEIGHT,
    encodeText(`>> الطاولة: ${options.tableName} <<`),
    ESC_COMMANDS.SIZE_NORMAL,
    options.orderNumber ? encodeText(`رقم الطلب: #${options.orderNumber}`) : new Uint8Array(),
    encodeText(`الوقت: ${timeStr}`),
    encodeText("--------------------------------"),

    // Drinks list
    ESC_COMMANDS.ALIGN_LEFT,
    ESC_COMMANDS.BOLD_ON,
    ...options.items.flatMap((item) => {
      const itemChunks: Uint8Array[] = [
        encodeText(`• ${item.quantity}x ${item.nameAr}`),
      ];
      if (item.notes) {
        itemChunks.push(
          ESC_COMMANDS.BOLD_OFF,
          encodeText(`   (ملاحظة: ${item.notes})`),
          ESC_COMMANDS.BOLD_ON
        );
      }
      return itemChunks;
    }),
    ESC_COMMANDS.BOLD_OFF,

    encodeText("--------------------------------"),
    options.notes ? encodeText(`ملاحظات: ${options.notes}`) : new Uint8Array(),
    ESC_COMMANDS.ALIGN_CENTER,
    encodeText("================================"),
    encodeText("قسم الباريستا والمشروبات الساخنة/الباردة"),
    ESC_COMMANDS.FEED_5_LINES,
    ESC_COMMANDS.FULL_CUT,
  ];

  return concatByteArrays(...chunks);
}

/**
 * 3. SHISHA PREPARATION TICKET
 * CRITICAL: Displays DiningTable name. NEVER sends cash drawer command.
 */
export function buildShishaTicket(options: PrepTicketOptions): Uint8Array {
  const timeStr = (options.timestamp || new Date()).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const chunks: Uint8Array[] = [
    ESC_COMMANDS.INIT,
    ESC_COMMANDS.ALIGN_CENTER,
    ESC_COMMANDS.BOLD_ON,
    ESC_COMMANDS.SIZE_DOUBLE_WIDTH,
    encodeText("مشويات اولاد بسيوني - MASHWEYAT AWLAD BASIONY"),
    ESC_COMMANDS.SIZE_TITLE_LARGE,
    encodeText(`*** بون الشيشة والمعسل ***`),
    ESC_COMMANDS.SIZE_NORMAL,
    encodeText("================================"),

    // CRITICAL: DiningTable Name prominently displayed
    ESC_COMMANDS.SIZE_DOUBLE_HEIGHT,
    encodeText(`>> الطاولة: ${options.tableName} <<`),
    ESC_COMMANDS.SIZE_NORMAL,
    options.orderNumber ? encodeText(`رقم الطلب: #${options.orderNumber}`) : new Uint8Array(),
    encodeText(`الوقت: ${timeStr}`),
    encodeText("--------------------------------"),

    // Shisha items list
    ESC_COMMANDS.ALIGN_LEFT,
    ESC_COMMANDS.BOLD_ON,
    ...options.items.flatMap((item) => {
      const itemChunks: Uint8Array[] = [
        encodeText(`• ${item.quantity}x ${item.nameAr}`),
      ];
      if (item.notes) {
        itemChunks.push(
          ESC_COMMANDS.BOLD_OFF,
          encodeText(`   (ملاحظة: ${item.notes})`),
          ESC_COMMANDS.BOLD_ON
        );
      }
      return itemChunks;
    }),
    ESC_COMMANDS.BOLD_OFF,

    encodeText("--------------------------------"),
    options.notes ? encodeText(`ملاحظات: ${options.notes}`) : new Uint8Array(),
    ESC_COMMANDS.ALIGN_CENTER,
    encodeText("================================"),
    encodeText("قسم ركن الشيشة والخدمة"),
    ESC_COMMANDS.FEED_5_LINES,
    ESC_COMMANDS.FULL_CUT,
  ];

  return concatByteArrays(...chunks);
}

/**
 * 4. CUSTOMER CHECK (فاتورة الحساب المبدئية للعميل)
 * Prints full order summary. NEVER opens the cash drawer.
 */
export function buildCustomerCheck(options: CustomerCheckOptions): Uint8Array {
  const timeStr = (options.timestamp || new Date()).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = (options.timestamp || new Date()).toLocaleDateString("ar-EG");

  const chunks: Uint8Array[] = [
    ESC_COMMANDS.INIT,
    ESC_COMMANDS.ALIGN_CENTER,
    ESC_COMMANDS.BOLD_ON,
    ESC_COMMANDS.SIZE_DOUBLE_WIDTH,
    encodeText("مشويات اولاد بسيوني - MASHWEYAT AWLAD BASIONY"),
    ESC_COMMANDS.SIZE_NORMAL,
    encodeText("طعم زمان على أصوله - مشويات وصواني وباريستا"),
    encodeText("شيك الحساب المبدئي (CUSTOMER CHECK)"),
    encodeText("================================"),

    ESC_COMMANDS.ALIGN_RIGHT,
    options.orderType === "DELIVERY"
      ? encodeText(">> نوع الطلب: دليفري (توصيل سريع) <<")
      : options.orderType === "TAKEAWAY"
      ? encodeText(">> نوع الطلب: سفري وتيك أواي <<")
      : encodeText(`الطاولة: ${options.tableName}`),
    options.customerName ? encodeText(`العميل: ${options.customerName}`) : new Uint8Array(),
    options.customerPhone ? encodeText(`الهاتف: ${options.customerPhone}`) : new Uint8Array(),
    options.deliveryAddress ? encodeText(`العنوان: ${options.deliveryAddress}`) : new Uint8Array(),
    options.orderNumber ? encodeText(`رقم الطلب: #${options.orderNumber}`) : new Uint8Array(),
    encodeText(`التاريخ: ${dateStr} - ${timeStr}`),
    options.cashierName ? encodeText(`الكاشير: ${options.cashierName}`) : new Uint8Array(),
    encodeText("--------------------------------"),

    // Items table header
    ESC_COMMANDS.BOLD_ON,
    encodeText(formatTwoColumns("الصنف", "الإجمالي (ج.م)")),
    encodeText("--------------------------------"),
    ESC_COMMANDS.BOLD_OFF,

    // Items list
    ...options.items.map((item) =>
      encodeText(
        formatTwoColumns(
          `${item.quantity}x ${item.nameAr}`,
          (item.price * item.quantity).toFixed(2)
        )
      )
    ),

    encodeText("--------------------------------"),
    ESC_COMMANDS.BOLD_ON,
    encodeText(formatTwoColumns("المجموع الفرعي:", `${options.subtotal.toFixed(2)} ج.م`)),

    options.deliveryFee && options.deliveryFee > 0
      ? encodeText(formatTwoColumns("رسوم التوصيل (خدمة):", `+${options.deliveryFee.toFixed(2)} ج.م`))
      : new Uint8Array(),

    options.isComplimentary
      ? encodeText(formatTwoColumns("خصم ضيافة (100%):", `-${(options.subtotal + (options.deliveryFee || 0)).toFixed(2)} ج.م`))
      : options.discount > 0
      ? encodeText(formatTwoColumns("الخصم:", `-${options.discount.toFixed(2)} ج.م`))
      : new Uint8Array(),

    ESC_COMMANDS.SIZE_DOUBLE_HEIGHT,
    encodeText(
      formatTwoColumns(
        "المبلغ المستحق:",
        options.isComplimentary ? "0.00 ج.م (ضيافة)" : `${options.totalAmount.toFixed(2)} ج.م`
      )
    ),
    ESC_COMMANDS.SIZE_NORMAL,
    ESC_COMMANDS.BOLD_OFF,

    encodeText("================================"),
    ESC_COMMANDS.ALIGN_CENTER,
    encodeText("خدمة التوصيل والطلبات: 01558962994"),
    encodeText("عبد القادر - جامع السلام - المستعمرة"),
    encodeText("شكراً لزيارتكم مشويات اولاد بسيوني"),
    ESC_COMMANDS.FEED_5_LINES,
    ESC_COMMANDS.FULL_CUT,
  ];

  return concatByteArrays(...chunks);
}

/**
 * 5. FINAL PAYMENT RECEIPT (فاتورة السداد الضريبية)
 * Printed on "Collect Payment".
 * Optional: Can be combined with Drawer Kick command.
 */
export function buildPaymentReceipt(
  options: CustomerCheckOptions,
  includeDrawerKick = true
): Uint8Array {
  const timeStr = (options.timestamp || new Date()).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = (options.timestamp || new Date()).toLocaleDateString("ar-EG");

  const chunks: Uint8Array[] = [];

  // CRITICAL REQUIREMENT 2: Open cash drawer if explicitly requested during payment
  if (includeDrawerKick) {
    chunks.push(buildCashDrawerKickCommand());
  }

  chunks.push(
    ESC_COMMANDS.INIT,
    ESC_COMMANDS.ALIGN_CENTER,
    ESC_COMMANDS.BOLD_ON,
    ESC_COMMANDS.SIZE_DOUBLE_WIDTH,
    encodeText("مشويات اولاد بسيوني - MASHWEYAT AWLAD BASIONY"),
    ESC_COMMANDS.SIZE_NORMAL,
    encodeText("طعم زمان على أصوله - فاتورة سداد نقدي"),
    encodeText("================================"),

    ESC_COMMANDS.ALIGN_RIGHT,
    options.orderType === "DELIVERY"
      ? encodeText(">> طلب دليفري (توصيل منازل) <<")
      : options.orderType === "TAKEAWAY"
      ? encodeText(">> طلب سفري (تيك أواي) <<")
      : encodeText(`الطاولة: ${options.tableName}`),
    options.customerName ? encodeText(`العميل: ${options.customerName}`) : new Uint8Array(),
    options.customerPhone ? encodeText(`الهاتف: ${options.customerPhone}`) : new Uint8Array(),
    options.deliveryAddress ? encodeText(`العنوان: ${options.deliveryAddress}`) : new Uint8Array(),
    options.orderNumber ? encodeText(`رقم الفاتورة: #${options.orderNumber}`) : new Uint8Array(),
    encodeText(`التاريخ: ${dateStr} - ${timeStr}`),
    options.cashierName ? encodeText(`الكاشير: ${options.cashierName}`) : new Uint8Array(),
    encodeText("حالة السداد: مدفوع بالكامل (PAID) ✓"),
    encodeText("--------------------------------"),

    // Items table header
    ESC_COMMANDS.BOLD_ON,
    encodeText(formatTwoColumns("الصنف", "السعر")),
    encodeText("--------------------------------"),
    ESC_COMMANDS.BOLD_OFF,

    ...options.items.map((item) =>
      encodeText(
        formatTwoColumns(
          `${item.quantity}x ${item.nameAr}`,
          (item.price * item.quantity).toFixed(2)
        )
      )
    ),

    encodeText("--------------------------------"),
    ESC_COMMANDS.BOLD_ON,
    encodeText(formatTwoColumns("المجموع الفرعي:", `${options.subtotal.toFixed(2)} ج.م`)),

    options.deliveryFee && options.deliveryFee > 0
      ? encodeText(formatTwoColumns("رسوم التوصيل:", `+${options.deliveryFee.toFixed(2)} ج.م`))
      : new Uint8Array(),

    options.isComplimentary
      ? encodeText(formatTwoColumns("إعفاء ضيافة:", `-${(options.subtotal + (options.deliveryFee || 0)).toFixed(2)} ج.م`))
      : options.discount > 0
      ? encodeText(formatTwoColumns("الخصم:", `-${options.discount.toFixed(2)} ج.م`))
      : new Uint8Array(),

    ESC_COMMANDS.SIZE_DOUBLE_HEIGHT,
    encodeText(
      formatTwoColumns(
        "المدفوع نقداً:",
        options.isComplimentary ? "0.00 ج.م" : `${options.totalAmount.toFixed(2)} ج.م`
      )
    ),
    ESC_COMMANDS.SIZE_NORMAL,
    ESC_COMMANDS.BOLD_OFF,

    encodeText("================================"),
    ESC_COMMANDS.ALIGN_CENTER,
    encodeText("تم تحصيل المبلغ وفتح درج النقدية"),
    encodeText("خدمة التوصيل: 01558962994"),
    encodeText("عبد القادر - جامع السلام - المستعمرة"),
    encodeText("نتشرف بزيارتكم دائماً!"),
    ESC_COMMANDS.FEED_5_LINES,
    ESC_COMMANDS.FULL_CUT
  );

  return concatByteArrays(...chunks);
}
