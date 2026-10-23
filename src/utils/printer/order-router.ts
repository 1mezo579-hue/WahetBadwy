/**
 * Order Routing Engine for Mashweyat Awlad Basiony POS
 * Routes items to Kitchen, Barista, and Shisha stations, and generates tickets.
 */

import {
  TicketItem,
  buildKitchenTicket,
  buildBaristaTicket,
  buildShishaTicket,
  buildCustomerCheck,
  buildPaymentReceipt,
} from "./escpos";
import { serialPrinter } from "./web-serial";

export type DepartmentType = "KITCHEN" | "BARISTA" | "SHISHA";

export interface RoutedTicket {
  id: string;
  type: DepartmentType | "CUSTOMER_CHECK" | "PAYMENT_RECEIPT";
  title: string;
  badgeColor: string;
  tableName: string;
  orderNumber?: number;
  items: TicketItem[];
  rawBytes: Uint8Array;
  notes?: string;
  timestamp: Date;
}

/**
 * Intelligent Department Detector based on item & category names
 */
export function getItemDepartment(item: {
  nameAr: string;
  categoryName?: string;
}): DepartmentType {
  const text = `${item.nameAr} ${item.categoryName || ""}`.toLowerCase();

  // 1. Shisha Department
  const shishaKeywords = [
    "شيشة",
    "معسل",
    "سلوم",
    "قص",
    "تفاحتين",
    "عنب",
    "فحم",
    "shisha",
    "hookah",
  ];
  if (shishaKeywords.some((kw) => text.includes(kw))) {
    return "SHISHA";
  }

  // 2. Barista & Beverages Department
  const baristaKeywords = [
    "شاي",
    "قهوة",
    "إسبريسو",
    "اسبريسو",
    "لاتيه",
    "كابتشينو",
    "مشروب",
    "عصير",
    "كوكتيل",
    "موهيتو",
    "باريستا",
    "مياه",
    "بيبسي",
    "سفن",
    "كولا",
    "barista",
    "coffee",
    "tea",
    "latte",
    "drink",
  ];
  if (baristaKeywords.some((kw) => text.includes(kw))) {
    return "BARISTA";
  }

  // 3. Default: Kitchen & Grills Department
  return "KITCHEN";
}

export interface RoutePrepOrderInput {
  tableName: string;
  orderNumber?: number;
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  items: Array<TicketItem & { categoryName?: string }>;
  subtotal: number;
  discount: number;
  totalAmount: number;
  isComplimentary: boolean;
  notes?: string;
  cashierName?: string;
  includeCustomerCheck?: boolean;
}

/**
 * SPRINT 4 REQUIREMENT 1: Order routing logic triggered by "Send to Prep"
 * - Generates dedicated Kitchen Ticket for kitchen items.
 * - Generates dedicated Barista Ticket for barista items.
 * - Generates dedicated Shisha Ticket for shisha items.
 * - Generates Customer Check.
 * - CRITICAL: Every prep ticket displays DiningTable name.
 * - CRITICAL: NONE of these tickets open the cash drawer.
 */
export async function routeAndPrintPrepOrder(
  input: RoutePrepOrderInput
): Promise<{
  success: boolean;
  tickets: RoutedTicket[];
  printResults: Array<{ title: string; success: boolean }>;
}> {
  const timestamp = new Date();
  const tickets: RoutedTicket[] = [];

  // Group items by department
  const kitchenItems: TicketItem[] = [];
  const baristaItems: TicketItem[] = [];
  const shishaItems: TicketItem[] = [];

  for (const item of input.items) {
    const dept = getItemDepartment(item);
    if (dept === "KITCHEN") kitchenItems.push(item);
    else if (dept === "BARISTA") baristaItems.push(item);
    else if (dept === "SHISHA") shishaItems.push(item);
  }

  // 1. Kitchen Ticket (if has food items)
  if (kitchenItems.length > 0) {
    const rawBytes = buildKitchenTicket({
      departmentTitle: "المطبخ",
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      items: kitchenItems,
      notes: input.notes,
      timestamp,
    });

    tickets.push({
      id: "ticket-kitchen",
      type: "KITCHEN",
      title: "بون المطبخ (Kitchen Ticket)",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      items: kitchenItems,
      rawBytes,
      notes: input.notes,
      timestamp,
    });
  }

  // 2. Barista Ticket (if has beverage items)
  if (baristaItems.length > 0) {
    const rawBytes = buildBaristaTicket({
      departmentTitle: "الباريستا",
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      items: baristaItems,
      notes: input.notes,
      timestamp,
    });

    tickets.push({
      id: "ticket-barista",
      type: "BARISTA",
      title: "بون الباريستا (Barista Ticket)",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      items: baristaItems,
      rawBytes,
      notes: input.notes,
      timestamp,
    });
  }

  // 3. Shisha Ticket (if has shisha items)
  if (shishaItems.length > 0) {
    const rawBytes = buildShishaTicket({
      departmentTitle: "الشيشة",
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      items: shishaItems,
      notes: input.notes,
      timestamp,
    });

    tickets.push({
      id: "ticket-shisha",
      type: "SHISHA",
      title: "بون الشيشة (Shisha Ticket)",
      badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      items: shishaItems,
      rawBytes,
      notes: input.notes,
      timestamp,
    });
  }

  // 4. Customer Check:
  // For DINE_IN (الصالة), customer check must NOT be printed during initial prep!
  // It only prints upon "تقفيل الشيك" (closing the check).
  const shouldIncludeCheck =
    input.includeCustomerCheck ?? (input.orderType !== "DINE_IN");

  if (shouldIncludeCheck) {
    const customerCheckBytes = buildCustomerCheck({
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      orderType: input.orderType,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      deliveryAddress: input.deliveryAddress,
      deliveryFee: input.deliveryFee,
      items: input.items,
      subtotal: input.subtotal,
      discount: input.discount,
      totalAmount: input.totalAmount,
      isComplimentary: input.isComplimentary,
      notes: input.notes,
      timestamp,
      cashierName: input.cashierName,
    });

    tickets.push({
      id: "ticket-customer-check",
      type: "CUSTOMER_CHECK",
      title: "شيك العميل المبدئي (Customer Check)",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      items: input.items,
      rawBytes: customerCheckBytes,
      notes: input.notes,
      timestamp,
    });
  }

  // Send raw bytes to hardware printer via Web Serial (NO cash drawer kick!)
  const printResults: Array<{ title: string; success: boolean }> = [];
  for (const ticket of tickets) {
    const res = await serialPrinter.sendRaw(ticket.rawBytes);
    printResults.push({
      title: ticket.title,
      success: res.success,
    });
  }

  return {
    success: true,
    tickets,
    printResults,
  };
}

/**
 * تقفيل الشيك لطاولة الصالة: طباعة شيك / فاتورة العميل فقط (بدون فتح الدرج)
 */
export async function printCustomerCheckOnly(
  input: RoutePrepOrderInput
): Promise<{
  success: boolean;
  checkTicket: RoutedTicket;
}> {
  const timestamp = new Date();
  const customerCheckBytes = buildCustomerCheck({
    tableName: input.tableName,
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deliveryAddress: input.deliveryAddress,
    deliveryFee: input.deliveryFee,
    items: input.items,
    subtotal: input.subtotal,
    discount: input.discount,
    totalAmount: input.totalAmount,
    isComplimentary: input.isComplimentary,
    notes: input.notes,
    timestamp,
    cashierName: input.cashierName,
  });

  const checkTicket: RoutedTicket = {
    id: "ticket-customer-check",
    type: "CUSTOMER_CHECK",
    title: "شيك العميل (Customer Check)",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    tableName: input.tableName,
    orderNumber: input.orderNumber,
    items: input.items,
    rawBytes: customerCheckBytes,
    notes: input.notes,
    timestamp,
  };

  // Send to serial printer without kicking drawer
  await serialPrinter.sendRaw(customerCheckBytes);

  return {
    success: true,
    checkTicket,
  };
}

/**
 * SPRINT 4 REQUIREMENT 2: Cash drawer logic triggered by "Collect Payment"
 * - Kicks open the cash drawer via ESC/POS command (0x1B 0x70 0x00 0x19 0xFA).
 * - DRAWER MUST ONLY OPEN ON THIS ACTION.
 * - Prints final tax receipt.
 */
export async function executePaymentAndOpenDrawer(
  input: RoutePrepOrderInput
): Promise<{
  success: boolean;
  drawerOpened: boolean;
  receiptTicket: RoutedTicket;
}> {
  const timestamp = new Date();

  // 1. CRITICAL: Trigger Cash Drawer Kick
  const drawerRes = await serialPrinter.kickDrawer();

  // 2. Build final paid customer receipt
  const rawBytes = buildPaymentReceipt(
    {
      tableName: input.tableName,
      orderNumber: input.orderNumber,
      orderType: input.orderType,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      deliveryAddress: input.deliveryAddress,
      deliveryFee: input.deliveryFee,
      items: input.items,
      subtotal: input.subtotal,
      discount: input.discount,
      totalAmount: input.totalAmount,
      isComplimentary: input.isComplimentary,
      notes: input.notes,
      timestamp,
      cashierName: input.cashierName,
    },
    false // Drawer already kicked in step 1
  );

  const receiptTicket: RoutedTicket = {
    id: "ticket-payment-receipt",
    type: "PAYMENT_RECEIPT",
    title: "فاتورة سداد نقدي (Paid Customer Receipt)",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
    tableName: input.tableName,
    orderNumber: input.orderNumber,
    items: input.items,
    rawBytes,
    notes: input.notes,
    timestamp,
  };

  // 3. Print receipt over Web Serial
  await serialPrinter.sendRaw(rawBytes);

  return {
    success: true,
    drawerOpened: drawerRes.success,
    receiptTicket,
  };
}
