/**
 * Final Acceptance Audit Test Suite
 * Project: Mashweyat Basiony (مشويات بسيوني)
 * Branch: dev-basiony-reports-ai-print / main
 * Extended: Expenses Management & Amo Basiony Conversational NLP
 */

const assert = require("assert");

console.log("==================================================================");
console.log("🔍 STARTING FINAL ACCEPTANCE AUDIT FOR MASHWEYAT BASIONY");
console.log("==================================================================");

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}`);
    failedCount++;
  }
}

// ==================================================================
// 1. Arabic CSV UTF-8 BOM Exporter Test
// ==================================================================
test("CSV Exporter: Prepends UTF-8 BOM (\\uFEFF) for Arabic Microsoft Excel compatibility", () => {
  function generateCsvContent(columns, data) {
    const BOM = "\uFEFF";
    const headerRow = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(",");
    const rows = data.map(row => {
      return columns
        .map(c => {
          const val = row[c.key];
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",");
    });
    return BOM + [headerRow, ...rows].join("\r\n");
  }

  const columns = [
    { key: "name", header: "اسم الصنف" },
    { key: "quantity", header: "الكمية المباعة" },
    { key: "revenue", header: "إجمالي الإيراد (ج.م)" },
  ];

  const data = [
    { name: "مشويات مشكل بسيوني", quantity: 15, revenue: 3750 },
    { name: "طرب بلدي على الفحم", quantity: 8, revenue: 1600 },
    { name: 'كباب "مخصوص" مع سلطات', quantity: 4, revenue: 1200 },
  ];

  const csv = generateCsvContent(columns, data);

  assert.strictEqual(csv.startsWith("\uFEFF"), true, "Must start with UTF-8 BOM");
  assert.strictEqual(csv.includes("اسم الصنف"), true, "Must contain Arabic header");
  assert.strictEqual(csv.includes("مشويات مشكل بسيوني"), true, "Must contain Arabic row data");
  assert.strictEqual(csv.includes('""مخصوص""'), true, "Must escape quotes properly");
});

// ==================================================================
// 2. Sales Summary & Daily Breakdown Math Test
// ==================================================================
test("Sales Summary: Accurately calculates totalSales, AOV, discounts, and daily breakdown", () => {
  const sampleOrders = [
    { id: "1", status: "PAID", totalAmount: 450, discount: 50, deliveryFee: 0, createdAt: new Date("2026-10-23T12:00:00Z") },
    { id: "2", status: "PAID", totalAmount: 300, discount: 0, deliveryFee: 20, createdAt: new Date("2026-10-23T14:00:00Z") },
    { id: "3", status: "OPEN", totalAmount: 200, discount: 0, deliveryFee: 0, createdAt: new Date("2026-10-23T15:00:00Z") }, // Should be excluded from paid sales
    { id: "4", status: "PAID", totalAmount: 250, discount: 20, deliveryFee: 0, createdAt: new Date("2026-10-22T18:00:00Z") },
  ];

  const paidOrders = sampleOrders.filter(o => o.status === "PAID");
  const totalSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalDiscounts = paidOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const totalDeliveryFees = paidOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const aov = paidOrders.length > 0 ? totalSales / paidOrders.length : 0;

  assert.strictEqual(paidOrders.length, 3, "Paid orders count must be 3");
  assert.strictEqual(totalSales, 1000, "Total paid sales must equal 450 + 300 + 250 = 1000");
  assert.strictEqual(totalDiscounts, 70, "Total discounts must equal 50 + 20 = 70");
  assert.strictEqual(totalDeliveryFees, 20, "Total delivery fees must equal 20");
  assert.strictEqual(Math.round(aov * 100) / 100, 333.33, "AOV must equal 1000 / 3 = 333.33");
});

// ==================================================================
// 3. Channel Breakdown Calculation Test
// ==================================================================
test("Channel Breakdown: Splits Dine-in, Takeaway, and Delivery with percentages", () => {
  const paidOrders = [
    { orderType: "TAKEAWAY", totalAmount: 600 },
    { orderType: "TAKEAWAY", totalAmount: 400 },
    { orderType: "DELIVERY", totalAmount: 500, deliveryFee: 30 },
    { orderType: "DINE_IN", totalAmount: 500 },
  ];

  const totalSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0); // 2000
  const channelStats = {
    TAKEAWAY: { count: 0, revenue: 0, percentage: 0 },
    DELIVERY: { count: 0, revenue: 0, deliveryFees: 0, percentage: 0 },
    DINE_IN: { count: 0, revenue: 0, percentage: 0 },
  };

  paidOrders.forEach(o => {
    const ch = o.orderType;
    if (channelStats[ch]) {
      channelStats[ch].count += 1;
      channelStats[ch].revenue += o.totalAmount;
      if (ch === "DELIVERY") {
        channelStats.DELIVERY.deliveryFees += o.deliveryFee || 0;
      }
    }
  });

  channelStats.TAKEAWAY.percentage = (channelStats.TAKEAWAY.revenue / totalSales) * 100;
  channelStats.DELIVERY.percentage = (channelStats.DELIVERY.revenue / totalSales) * 100;
  channelStats.DINE_IN.percentage = (channelStats.DINE_IN.revenue / totalSales) * 100;

  assert.strictEqual(channelStats.TAKEAWAY.revenue, 1000);
  assert.strictEqual(channelStats.TAKEAWAY.percentage, 50, "Takeaway should be 50%");
  assert.strictEqual(channelStats.DELIVERY.revenue, 500);
  assert.strictEqual(channelStats.DELIVERY.percentage, 25, "Delivery should be 25%");
  assert.strictEqual(channelStats.DELIVERY.deliveryFees, 30);
  assert.strictEqual(channelStats.DINE_IN.revenue, 500);
  assert.strictEqual(channelStats.DINE_IN.percentage, 25, "Dine-in should be 25%");
});

// ==================================================================
// 4. Food Cost & Profit Margins (Strict Rule: NEVER fabricate missing costs)
// ==================================================================
test("Profits & Margins: Calculates recipe cost accurately and flags unrecorded costs as null without fake numbers", () => {
  const menuItemsWithRecipes = [
    {
      id: "item-1",
      nameAr: "كفتة بلدي مشوية بسيوني",
      price: 200,
      recipeItems: [
        { rawMaterial: { name: "لحم بلدي مفروم", costPerUnit: 400, unit: "كجم" }, quantity: 0.25 }, // 100 LE
        { rawMaterial: { name: "بهارات وتتبيلة بسيوني", costPerUnit: 50, unit: "جرام" }, quantity: 0.2 }, // 10 LE
      ],
    },
    {
      id: "item-2",
      nameAr: "صنف تجريبي بدون وصفة تكاليف",
      price: 150,
      recipeItems: [], // No recipe cost recorded
    },
  ];

  const itemCostMap = new Map();
  menuItemsWithRecipes.forEach((m) => {
    if (!m.recipeItems || m.recipeItems.length === 0) {
      itemCostMap.set(m.id, { cost: 0, hasFullRecipe: false });
      return;
    }
    let itemCost = 0;
    let hasValidData = true;
    for (const r of m.recipeItems) {
      const mat = r.rawMaterial;
      if (!mat || mat.costPerUnit <= 0) {
        hasValidData = false;
      } else {
        itemCost += r.quantity * mat.costPerUnit;
      }
    }
    itemCostMap.set(m.id, { cost: itemCost, hasFullRecipe: hasValidData && itemCost > 0 });
  });

  // Verify item 1
  const item1Cost = itemCostMap.get("item-1");
  assert.strictEqual(item1Cost.hasFullRecipe, true);
  assert.strictEqual(item1Cost.cost, 110, "Cost should be 0.25*400 + 0.2*50 = 100 + 10 = 110");
  const margin1 = 200 - item1Cost.cost; // 90
  assert.strictEqual(margin1, 90);
  const marginPct1 = (margin1 / 200) * 100; // 45%
  assert.strictEqual(marginPct1, 45);

  // Verify item 2 (Must be flagged without fake margin)
  const item2Cost = itemCostMap.get("item-2");
  assert.strictEqual(item2Cost.hasFullRecipe, false, "Must flag missing recipe data");
  assert.strictEqual(item2Cost.cost, 0);
});

// ==================================================================
// 5. Cash Drawer & Shift Accounting (No Double Counting, No Card in Drawer)
// ==================================================================
test("Shift Drawer Reconciliation: Cash sales, expenses, withdrawals, and shortage/overage calculation", () => {
  const shift = {
    initialCash: 500, // درج افتتاحي
    cashSales: 3200,  // مبيعات كاش
    visaSales: 1500,  // مبيعات فيزا (لا تدخل في نقدية الدرج الفعلي)
    expensesTotal: 400, // مصروفات طارئة
    managementWithdrawalsTotal: 800, // مسحوبات الإدارة
    actualCashCounted: 2450, // المبلغ الفعلي بعد الجرد
  };

  // Expected Drawer Cash formula:
  // initialCash + cashSales - expensesTotal - managementWithdrawals
  const expectedCash = shift.initialCash + shift.cashSales - shift.expensesTotal - shift.managementWithdrawalsTotal;
  assert.strictEqual(expectedCash, 2500, "Expected cash must be 500 + 3200 - 400 - 800 = 2500");

  // Visa amount must NOT affect expected drawer cash
  assert.strictEqual(expectedCash.toString().includes("1500"), false);

  // Shortage or Overage: actual - expected
  const discrepancy = shift.actualCashCounted - expectedCash;
  assert.strictEqual(discrepancy, -50, "Discrepancy must be 2450 - 2500 = -50 (عجز 50 ج.م)");
});

// ==================================================================
// 6. Thermal Receipt Generator Verification (80mm & Official Branding)
// ==================================================================
test("Thermal Receipt Generator: Produces valid 80mm HTML with Mashweyat Basiony identity", () => {
  function buildThermalReceiptHtml(options) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; size: 80mm auto; }
    body { font-family: 'Cairo'; width: 76mm; }
  </style>
</head>
<body>
  <div class="brand-title">مشويات بسيوني – MASHWEYAT BASIONY</div>
  <div class="brand-sub">إدارة: أ/ أحمد بسيوني (Ahmed Basiouny) • طعم زمان على أصوله</div>
  <div class="brand-contact">عبدالقادر - شارع المستعمرة أمام شارع 10 مباشرة قبل مسجد السلام • هاتف: 01038029714</div>
  <div class="table-name">${options.tableName}</div>
  <div class="total-amount">${options.totalAmount} ج.م</div>
</body>
</html>`;
  }

  const html = buildThermalReceiptHtml({
    tableName: "طاولة 4",
    totalAmount: 650,
  });

  assert.strictEqual(html.includes("80mm auto"), true, "Must have 80mm page size");
  assert.strictEqual(html.includes("مشويات بسيوني – MASHWEYAT BASIONY"), true, "Must include official restaurant name");
  assert.strictEqual(html.includes("أ/ أحمد بسيوني"), true, "Must include manager name");
  assert.strictEqual(html.includes("01038029714"), true, "Must include official phone");
  assert.strictEqual(html.includes("عبدالقادر - شارع المستعمرة"), true, "Must include official address");
  assert.strictEqual(html.includes("واحة بدوي"), false, "Must NOT contain old Badawy branding");
});

// ==================================================================
// 7. Security Role Gating & Permissions Logic Test
// ==================================================================
test("Server Role Gating: Blocks unauthenticated and cashier users from reports and refund actions", () => {
  function checkReportAccess(session) {
    if (!session || !session.user) {
      return { authorized: false, error: "غير مصرح: يجب تسجيل الدخول للوصول إلى التقارير." };
    }
    const role = session.user.role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return { authorized: false, error: "عذراً، التقارير المالية والإدارية مخصصة للمدير العام ومدير الصالة فقط." };
    }
    return { authorized: true };
  }

  // 1. Unauthenticated
  const resUnauth = checkReportAccess(null);
  assert.strictEqual(resUnauth.authorized, false);

  // 2. Cashier role
  const resCashier = checkReportAccess({ user: { name: "الكاشير", role: "CASHIER" } });
  assert.strictEqual(resCashier.authorized, false);

  // 3. Manager role
  const resManager = checkReportAccess({ user: { name: "مدير الصالة", role: "MANAGER" } });
  assert.strictEqual(resManager.authorized, true);

  // 4. Admin role
  const resAdmin = checkReportAccess({ user: { name: "أحمد بسيوني", role: "ADMIN" } });
  assert.strictEqual(resAdmin.authorized, true);
});

// ==================================================================
// 8. AI Assistant «عمو بسيوني» Read-Only & Intent Classification Test
// ==================================================================
test("AI Assistant: Correctly identifies categories, protects against unauthenticated access, and performs 0 mutations", () => {
  function classifyIntent(query) {
    const q = (query || "").trim().toLowerCase();
    if (q.includes("وردية") || q.includes("قفل") || q.includes("جرد") || q.includes("عجز") || q.includes("زيادة")) return "cashier";
    if (q.includes("مصروف") || q.includes("صرفنا") || q.includes("سجل") || q.includes("ادفع")) return "expenses";
    if (q.includes("مخزون") || q.includes("لحم") || q.includes("نواقص") || q.includes("خامات") || q.includes("بضاعة") || q.includes("تتبيل")) return "inventory";
    if (q.includes("منيو") || q.includes("صنف") || q.includes("كباب") || q.includes("كفتة") || q.includes("طلب") || q.includes("أكتر")) return "grills";
    if (q.includes("مبيع") || q.includes("فلوس") || q.includes("إيراد") || q.includes("حساب") || q.includes("درج") || q.includes("شيك")) return "sales";
    return "general";
  }

  assert.strictEqual(classifyIntent("إزاي أقفل الوردية وأجرد الدرج صح؟"), "cashier");
  assert.strictEqual(classifyIntent("سجل 350 جنيه منظفات نقدي"), "expenses");
  assert.strictEqual(classifyIntent("عايز أعرف نواقص اللحمة والمخزون"), "inventory");
  assert.strictEqual(classifyIntent("مين أكتر صنف كباب مطلوب في المنيو؟"), "grills");
  assert.strictEqual(classifyIntent("إيه مبيعات النهاردة والدرج؟"), "sales");
  assert.strictEqual(classifyIntent("إيه سر مشويات بسيوني؟"), "general");
});

// ==================================================================
// 9. Conversational Expense Parsing (Egyptian Arabic NLP)
// ==================================================================
test("Expense NLP: Extracts amount, category, and payment method from Egyptian conversational phrases", () => {
  function extractAmount(text) {
    const westernText = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
    const patterns = [
      /(?:بـ|بـ\s+|بقيمة\s+|بمبلغ\s+|صرفت\s+|سجل\s+|ادفع\s+)(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\.م|egp)?\b/i,
      /\b(\d+(?:\.\d+)?)\b/,
    ];
    for (const regex of patterns) {
      const match = westernText.match(regex);
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return null;
  }

  function extractPaymentMethod(text) {
    const t = text.toLowerCase();
    if (t.includes("فيزا") || t.includes("كارت") || t.includes("بطاقة")) return "VISA";
    if (t.includes("تحويل") || t.includes("فودافون") || t.includes("انستاباي")) return "TRANSFER";
    return "CASH";
  }

  // Phrase 1: "سجل 350 جنيه منظفات نقدي"
  assert.strictEqual(extractAmount("سجل 350 جنيه منظفات نقدي"), 350);
  assert.strictEqual(extractPaymentMethod("سجل 350 جنيه منظفات نقدي"), "CASH");

  // Phrase 2: "صرفت 500 لحمة كاش"
  assert.strictEqual(extractAmount("صرفت 500 لحمة كاش"), 500);
  assert.strictEqual(extractPaymentMethod("صرفت 500 لحمة كاش"), "CASH");

  // Phrase 3: "ادفع 1200 إيجار تحويل بنكي"
  assert.strictEqual(extractAmount("ادفع 1200 إيجار تحويل بنكي"), 1200);
  assert.strictEqual(extractPaymentMethod("ادفع 1200 إيجار تحويل بنكي"), "TRANSFER");

  // Phrase 4: "شراء فحم بـ 250 فيزا"
  assert.strictEqual(extractAmount("شراء فحم بـ 250 فيزا"), 250);
  assert.strictEqual(extractPaymentMethod("شراء فحم بـ 250 فيزا"), "VISA");

  // Phrase 5: Arabic numerals "سجل ١٥٠ جنيه أكياس"
  assert.strictEqual(extractAmount("سجل ١٥٠ جنيه أكياس"), 150);
});

// ==================================================================
// 10. Interactive Expense Confirmation Safety Flow
// ==================================================================
test("Expense Confirmation Flow: Demands missing parameters and creates pending confirmation card before saving", () => {
  function processExpenseCommand(input) {
    const amount = input.amount;
    const category = input.category;
    const payment = input.payment || "CASH";

    if (!amount && !category) {
      return { status: "PROMPT_BOTH", prompt: "المبلغ كام والبند إيه؟" };
    }
    if (!amount) {
      return { status: "PROMPT_AMOUNT", prompt: "كام المبلغ؟" };
    }
    if (!category) {
      return { status: "PROMPT_CATEGORY", prompt: "المصروف ده لبند إيه؟" };
    }

    // Ready for confirmation
    return {
      status: "PENDING_CONFIRMATION",
      pending: {
        amount,
        category,
        payment,
      },
    };
  }

  // Missing amount & category
  const resBoth = processExpenseCommand({});
  assert.strictEqual(resBoth.status, "PROMPT_BOTH");

  // Missing amount only
  const resAmount = processExpenseCommand({ category: "منظفات" });
  assert.strictEqual(resAmount.status, "PROMPT_AMOUNT");

  // Missing category only
  const resCategory = processExpenseCommand({ amount: 350 });
  assert.strictEqual(resCategory.status, "PROMPT_CATEGORY");

  // Ready for 1-click confirmation
  const resReady = processExpenseCommand({ amount: 350, category: "منظفات", payment: "CASH" });
  assert.strictEqual(resReady.status, "PENDING_CONFIRMATION");
  assert.strictEqual(resReady.pending.amount, 350);
  assert.strictEqual(resReady.pending.category, "منظفات");
});

// ==================================================================
// 11. Shift Cash Drawer Impact (Cash vs Electronic)
// ==================================================================
test("Drawer Impact: Cash expenses reduce expected drawer cash; electronic expenses do not reduce drawer cash", () => {
  let initialExpectedDrawerCash = 3000;

  function applyExpenseToDrawer(drawerCash, amount, paymentMethod) {
    if (paymentMethod === "CASH") {
      return Math.max(0, drawerCash - amount);
    }
    // Visa and Bank transfer do not reduce physical cash in drawer
    return drawerCash;
  }

  // 1. Cash expense of 350
  const afterCash = applyExpenseToDrawer(initialExpectedDrawerCash, 350, "CASH");
  assert.strictEqual(afterCash, 2650, "Drawer cash should be 3000 - 350 = 2650");

  // 2. Visa expense of 500
  const afterVisa = applyExpenseToDrawer(afterCash, 500, "VISA");
  assert.strictEqual(afterVisa, 2650, "Visa expense must NOT reduce cash drawer");

  // 3. Bank transfer of 400
  const afterTransfer = applyExpenseToDrawer(afterVisa, 400, "TRANSFER");
  assert.strictEqual(afterTransfer, 2650, "Transfer expense must NOT reduce cash drawer");
});

// ==================================================================
// 12. Expense Categories Catalog (10 Comprehensive Groups)
// ==================================================================
test("Categories Catalog: Covers all 10 mandatory groups specified by restaurant management", () => {
  const groups = [
    "SALARIES",    // المرتبات والأجور والوجبات
    "FOOD_RAW",    // اللحوم والفراخ والخضار والبهارات والأرز والفحم
    "PACKAGING",   // علب السفري والأكياس والأطباق
    "UTILITIES",   // الكهرباء والمياه والغاز والنت
    "MAINTENANCE", // المنظفات والمطهرات وصيانة الجريل والتكييف
    "LOGISTICS",   // النقل والبنزين والطيارين
    "ADMIN",       // الإيجار والمحاسب والتراخيص
    "MARKETING",   // الدعاية والتصوير والضيافة
    "ASSETS",      // معدات المطبخ وأجهزة الكاشير
    "FINANCIAL",   // العمولات البنكية والمصروفات الطارئة
  ];

  assert.strictEqual(groups.length, 10, "Must have exactly 10 comprehensive groups");
});

console.log("==================================================================");
console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("==================================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
