/**
 * Silent Printing Engine for Mashweyat Basiony POS
 * Prints directly to Thermal Printers (80mm & 58mm compatible).
 * Zero-dialog instant printing in Chrome/Edge Kiosk mode (--kiosk-printing).
 * RTL Arabic text layout with crisp connected Cairo typography.
 */

export interface ThermalReceiptItem {
  nameAr: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface ThermalReceiptOptions {
  title?: string;
  receiptType?: "CHECK" | "RECEIPT" | "PREP" | "Z_REPORT" | "GRILL_KITCHEN" | "GRILL_HANDOVER" | "REPRINT";
  tableName: string;
  orderNumber?: number | string;
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | "CUSTOMER_GRILL" | string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  items: ThermalReceiptItem[];
  subtotal?: number;
  discount?: number;
  totalAmount?: number;
  isComplimentary?: boolean;
  notes?: string;
  timestamp?: Date | string;
  cashierName?: string;
  isPaid?: boolean;
  paymentMethod?: "CASH" | "CARD" | "WALLET" | string;
  amountPaid?: number;
  changeAmount?: number;
  isReprint?: boolean;
  reprintCount?: number;
  orderKind?: "NORMAL" | "CUSTOMER_GRILL";
  meatType?: string;
  customerMeatWeight?: number;
  cookedWeight?: number;
  grillingFee?: number;
  expectedPickupTime?: string;
  receivedBy?: string;
  deliveredBy?: string;
  packageCount?: number;
}

/**
 * Builds high-contrast, clean 80mm/58mm thermal receipt HTML for Customer Bills & Payments
 */
export function buildThermalReceiptHtml(options: ThermalReceiptOptions): string {
  const ts = options.timestamp ? new Date(options.timestamp) : new Date();
  const dateStr = ts.toLocaleDateString("ar-EG");
  const timeStr = ts.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const orderTypeArabic =
    options.orderType === "DELIVERY"
      ? "🛵 طلب دليفري (توصيل)"
      : options.orderType === "TAKEAWAY"
      ? "🛍️ طلب تيك أواي (سفري)"
      : options.orderType === "CUSTOMER_GRILL"
      ? "🔥 خدمة شوي للغير"
      : "🪑 صالة داخلي (Dine-In)";

  const paymentMethodArabic =
    options.paymentMethod === "CARD"
      ? "💳 بطاقة بنكية / فيزا"
      : options.paymentMethod === "WALLET"
      ? "📱 محفظة إلكترونية"
      : "💵 سداد نقدي (كاش)";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة - ${options.tableName}</title>
  <style>
    @page {
      margin: 0;
      size: 80mm auto;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      width: 100%;
      max-width: 76mm;
      margin: 0 auto;
      padding: 3mm 1.5mm 4mm 1.5mm;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.35;
      direction: rtl;
      text-align: right;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .font-mono { font-family: 'Consolas', 'Courier New', monospace; }
    
    .brand-title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: -0.5px;
      margin-bottom: 1px;
    }
    .brand-sub {
      font-size: 10px;
      color: #222;
      margin-bottom: 2px;
    }
    .brand-contact {
      font-size: 8.5px;
      color: #333;
      margin-bottom: 4px;
      line-height: 1.25;
    }
    .dashed-divider {
      border-top: 1px dashed #000;
      margin: 4px 0;
    }
    .double-divider {
      border-top: 2px solid #000;
      border-bottom: 1px solid #000;
      height: 3px;
      margin: 4px 0;
    }
    .reprint-banner {
      border: 2px solid #000;
      background: #f0f0f0;
      text-align: center;
      padding: 3px 2px;
      font-size: 11px;
      font-weight: 900;
      margin: 3px 0;
    }
    .ticket-type-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 900;
      border: 1.5px solid #000;
      border-radius: 4px;
      margin: 3px 0;
    }
    .table-box {
      border: 1.5px solid #000;
      padding: 3px;
      border-radius: 4px;
      margin: 3px 0;
      text-align: center;
      background: #fafafa;
    }
    .table-name {
      font-size: 13px;
      font-weight: 900;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      margin-bottom: 1.5px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 3px 0;
      font-size: 10.5px;
    }
    table.items-table th {
      border-bottom: 1.5px solid #000;
      padding: 3px 1px;
      font-size: 10px;
      font-weight: 900;
    }
    table.items-table td {
      padding: 3.5px 1px;
      vertical-align: top;
      border-bottom: 1px dotted #ddd;
    }
    .item-notes {
      font-size: 8.5px;
      color: #333;
      padding-right: 6px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      padding: 1.5px 0;
    }
    .grand-total {
      font-size: 14px;
      font-weight: 900;
      padding: 3px 0;
      border-top: 1.5px dashed #000;
      border-bottom: 1.5px dashed #000;
      margin: 3px 0;
    }
    .footer-text {
      font-size: 8.5px;
      text-align: center;
      margin-top: 6px;
      color: #333;
    }
    @media print {
      body { width: 100%; margin: 0; padding: 2mm 1mm; }
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="brand-title">مشويات بسيوني – MASHWEYAT BASIONY</div>
    <div class="brand-sub">إدارة: أ/ أحمد بسيوني • طعم زمان على أصوله</div>
    <div class="brand-contact">عبدالقادر - شارع المستعمرة أمام شارع 10 قبل مسجد السلام • هاتف: 01038029714</div>
    
    ${options.isReprint || (options.reprintCount && options.reprintCount > 0) ? `
      <div class="reprint-banner">
        *** نسخة طبق الأصل (معاد طباعتها #${options.reprintCount || 1}) ***
      </div>
    ` : ""}

    <div class="dashed-divider"></div>
    <div class="ticket-type-badge">
      ${options.title || (options.isPaid ? "فاتورة سداد ضريبي (PAID INVOICE)" : "شيك حساب العميل (CUSTOMER CHECK)")}
    </div>
  </div>

  <div class="table-box">
    <div style="font-size: 9.5px; font-weight: bold;">الجهة / الطاولة:</div>
    <div class="table-name">${options.tableName}</div>
    ${options.orderNumber ? `<div style="font-size: 11px; font-weight: 900; font-family: monospace;">رقم الفاتورة: #${options.orderNumber}</div>` : ""}
  </div>

  <div class="meta-row">
    <span>نوع الطلب: <strong>${orderTypeArabic}</strong></span>
    <span>التاريخ: <strong class="font-mono">${dateStr}</strong></span>
  </div>
  <div class="meta-row">
    <span>الكاشير: <strong>${options.cashierName || "admin"}</strong></span>
    <span>الوقت: <strong class="font-mono">${timeStr}</strong></span>
  </div>

  ${options.customerName ? `
  <div class="dashed-divider"></div>
  <div class="meta-row"><span>العميل:</span><strong>${options.customerName}</strong></div>
  ${options.customerPhone ? `<div class="meta-row"><span>الهاتف:</span><strong class="font-mono">${options.customerPhone}</strong></div>` : ""}
  ${options.deliveryAddress ? `<div class="meta-row"><span>العنوان:</span><span>${options.deliveryAddress}</span></div>` : ""}
  ` : ""}

  <div class="double-divider"></div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="text-right" style="width: 52%;">الصنف</th>
        <th class="text-center" style="width: 14%;">الكمية</th>
        <th class="text-center" style="width: 17%;">السعر</th>
        <th class="text-left" style="width: 17%;">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${options.items.map((item) => `
        <tr>
          <td class="text-right">
            <span class="font-bold">${item.nameAr}</span>
            ${item.notes ? `<div class="item-notes">└ ${item.notes}</div>` : ""}
          </td>
          <td class="text-center font-mono font-bold">${item.quantity}</td>
          <td class="text-center font-mono">${item.price.toFixed(2)}</td>
          <td class="text-left font-mono font-bold">${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="double-divider"></div>

  <!-- Financial Totals -->
  <div class="totals-row">
    <span>المجموع الجزئي:</span>
    <span class="font-mono font-bold">${(options.subtotal ?? 0).toFixed(2)} ج.م</span>
  </div>

  ${options.discount && options.discount > 0 ? `
  <div class="totals-row" style="color: #900;">
    <span>الخصم الممنوح:</span>
    <span class="font-mono font-bold">-${options.discount.toFixed(2)} ج.م</span>
  </div>
  ` : ""}

  ${options.deliveryFee && options.deliveryFee > 0 ? `
  <div class="totals-row">
    <span>خدمة التوصيل:</span>
    <span class="font-mono font-bold">+${options.deliveryFee.toFixed(2)} ج.م</span>
  </div>
  ` : ""}

  ${options.isComplimentary ? `
  <div class="totals-row" style="font-weight: 900; color: #006600;">
    <span>ضيافة إدارة (Complimentary):</span>
    <span class="font-mono">100% خصم</span>
  </div>
  ` : ""}

  <div class="totals-row grand-total">
    <span>الصافي المطلوب سداده:</span>
    <span class="font-mono">${(options.totalAmount ?? 0).toFixed(2)} ج.م</span>
  </div>

  <!-- Payment Details -->
  ${options.isPaid ? `
  <div class="totals-row">
    <span>طريقة السداد:</span>
    <span class="font-bold">${paymentMethodArabic}</span>
  </div>
  ${options.amountPaid !== undefined && options.amountPaid > 0 ? `
  <div class="totals-row">
    <span>المبلغ المدفوع:</span>
    <span class="font-mono font-bold">${options.amountPaid.toFixed(2)} ج.م</span>
  </div>
  ` : ""}
  ${options.changeAmount !== undefined && options.changeAmount > 0 ? `
  <div class="totals-row" style="font-weight: 900; color: #007700;">
    <span>المتبقي للعميل (الباقي):</span>
    <span class="font-mono">${options.changeAmount.toFixed(2)} ج.م</span>
  </div>
  ` : ""}
  ` : ""}

  <div class="dashed-divider"></div>

  <div class="text-center" style="margin: 3px 0; font-weight: 900; font-size: 11px;">
    ${options.isPaid ? "✓ تم استلام المبلغ بنجاح وطباعة الفاتورة" : "⏳ شيك غير مسدد - يرجى السداد عند الكاشير"}
  </div>

  ${options.notes ? `
  <div style="font-size: 9.5px; margin-top: 3px; padding: 2px 4px; border: 1px dashed #666; border-radius: 3px;">
    <strong>ملاحظة الطلب:</strong> ${options.notes}
  </div>
  ` : ""}

  <div class="footer-text">
    <div>شكراً لزيارتكم مشويات بسيوني • نسعد بخدمتكم دائماً</div>
    <div class="font-mono" style="font-size: 7.5px; margin-top: 2px;">نظام كاشير مشويات بسيوني السحابي v2.6</div>
  </div>
</body>
</html>`;
}

/**
 * Builds Kitchen Prep Ticket (بون المطبخ والشواية لتجهيز الطعام)
 * Clean, big quantities, items, instructions. NO prices or financial totals.
 */
export function buildKitchenPrepTicketHtml(options: ThermalReceiptOptions): string {
  const ts = options.timestamp ? new Date(options.timestamp) : new Date();
  const dateStr = ts.toLocaleDateString("ar-EG");
  const timeStr = ts.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  const orderTypeArabic =
    options.orderType === "DELIVERY"
      ? "🛵 طلب دليفري (توصيل)"
      : options.orderType === "TAKEAWAY"
      ? "🛍️ طلب تيك أواي (سفري)"
      : "🪑 صالة داخلي (Dine-In)";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>بون المطبخ - #${options.orderNumber || "---"}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      width: 100%;
      max-width: 76mm;
      margin: 0 auto;
      padding: 3mm 2mm 5mm 2mm;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.35;
      direction: rtl;
      text-align: right;
    }
    .text-center { text-align: center; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 13px;
      font-weight: 900;
      border: 2px solid #000;
      border-radius: 4px;
      margin: 3px 0;
    }
    .order-box {
      border: 2px solid #000;
      background: #000;
      color: #fff;
      padding: 4px;
      text-align: center;
      border-radius: 4px;
      margin: 4px 0;
    }
    .table-name { font-size: 14px; font-weight: 900; }
    .order-number { font-size: 18px; font-weight: 900; font-family: monospace; letter-spacing: 1px; }
    .divider { border-top: 1.5px dashed #000; margin: 4px 0; }
    table.prep-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    table.prep-table th { border-bottom: 2px solid #000; padding: 3px 2px; font-size: 11px; font-weight: 900; }
    table.prep-table td { padding: 5px 2px; border-bottom: 1px dashed #ccc; vertical-align: top; }
    .item-qty { font-size: 16px; font-weight: 900; font-family: monospace; text-align: center; width: 42px; background: #eee; border-radius: 3px; }
    .item-name { font-size: 13px; font-weight: 900; }
    .item-notes { font-size: 9.5px; font-weight: bold; color: #222; margin-top: 2px; }
    @media print {
      body { width: 100%; margin: 0; padding: 2mm 1mm; }
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div style="font-size: 14px; font-weight: 900;">مشويات بسيوني – MASHWEYAT BASIONY</div>
    <div class="badge">👨‍🍳 بون تجهيز المطبخ والشواية 👨‍🍳</div>
  </div>

  <div class="order-box">
    <div class="table-name">${options.tableName}</div>
    <div class="order-number">طلب #${options.orderNumber || "---"}</div>
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 10px; margin: 3px 0;">
    <span>نوع الطلب: <strong>${orderTypeArabic}</strong></span>
    <span>الوقت: <strong style="font-family: monospace;">${timeStr}</strong></span>
  </div>
  <div style="display: flex; justify-content: space-between; font-size: 10px;">
    <span>الكاشير: <strong>${options.cashierName || "الكاشير"}</strong></span>
    <span>التاريخ: <strong style="font-family: monospace;">${dateStr}</strong></span>
  </div>

  <div class="divider"></div>

  <table class="prep-table">
    <thead>
      <tr>
        <th style="width: 25%; text-align: center;">الكمية</th>
        <th style="width: 75%; text-align: right;">الصنف والتعليمات</th>
      </tr>
    </thead>
    <tbody>
      ${options.items.map(item => `
        <tr>
          <td class="item-qty">${item.quantity}</td>
          <td>
            <div class="item-name">${item.nameAr}</div>
            ${item.notes ? `<div class="item-notes">⚠️ ${item.notes}</div>` : ""}
          </td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  ${options.notes ? `
  <div class="divider"></div>
  <div style="border: 2px solid #000; padding: 4px; font-size: 11px; margin-top: 3px; border-radius: 4px; background: #fffde7;">
    <strong>ملاحظة عامة على الطلب:</strong><br>
    ${options.notes}
  </div>
  ` : ""}

  <div class="divider"></div>
  <div class="text-center" style="font-size: 8.5px; margin-top: 4px;">
    تذكرة تشغيل داخلية للمطبخ • لا يتم تحصيل أموال بموجب هذه التذكرة
  </div>
</body>
</html>`;
}

/**
 * Builds Kitchen Grill Ticket for Customer Meat ("شوي للغير")
 * Prominently warns kitchen staff that materials belong to customer.
 */
export function buildGrillingKitchenTicketHtml(options: ThermalReceiptOptions): string {
  const ts = options.timestamp ? new Date(options.timestamp) : new Date();
  const dateStr = ts.toLocaleDateString("ar-EG");
  const timeStr = ts.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  const rawWeightKg = ((options.customerMeatWeight || 0) / 1000).toFixed(2);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>بون الشواية - خامات العميل</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      width: 100%;
      max-width: 76mm;
      margin: 0 auto;
      padding: 3mm 2mm 5mm 2mm;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.35;
      direction: rtl;
      text-align: right;
    }
    .text-center { text-align: center; }
    .warning-box {
      border: 2px dashed #000;
      background: #fff8e1;
      padding: 4px;
      margin: 5px 0;
      text-align: center;
      font-weight: 900;
      font-size: 11px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 13px;
      font-weight: 900;
      border: 2px solid #000;
      border-radius: 4px;
      margin: 3px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 11px;
      border-bottom: 1px dotted #ccc;
    }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    @media print {
      body { width: 100%; margin: 0; padding: 2mm 1mm; }
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div style="font-size: 14px; font-weight: 900;">مشويات بسيوني - MASHWEYAT BASIONY</div>
    <div class="badge">🔥 بون الشواية والمطبخ (خامات العميل) 🔥</div>
    ${options.reprintCount && options.reprintCount > 0 ? `<div style="font-weight: 900; color: #b00; margin: 2px 0;">*** نسخة معاد طباعتها #${options.reprintCount} ***</div>` : ""}
    <div style="font-size: 10px;">رقم الطلب: #${options.orderNumber || "---"} | ${dateStr} - ${timeStr}</div>
  </div>

  <div class="warning-box">
    ⚠️ تنبيه رقابي للمطبخ والشواية ⚠️<br>
    الخامات ملك للعميل • ممنوع خصمها من مخزون المطعم أو احتساب قيمتها كمبيعات!
  </div>

  <div class="detail-row">
    <span>اسم العميل:</span>
    <strong style="font-size: 13px;">${options.customerName || "عميل خارجي"}</strong>
  </div>
  ${options.customerPhone ? `<div class="detail-row"><span>الهاتف:</span><strong style="font-family: monospace;">${options.customerPhone}</strong></div>` : ""}
  
  <div class="detail-row">
    <span>نوع اللحم / الخامة:</span>
    <strong style="font-size: 13px; color: #b00;">${options.meatType || "مشويات مشكلة"}</strong>
  </div>

  <div class="detail-row" style="background: #f0f0f0; padding: 4px;">
    <span>الوزن النيء المستلم:</span>
    <strong style="font-size: 14px;">${options.customerMeatWeight || 0} جم (${rawWeightKg} كجم)</strong>
  </div>

  ${options.cookedWeight && options.cookedWeight > 0 ? `
  <div class="detail-row" style="background: #e8f5e9; padding: 4px;">
    <span>الوزن بعد التسوية:</span>
    <strong style="font-size: 13px; color: #006600;">${options.cookedWeight} جم (انكماش: ${Math.max(0, (options.customerMeatWeight || 0) - options.cookedWeight)} جم)</strong>
  </div>
  ` : ""}

  <div class="detail-row">
    <span>موعد التسليم المتوقع:</span>
    <strong style="font-size: 12px; color: #000;">${options.expectedPickupTime || "حسب الجاهزية"}</strong>
  </div>

  <div class="detail-row">
    <span>الموظف المستلم:</span>
    <strong>${options.receivedBy || options.cashierName || "كاشير"}</strong>
  </div>

  ${options.notes ? `
  <div class="divider"></div>
  <div style="padding: 4px; background: #fffde7; border: 1px solid #000; border-radius: 4px; margin-top: 3px;">
    <strong>تعليمات الشوي والتتبيل:</strong><br>
    ${options.notes}
  </div>
  ` : ""}

  <div class="divider"></div>
  <div class="text-center" style="font-size: 8.5px; margin-top: 4px;">
    قسم الشواية والمطبخ • مشويات بسيوني
  </div>
</body>
</html>`;
}

/**
 * Builds Handover & Packaging Slip for Customer Grilling
 */
export function buildGrillingHandoverTicketHtml(options: ThermalReceiptOptions): string {
  const ts = options.timestamp ? new Date(options.timestamp) : new Date();
  const dateStr = ts.toLocaleDateString("ar-EG");
  const timeStr = ts.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>بون تسليم المشويات</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      width: 100%;
      max-width: 76mm;
      margin: 0 auto;
      padding: 3mm 2mm 5mm 2mm;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.35;
      direction: rtl;
      text-align: right;
    }
    .text-center { text-align: center; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 900;
      border: 1.5px solid #000;
      border-radius: 4px;
      margin: 3px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 11px;
      border-bottom: 1px dotted #ccc;
    }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .sign-box {
      border: 1px solid #999;
      padding: 5px;
      margin-top: 6px;
      text-align: center;
      font-size: 9.5px;
    }
    @media print {
      body { width: 100%; margin: 0; padding: 2mm 1mm; }
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div style="font-size: 14px; font-weight: 900;">مشويات بسيوني – MASHWEYAT BASIONY</div>
    <div class="badge">📦 بون التسليم والتغليف (خامات العميل) 📦</div>
    <div style="font-size: 10px;">رقم الطلب: #${options.orderNumber || "---"} | ${dateStr} - ${timeStr}</div>
  </div>

  <div class="divider"></div>

  <div class="detail-row">
    <span>اسم العميل:</span>
    <strong style="font-size: 12px;">${options.customerName || "عميل خارجي"}</strong>
  </div>
  ${options.customerPhone ? `<div class="detail-row"><span>رقم الهاتف:</span><strong style="font-family: monospace;">${options.customerPhone}</strong></div>` : ""}
  
  <div class="detail-row">
    <span>نوع المشويات:</span>
    <strong>${options.meatType || "مشويات"}</strong>
  </div>

  <div class="detail-row">
    <span>الوزن النيء المسجل:</span>
    <strong>${options.customerMeatWeight || 0} جم</strong>
  </div>

  <div class="detail-row">
    <span>عدد العلب / الشنط:</span>
    <strong style="font-size: 13px;">${options.packageCount || 1} علبة</strong>
  </div>

  <div class="detail-row">
    <span>وقت التسليم المتوقع:</span>
    <strong>${options.expectedPickupTime || "---"}</strong>
  </div>

  <div class="detail-row">
    <span>الموظف المستلم:</span>
    <span>${options.receivedBy || "الكاشير"}</span>
  </div>

  <div class="sign-box">
    توقيع الكاشير المسلّم: ............................<br><br>
    توقيع العميل المستلم: ............................
  </div>

  <div class="divider"></div>
  <div class="text-center" style="font-size: 8.5px; margin-top: 4px;">
    مشويات بسيوني • عبدالقادر شارع المستعمرة • 01038029714
  </div>
</body>
</html>`;
}

/**
 * Builds clean 80mm Z-Report (Daily Closing / End of Shift) Thermal Print HTML
 */
export function buildZReportHtml(reportData: any, cashierName?: string): string {
  const stats = reportData?.stats || reportData || {};
  const effectiveCashierName = cashierName || reportData?.cashierName || stats?.cashierName || "الكاشير";
  const dateStr = new Date().toLocaleDateString("ar-EG");
  const timeStr = new Date().toLocaleTimeString("ar-EG");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير تقفيل الوردية Z-Report</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      width: 100%;
      max-width: 76mm;
      margin: 0 auto;
      padding: 4mm 2mm 8mm 2mm;
      font-size: 11px;
      direction: rtl;
    }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .font-mono { font-family: 'Consolas', monospace; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .highlight { font-size: 13px; font-weight: 900; background: #eee; padding: 3px 2px; }
    @media print {
      body { width: 100%; margin: 0; padding: 2mm 1mm; }
    }
  </style>
</head>
<body>
  <div class="text-center font-bold" style="font-size: 15px;">مشويات بسيوني - تقفيل الوردية</div>
  <div class="text-center" style="font-size: 10px;">Z-Report • جرد وحساب الدرج</div>
  <div class="divider"></div>
  <div class="row"><span>التاريخ:</span><span class="font-mono">${dateStr}</span></div>
  <div class="row"><span>الوقت:</span><span class="font-mono">${timeStr}</span></div>
  <div class="row"><span>الكاشير:</span><span>${effectiveCashierName}</span></div>
  <div class="divider"></div>

  <div class="row"><span>رصيد أول المدة (الافتتاحي):</span><span class="font-mono">${(stats.initialCash || 0).toFixed(2)} ج.م</span></div>
  <div class="row"><span>إجمالي مبيعات الوردية:</span><span class="font-mono">${(stats.paidOrdersTotal || 0).toFixed(2)} ج.م</span></div>
  <div class="row"><span>عدد الطلبات المكتملة:</span><span class="font-mono">${stats.paidOrdersCount || 0} طلب</span></div>
  <div class="row" style="color: #900;"><span>مصروفات ومشتريات طارئة:</span><span class="font-mono">-${(stats.expensesTotal || 0).toFixed(2)} ج.م</span></div>
  <div class="row" style="color: #700;"><span>مسحوبات الإدارة:</span><span class="font-mono">-${(stats.managementWithdrawalsTotal || 0).toFixed(2)} ج.م</span></div>
  
  <div class="divider"></div>
  <div class="row highlight">
    <span>رصيد الدرج المتوقع:</span>
    <span class="font-mono">${(stats.endOfDayBalance || stats.expectedCash || 0).toFixed(2)} ج.م</span>
  </div>
  <div class="row" style="margin-top: 4px;">
    <span>المبلغ الفعلي بعد الجرد:</span>
    <span class="font-mono font-bold">${(stats.actualCash || 0).toFixed(2)} ج.م</span>
  </div>
  <div class="row font-bold" style="color: ${(stats.shortageOverage || 0) < 0 ? '#b00' : '#080'};">
    <span>الفارق (عجز / زيادة):</span>
    <span class="font-mono">${(stats.shortageOverage || 0).toFixed(2)} ج.م</span>
  </div>

  <div class="divider"></div>
  <div class="text-center" style="font-size: 9px; margin-top: 6px;">
    توقيع الكاشير: ......................  توقيع المستلم: ......................
  </div>
</body>
</html>`;
}

/**
 * Executes Thermal Printing targeting 80mm & 58mm POS printers.
 * In Chrome/Edge launched with `--kiosk-printing`, this immediately prints with ZERO dialogs.
 * In standard browser mode, opens the print preview dialog.
 */
export function silentPrintHtml(htmlContent: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    try {
      const styleId = "basiony-thermal-print-styles";
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        styleEl.textContent = `
          @media screen {
            #basiony-print-area {
              display: none !important;
              position: absolute !important;
              left: -9999px !important;
              top: -9999px !important;
              visibility: hidden !important;
              opacity: 0 !important;
            }
          }
          @media print {
            @page {
              size: 80mm auto !important;
              margin: 0mm !important;
            }
            html, body {
              width: 100% !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body.basiony-printing > *:not(#basiony-print-area) {
              display: none !important;
            }
            body.basiony-printing #basiony-print-area {
              display: block !important;
              visibility: visible !important;
              position: static !important;
              width: 100% !important;
              max-width: 76mm !important;
              margin: 0 auto !important;
              padding: 2mm 1mm 4mm 1mm !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif !important;
              direction: rtl !important;
              text-align: right !important;
            }
            body.basiony-printing #basiony-print-area * {
              visibility: visible !important;
              color: #000000 !important;
            }
          }
        `;
        document.head.appendChild(styleEl);
      }

      const containerId = "basiony-print-area";
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        document.body.appendChild(container);
      }

      const styleMatches = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
      const extractedStyles = styleMatches.join("\n");
      const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const bodyContent = bodyMatch && bodyMatch[1] ? bodyMatch[1] : htmlContent;

      container.innerHTML = `${extractedStyles}\n<div class="basiony-receipt-root">${bodyContent}</div>`;
      document.body.classList.add("basiony-printing");

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        document.body.classList.remove("basiony-printing");
        if (container) {
          container.innerHTML = "";
        }
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      setTimeout(cleanup, 4000);

      setTimeout(() => {
        try {
          window.print();
          resolve(true);
        } catch (err) {
          console.error("Print Execution Error:", err);
          cleanup();
          resolve(false);
        }
      }, 100);

    } catch (err) {
      console.error("Print Setup Error:", err);
      resolve(false);
    }
  });
}

/**
 * High-level helper: formats receipt and prints silently
 */
export async function triggerSilentThermalPrint(options: ThermalReceiptOptions): Promise<boolean> {
  const html = buildThermalReceiptHtml(options);
  return silentPrintHtml(html);
}

/**
 * High-level helper: formats kitchen ticket and prints
 */
export async function triggerKitchenPrepPrint(options: ThermalReceiptOptions): Promise<boolean> {
  const html = buildKitchenPrepTicketHtml(options);
  return silentPrintHtml(html);
}

/**
 * Trigger quick test receipt to verify thermal printer communication
 */
export async function triggerTestPrint(cashierName: string = "كاشير مشويات بسيوني"): Promise<boolean> {
  return triggerSilentThermalPrint({
    title: "اختبار طابعة الإيصالات (TEST PRINT)",
    receiptType: "RECEIPT",
    tableName: "طاولة تجربة #1",
    orderNumber: 101,
    orderType: "TAKEAWAY",
    items: [
      { nameAr: "كفتة مشوية على الفحم", quantity: 1, price: 400 },
      { nameAr: "ساندوتش سجق سوري عالفحم", quantity: 2, price: 50 },
      { nameAr: "زجاجة بيبسي 1.5 لتر", quantity: 1, price: 35 },
    ],
    subtotal: 535,
    totalAmount: 535,
    cashierName,
    isPaid: true,
    paymentMethod: "CASH",
    amountPaid: 600,
    changeAmount: 65,
    notes: "تجربة الطباعة التلقائية على طابعة الإيصالات الحرارية",
  });
}
