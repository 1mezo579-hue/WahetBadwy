const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('C:/Users/BS/.gemini/antigravity/scratch/wahet-badawy/src/app/pos/pos-interface.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

console.log('Original file length:', content.length);
console.log('Original line count:', content.split(/\r?\n/).length);

// 1. Update imports
const oldImport = `import {
  triggerSilentThermalPrint,
  buildZReportHtml,
  buildThermalReceiptHtml,
  silentPrintHtml,
} from "@/utils/printer/silent-print";`;

const newImport = `import {
  triggerSilentThermalPrint,
  triggerKitchenPrepPrint,
  buildZReportHtml,
  buildThermalReceiptHtml,
  silentPrintHtml,
} from "@/utils/printer/silent-print";`;

if (!content.includes(newImport)) {
  if (content.includes(oldImport)) {
    content = content.replace(oldImport, newImport);
    console.log('Updated imports (exact match)');
  } else {
    // Regex replace for line-ending flexibility
    const importRegex = /import\s*\{\s*triggerSilentThermalPrint,\s*buildZReportHtml,\s*buildThermalReceiptHtml,\s*silentPrintHtml,?\s*\}\s*from\s*"@\/utils\/printer\/silent-print";/;
    if (importRegex.test(content)) {
      content = content.replace(importRegex, newImport);
      console.log('Updated imports (regex match)');
    } else {
      console.error('Failed to find printer imports!');
    }
  }
} else {
  console.log('Imports already updated');
}

// 2. Add payment and draft states
const stateAnchor = `const [orderNotes, setOrderNotes] = useState("");
  const [isPending, startTransition] = useTransition();`;

const stateAddition = `const [orderNotes, setOrderNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  // Payment & Change Calculator State
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "WALLET">("CASH");
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [lastCompletedReceipt, setLastCompletedReceipt] = useState<any>(null);
  const [draftNotice, setDraftNotice] = useState<boolean>(false);`;

if (!content.includes('paymentMethod, setPaymentMethod')) {
  const normalizedStateAnchor = /const \[orderNotes, setOrderNotes\] = useState\(""\);\s*const \[isPending, startTransition\] = useTransition\(\);/;
  if (normalizedStateAnchor.test(content)) {
    content = content.replace(normalizedStateAnchor, stateAddition);
    console.log('Added payment & draft states');
  } else {
    console.error('Failed to find state anchor!');
  }
}

// 3. Add Draft order persistence useEffects
const clockAnchor = `// Live Clock
  const [currentTime, setCurrentTime] = useState({ date: "2025/10/23", time: "20:37" });`;

const draftEffects = `// Draft Order Persistence & Recovery (Auto-save / Auto-restore)
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("basiony_pos_active_cart");
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed?.cart && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
          setCart(parsed.cart);
          if (parsed.orderType) setOrderType(parsed.orderType);
          if (parsed.customerName) setCustomerName(parsed.customerName);
          if (parsed.customerPhone) setCustomerPhone(parsed.customerPhone);
          if (parsed.deliveryAddress) setDeliveryAddress(parsed.deliveryAddress);
          if (parsed.deliveryFee) setDeliveryFee(parsed.deliveryFee);
          if (parsed.orderNotes) setOrderNotes(parsed.orderNotes);
          setDraftNotice(true);
        }
      }
      const storedLastReceipt = sessionStorage.getItem("basiony_last_receipt");
      if (storedLastReceipt) {
        setLastCompletedReceipt(JSON.parse(storedLastReceipt));
      }
    } catch (e) {
      console.warn("Failed to load draft from localStorage", e);
    }
  }, []);

  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem(
          "basiony_pos_active_cart",
          JSON.stringify({
            cart,
            orderType,
            customerName,
            customerPhone,
            deliveryAddress,
            deliveryFee,
            orderNotes,
            savedAt: Date.now(),
          })
        );
      } else {
        localStorage.removeItem("basiony_pos_active_cart");
        setDraftNotice(false);
      }
    } catch (e) {
      // ignore quota / silent error
    }
  }, [cart, orderType, customerName, customerPhone, deliveryAddress, deliveryFee, orderNotes]);

  // Live Clock
  const [currentTime, setCurrentTime] = useState({ date: "2025/10/23", time: "20:37" });`;

if (!content.includes('basiony_pos_active_cart')) {
  const clockRegex = /\/\/\s*Live Clock\s*const \[currentTime, setCurrentTime\] = useState\(\{ date: "2025\/10\/23", time: "20:37" \}\);/;
  if (clockRegex.test(content)) {
    content = content.replace(clockRegex, draftEffects);
    console.log('Added draft preservation effects');
  } else {
    console.error('Failed to find clock anchor!');
  }
}

// 4. Update calculations for change calculation
const calcAnchor = `const totalAmount = isComplimentary ? 0 : Math.max(0, subtotal + deliveryFeeNumber - discount);`;

const calcReplacement = `const totalAmount = isComplimentary ? 0 : Math.max(0, subtotal + deliveryFeeNumber - discount);

  // Cash Change Calculation
  const parsedAmountPaid = parseFloat(amountPaidInput) || 0;
  const changeDue = paymentMethod === "CASH" && parsedAmountPaid > totalAmount ? parsedAmountPaid - totalAmount : 0;`;

if (!content.includes('changeDue = paymentMethod === "CASH"')) {
  const calcRegex = /const totalAmount = isComplimentary \? 0 : Math\.max\(0, subtotal \+ deliveryFeeNumber - discount\);/;
  if (calcRegex.test(content)) {
    content = content.replace(calcRegex, calcReplacement);
    console.log('Added changeDue calculation');
  } else {
    console.error('Failed to find calc anchor!');
  }
}

// 5. Update handleClearOrder and handleStartTakeaway to reset amountPaidInput and draft storage
const clearOrderAnchor = `const handleClearOrder = () => {
    if (cart.length === 0) return;
    if (confirm("هل تريد إلغاء الطلب الحالي وتفريغ الأصناف؟")) {
      setCart([]);
      setActiveOrderId(undefined);
      setIsCheckPrinted(false);
    }
  };`;

const clearOrderReplacement = `const handleClearOrder = () => {
    if (cart.length === 0) return;
    if (confirm("هل تريد إلغاء الطلب الحالي وتفريغ الأصناف؟")) {
      setCart([]);
      setActiveOrderId(undefined);
      setIsCheckPrinted(false);
      setAmountPaidInput("");
      setDraftNotice(false);
      try {
        localStorage.removeItem("basiony_pos_active_cart");
      } catch (e) {}
    }
  };`;

if (!content.includes('localStorage.removeItem("basiony_pos_active_cart");\n      } catch (e) {}')) {
  const clearRegex = /const handleClearOrder = \(\) => \{\s*if \(cart\.length === 0\) return;\s*if \(confirm\("هل تريد إلغاء الطلب الحالي وتفريغ الأصناف؟"\)\) \{\s*setCart\(\[\]\);\s*setActiveOrderId\(undefined\);\s*setIsCheckPrinted\(false\);\s*\}\s*\};/;
  if (clearRegex.test(content)) {
    content = content.replace(clearRegex, clearOrderReplacement);
    console.log('Updated handleClearOrder');
  }
}

// 6. Update handleSendToPrep to use triggerKitchenPrepPrint (strictly kitchen items, no financial total)
const prepPrintAnchorRegex = /await triggerSilentThermalPrint\(\{\s*title:\s*orderType === "DELIVERY"[\s\S]*?timestamp: new Date\(\),\s*\}\);/;

const prepPrintReplacement = `await triggerKitchenPrepPrint({
        tableName: selectedTable?.name || (orderType === "DELIVERY" ? "دليفري" : "تيك أواي"),
        orderNumber: res.order?.orderNumber,
        orderType,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        items: cart.map((i) => ({
          nameAr: i.nameAr,
          quantity: i.quantity,
          price: i.price,
          notes: i.notes || null,
        })),
        notes: orderNotes || undefined,
        cashierName: userName,
        timestamp: new Date(),
      });`;

if (prepPrintAnchorRegex.test(content)) {
  content = content.replace(prepPrintAnchorRegex, prepPrintReplacement);
  console.log('Updated handleSendToPrep to triggerKitchenPrepPrint');
} else {
  console.warn('Could not regex match triggerSilentThermalPrint in handleSendToPrep');
}

// 7. Update handleCollectPayment to record lastCompletedReceipt, store in sessionStorage, and pass payment method / amountPaid / change
const collectPaymentRegex = /const handleCollectPayment = \(\) => \{[\s\S]*?alert\("تم إتمام الطلب وسداد الحساب بنجاح ✓"\);\s*\}\);/m;

const collectPaymentReplacement = `const handleCollectPayment = () => {
    if (isPending) return;
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة (" + (systemLockedBy || "الإدارة") + ")");
      return;
    }
    if (cart.length === 0 && !activeOrderId) {
      alert("لا يوجد طلب مفتوح أو أصناف لتحصيلها!");
      return;
    }

    startTransition(async () => {
      const res = await collectOrderPayment({
        orderId: activeOrderId,
        tableId: selectedTable?.id,
        orderType,
        customerId: selectedCustomerId || undefined,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        deliveryFee: deliveryFeeNumber,
        items: cart,
        notes: orderNotes,
      });

      if (res?.error) {
        alert(res.error);
        return;
      }

      const finalAmountPaid = paymentMethod === "CASH"
        ? (parsedAmountPaid > 0 ? parsedAmountPaid : totalAmount)
        : totalAmount;
      const finalChange = paymentMethod === "CASH" ? Math.max(0, finalAmountPaid - totalAmount) : 0;
      const paymentMethodArabic = paymentMethod === "CASH" ? "كاش (نقدي)" : paymentMethod === "CARD" ? "فيزا / بطاقة" : "محفظة إلكترونية";

      const receiptData = {
        title: "فاتورة سداد نقدي (PAID RECEIPT)",
        receiptType: "RECEIPT" as const,
        tableName: selectedTable?.name || (orderType === "DELIVERY" ? "طلب دليفري" : "تيك أواي"),
        orderNumber: res.order?.orderNumber || (activeOrderId ? parseInt(activeOrderId.slice(-4)) : undefined),
        orderType,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        deliveryFee: deliveryFeeNumber || undefined,
        items: cart.map((i) => ({
          nameAr: i.nameAr,
          quantity: i.quantity,
          price: i.price,
          notes: i.notes || null,
        })),
        subtotal,
        discount: discount || undefined,
        totalAmount,
        paymentMethod: paymentMethodArabic,
        amountPaid: finalAmountPaid,
        changeAmount: finalChange,
        isComplimentary,
        notes: orderNotes || undefined,
        cashierName: userName,
        isPaid: true,
        timestamp: new Date(),
      };

      setLastCompletedReceipt(receiptData);
      try {
        sessionStorage.setItem("basiony_last_receipt", JSON.stringify(receiptData));
      } catch (e) {}

      await triggerSilentThermalPrint(receiptData);

      if (selectedTable) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === selectedTable.id
              ? { ...t, status: TableStatus.AVAILABLE, orders: [] }
              : t
          )
        );
      }

      // Reset for next order & clear draft
      try {
        localStorage.removeItem("basiony_pos_active_cart");
      } catch (e) {}
      setDraftNotice(false);
      setCart([]);
      setActiveOrderId(undefined);
      setIsCheckPrinted(false);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setDeliveryFee("");
      setOrderNotes("");
      setAmountPaidInput("");

      if (userId) {
        const updated = await getActiveShift(userId);
        if (updated.activeShift) setActiveShift(updated.activeShift);
      }

      alert("تم إتمام الطلب وسداد الحساب بنجاح ✓");
    });`;

if (collectPaymentRegex.test(content)) {
  content = content.replace(collectPaymentRegex, collectPaymentReplacement);
  console.log('Updated handleCollectPayment');
} else {
  console.warn('Could not match handleCollectPayment with regex');
}

// 8. Add handleReprintLastReceipt
if (!content.includes('handleReprintLastReceipt')) {
  const reprintFunc = `
  // Reprint Last Completed Receipt (Read-Only Replica - Zero Side Effects on Database)
  const handleReprintLastReceipt = async () => {
    let receipt = lastCompletedReceipt;
    if (!receipt) {
      try {
        const stored = sessionStorage.getItem("basiony_last_receipt");
        if (stored) receipt = JSON.parse(stored);
      } catch (e) {}
    }

    if (!receipt) {
      alert("لا توجد فاتورة مكتملة محفوظة في هذه الجلسة لإعادة طباعتها!");
      return;
    }

    const updatedCount = (receipt.reprintCount || 0) + 1;
    const reprintPayload = {
      ...receipt,
      isReprint: true,
      reprintCount: updatedCount,
    };

    setLastCompletedReceipt(reprintPayload);
    try {
      sessionStorage.setItem("basiony_last_receipt", JSON.stringify(reprintPayload));
    } catch (e) {}

    await triggerSilentThermalPrint(reprintPayload);
  };
`;

  // Place before recentOrders
  const recentOrdersAnchor = `// Recent Orders\n  const recentOrders = useMemo`;
  const recentOrdersRegex = /\/\/\s*Recent Orders\s*const recentOrders = useMemo/;
  if (recentOrdersRegex.test(content)) {
    content = content.replace(recentOrdersRegex, reprintFunc + '\n  // Recent Orders\n  const recentOrders = useMemo');
    console.log('Added handleReprintLastReceipt');
  } else {
    console.error('Failed to find recentOrders anchor!');
  }
}

// Write back updated content
fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully wrote updated file, length:', content.length);
