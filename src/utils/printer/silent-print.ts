/**
 * Silent Printing Engine for Wahet Badawy POS
 * Prints directly to Windows Default Printer via hidden iframe without interrupting POS UI.
 * Compatible with Chrome / Edge Kiosk Printing (--kiosk-printing) for zero-dialog instant printing.
 */

export interface ThermalReceiptItem {
  nameAr: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface ThermalReceiptOptions {
  title?: string;
  receiptType?: "CHECK" | "RECEIPT" | "PREP" | "Z_REPORT";
  tableName: string;
  orderNumber?: number | string;
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  items: ThermalReceiptItem[];
  subtotal: number;
  discount?: number;
  totalAmount: number;
  isComplimentary?: boolean;
  notes?: string;
  timestamp?: Date;
  cashierName?: string;
  isPaid?: boolean;
}

/**
 * Builds high-contrast, clean 80mm thermal receipt HTML
 */
export function buildThermalReceiptHtml(options: ThermalReceiptOptions): string {
  const timestamp = options.timestamp || new Date();
  const dateStr = timestamp.toLocaleDateString("ar-EG");
  const timeStr = timestamp.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const orderTypeArabic =
    options.orderType === "DELIVERY"
      ? "🛵 طلب دليفري (توصيل)"
      : options.orderType === "TAKEAWAY"
      ? "🥡 طلب سفري (تيك أواي)"
      : "🪑 صالة داخلي (Dine-In)";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>إيصال - ${options.tableName}</title>
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
      width: 76mm;
      margin: 0 auto;
      padding: 4mm 2mm 8mm 2mm;
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
      font-size: 16px;
      font-weight: 900;
      letter-spacing: -0.5px;
      margin-bottom: 2px;
    }
    .brand-sub {
      font-size: 10px;
      color: #333;
      margin-bottom: 3px;
    }
    .brand-contact {
      font-size: 9px;
      color: #444;
      margin-bottom: 6px;
    }
    .dashed-divider {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .double-divider {
      border-top: 2px solid #000;
      border-bottom: 1px solid #000;
      height: 3px;
      margin: 5px 0;
    }
    .ticket-type-badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 900;
      border: 1.5px solid #000;
      border-radius: 4px;
      margin: 4px 0;
    }
    .table-box {
      border: 1.5px solid #000;
      padding: 4px;
      border-radius: 4px;
      margin: 4px 0;
      text-align: center;
      background: #fdfdfd;
    }
    .table-name {
      font-size: 14px;
      font-weight: 900;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      margin-bottom: 2px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 11px;
    }
    table.items-table th {
      border-bottom: 1px solid #000;
      padding: 3px 1px;
      font-size: 10px;
    }
    table.items-table td {
      padding: 4px 1px;
      vertical-align: top;
    }
    .item-notes {
      font-size: 9px;
      color: #333;
      padding-right: 8px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 2px 0;
    }
    .grand-total {
      font-size: 14px;
      font-weight: 900;
      padding: 4px 0;
    }
    .footer-text {
      font-size: 9px;
      text-align: center;
      margin-top: 8px;
      color: #444;
    }
    @media print {
      body { width: 100%; margin: 0; padding: 2mm 1mm; }
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="brand-title">واحة بدوي - WAHET BADAWY</div>
    <div class="brand-sub">كافيه ومطعم مشويات ومندي • طعم زمان على أصوله</div>
    <div class="brand-contact">عبد القادر - جامع السلام - المستعمرة • هاتف: 01558962994</div>
    
    <div class="dashed-divider"></div>
    <div class="ticket-type-badge">
      ${options.title || (options.isPaid ? "فاتورة سداد نقدي (PAID RECEIPT)" : "شيك حساب العميل (CUSTOMER CHECK)")}
    </div>
  </div>

  <div class="table-box">
    <div style="font-size: 10px; font-weight: bold;">مكان الطلب / الطاولة:</div>
    <div class="table-name">${options.tableName}</div>
    ${options.orderNumber ? `<div style="font-size: 10px; font-weight: bold;">رقم الشيك: #${options.orderNumber}</div>` : ""}
  </div>

  <div class="meta-row">
    <span>النوع: <strong>${orderTypeArabic}</strong></span>
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
        <th class="text-right" style="width: 55%;">الصنف</th>
        <th class="text-center" style="width: 15%;">العدد</th>
        <th class="text-center" style="width: 15%;">السعر</th>
        <th class="text-left" style="width: 15%;">الإجمالي</th>
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

  <!-- Totals -->
  <div class="totals-row">
    <span>المجموع الجزئي (Subtotal):</span>
    <span class="font-mono font-bold">${options.subtotal.toFixed(2)} ج.م</span>
  </div>

  ${options.discount && options.discount > 0 ? `
  <div class="totals-row" style="color: #900;">
    <span>الخصم المعتمد (Discount):</span>
    <span class="font-mono font-bold">-${options.discount.toFixed(2)} ج.م</span>
  </div>
  ` : ""}

  ${options.deliveryFee && options.deliveryFee > 0 ? `
  <div class="totals-row">
    <span>خدمة التوصيل (Delivery):</span>
    <span class="font-mono font-bold">+${options.deliveryFee.toFixed(2)} ج.م</span>
  </div>
  ` : ""}

  ${options.isComplimentary ? `
  <div class="totals-row" style="font-weight: 900; color: #006600;">
    <span>ضيافة إدارة (Complimentary):</span>
    <span class="font-mono">100% خصم</span>
  </div>
  ` : ""}

  <div class="dashed-divider"></div>

  <div class="totals-row grand-total">
    <span>الصافي النهائي للدفع:</span>
    <span class="font-mono">${options.totalAmount.toFixed(2)} ج.م</span>
  </div>

  <div class="dashed-divider"></div>

  <div class="text-center" style="margin: 4px 0; font-weight: 900; font-size: 11px;">
    ${options.isPaid ? "✓ تم استلام المبلغ نقداً وفتح الدرج" : "⏳ شيك غير مدفوع - يرجى السداد عند الكاشير"}
  </div>

  ${options.notes ? `
  <div style="font-size: 10px; margin-top: 4px; padding: 2px 4px; border: 1px dashed #666; border-radius: 3px;">
    <strong>ملاحظة الطلب:</strong> ${options.notes}
  </div>
  ` : ""}

  <div class="footer-text">
    <div>شكراً لزيارتكم واحة بدوي • نسعد دائماً بخدمتكم</div>
    <div class="font-mono" style="font-size: 8px; margin-top: 2px;">نظام كاشير واحة بدوي السحابي v2.5</div>
  </div>
</body>
</html>`;
}

/**
 * Builds clean 80mm Z-Report (Daily Closing / End of Shift) Thermal Print HTML
 */
export function buildZReportHtml(reportData: any, cashierName: string): string {
  const stats = reportData?.stats || {};
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
      width: 76mm;
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
  </style>
</head>
<body>
  <div class="text-center font-bold" style="font-size: 15px;">واحة بدوي - تقفيل الوردية</div>
  <div class="text-center" style="font-size: 10px;">Z-Report • جرد وحساب الدرج</div>
  <div class="divider"></div>
  <div class="row"><span>التاريخ:</span><span class="font-mono">${dateStr}</span></div>
  <div class="row"><span>الوقت:</span><span class="font-mono">${timeStr}</span></div>
  <div class="row"><span>الكاشير:</span><span>${cashierName || "admin"}</span></div>
  <div class="row"><span>المستلم:</span><span>${stats.receivedBy || "—"}</span></div>
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
 * Executes Silent Printing by writing HTML to an invisible iframe and calling print().
 * In Chrome/Edge launched with `--kiosk-printing`, this immediately prints to the
 * OS Default Printer with ZERO dialogs or user clicks.
 */
export function silentPrintHtml(htmlContent: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    try {
      const iframeId = "wahet-badawy-silent-printer-frame";
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement;

      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.style.position = "fixed";
        iframe.style.top = "-9999px";
        iframe.style.left = "-9999px";
        iframe.style.width = "80mm";
        iframe.style.height = "100px";
        iframe.style.border = "none";
        iframe.style.opacity = "0";
        iframe.style.pointerEvents = "none";
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        console.error("Silent Print Error: cannot access iframe document");
        resolve(false);
        return;
      }

      doc.open();
      doc.write(htmlContent);
      doc.close();

      // Wait a moment for styles and layout to calculate, then print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.error("Silent Print Execution Error:", err);
          // Fallback to window.print if iframe print is restricted
          window.print();
          resolve(false);
        }
      }, 250);
    } catch (err) {
      console.error("Silent Print Setup Error:", err);
      resolve(false);
    }
  });
}

/**
 * High-level helper: formats receipt and prints silently to default printer
 */
export async function triggerSilentThermalPrint(options: ThermalReceiptOptions): Promise<boolean> {
  const html = buildThermalReceiptHtml(options);
  return silentPrintHtml(html);
}
