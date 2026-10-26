const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('C:/Users/BS/.gemini/antigravity/scratch/wahet-badawy/src/app/pos/pos-interface.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Update imports from "@/actions/pos"
const oldImports = `import { sendOrderToPrep, collectOrderPayment } from "@/actions/pos";`;
const newImports = `import {
  sendOrderToPrep,
  collectOrderPayment,
  checkOrderStatus,
  cancelOrderAction,
  getOrderForReprint,
} from "@/actions/pos";`;

if (content.includes(oldImports)) {
  content = content.replace(oldImports, newImports);
  console.log('1. Updated imports from "@/actions/pos"');
} else {
  console.warn('Could not find old imports from "@/actions/pos"');
}

// 2. Add clientOrderId state
const stateAnchor = `const [draftNotice, setDraftNotice] = useState<boolean>(false);`;
const stateAddition = `const [draftNotice, setDraftNotice] = useState<boolean>(false);
  const [clientOrderId, setClientOrderId] = useState<string>(
    () => "basiony_ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)
  );`;

if (!content.includes('clientOrderId, setClientOrderId')) {
  if (content.includes(stateAnchor)) {
    content = content.replace(stateAnchor, stateAddition);
    console.log('2. Added clientOrderId state');
  } else {
    console.warn('Could not find stateAnchor');
  }
}

// 3. Update handleClearOrder with cancellation organize logic
const clearOrderTarget = `  const handleClearOrder = () => {
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

const clearOrderReplacement = `  const handleClearOrder = async () => {
    if (cart.length === 0 && !activeOrderId) return;

    if (activeOrderId) {
      const reason = prompt("يرجى إدخال سبب إلغاء هذا الطلب المسجل بالنظام:");
      if (!reason || !reason.trim()) {
        alert("إلغاء الطلب المسجل يتطلب توضيح السبب للرقابة");
        return;
      }

      startTransition(async () => {
        let res = await cancelOrderAction({
          orderId: activeOrderId,
          reason: reason.trim(),
          cashierName: userName,
          userId,
          userRole,
        });

        if (res?.requiresManagerAuth) {
          const pin = prompt("هذه العملية تتطلب موافقة المدير. يرجى إدخال رمز المدير (PIN):");
          if (!pin) return;
          res = await cancelOrderAction({
            orderId: activeOrderId,
            reason: reason.trim(),
            cashierName: userName,
            userId,
            userRole,
            managerPin: pin,
          });
        }

        if (res?.error) {
          alert(res.error);
          return;
        }

        alert(res?.message || "تم إلغاء الطلب وتسجيل العملية في سجل الرقابة ✓");
        setCart([]);
        setActiveOrderId(undefined);
        setIsCheckPrinted(false);
        setAmountPaidInput("");
        setDraftNotice(false);
        setClientOrderId("basiony_ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7));
        try {
          localStorage.removeItem("basiony_pos_active_cart");
        } catch (e) {}
      });
      return;
    }

    if (confirm("هل تريد إلغاء الطلب الحالي وتفريغ الأصناف؟")) {
      setCart([]);
      setActiveOrderId(undefined);
      setIsCheckPrinted(false);
      setAmountPaidInput("");
      setDraftNotice(false);
      setClientOrderId("basiony_ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7));
      try {
        localStorage.removeItem("basiony_pos_active_cart");
      } catch (e) {}
    }
  };`;

if (content.includes(clearOrderTarget)) {
  content = content.replace(clearOrderTarget, clearOrderReplacement);
  console.log('3. Updated handleClearOrder with cancellation organize logic');
} else {
  console.warn('Could not exact match clearOrderTarget, using regex');
  const rx = /const handleClearOrder = \(\) => \{[\s\S]*?localStorage\.removeItem\("basiony_pos_active_cart"\);[\s\S]*?\}\s*\};/;
  content = content.replace(rx, clearOrderReplacement);
  console.log('3. Replaced handleClearOrder via regex');
}

// 4. Update handleSendToPrep to pass clientOrderId, cashierName, userId, userRole
const sendToPrepOldCall = `const res = await sendOrderToPrep({
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
      });`;

const sendToPrepNewCall = `const res = await sendOrderToPrep({
        clientOrderId,
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
        cashierName: userName,
        userId,
        userRole,
      });`;

if (content.includes(sendToPrepOldCall)) {
  content = content.replace(sendToPrepOldCall, sendToPrepNewCall);
  console.log('4. Updated sendOrderToPrep call with clientOrderId');
}

// 5. Update handleCollectPayment to pass clientOrderId, paymentMethod, amountPaid, cashierName, and add network recovery
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
      let res: any;
      try {
        res = await collectOrderPayment({
          clientOrderId,
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
          paymentMethod,
          amountPaid: parsedAmountPaid,
          cashierName: userName,
          userId,
          userRole,
        });
      } catch (networkError) {
        console.warn("Network hiccup during payment, checking status on server...", networkError);
        // Verify with server before displaying error or re-attempting
        try {
          const statusCheck = await checkOrderStatus(clientOrderId);
          if (statusCheck?.exists && statusCheck.status === OrderStatus.PAID) {
            res = {
              success: true,
              order: statusCheck.order,
              message: "تم التحقق وتأكيد حفظ وسداد الفاتورة بنجاح على الخادم بعد استعادة الاتصال ✓",
            };
          }
        } catch (e) {}
      }

      if (res?.error) {
        alert(res.error);
        return;
      }

      if (!res?.success || !res?.order) {
        alert("تعذر تأكيد استلام الحساب من الخادم. يرجى التحقق من الشبكة.");
        return;
      }

      const verifiedOrder = res.order;
      const finalAmountPaid = paymentMethod === "CASH"
        ? (parsedAmountPaid > 0 ? parsedAmountPaid : (res.verifiedTotalAmount || totalAmount))
        : (res.verifiedTotalAmount || totalAmount);
      const finalChange = res.changeAmount !== undefined
        ? res.changeAmount
        : (paymentMethod === "CASH" ? Math.max(0, finalAmountPaid - totalAmount) : 0);
      const paymentMethodArabic = paymentMethod === "CASH" ? "كاش (نقدي)" : paymentMethod === "CARD" ? "فيزا / بطاقة" : "محفظة إلكترونية";

      const receiptData = {
        orderId: verifiedOrder.id,
        title: "فاتورة سداد نقدي (PAID RECEIPT)",
        receiptType: "RECEIPT" as const,
        tableName: selectedTable?.name || (orderType === "DELIVERY" ? "طلب دليفري" : "تيك أواي"),
        orderNumber: verifiedOrder.orderNumber || (activeOrderId ? parseInt(activeOrderId.slice(-4)) : undefined),
        orderType,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        deliveryFee: verifiedOrder.deliveryFee || deliveryFeeNumber || undefined,
        items: cart.map((i) => ({
          nameAr: i.nameAr,
          quantity: i.quantity,
          price: i.price,
          notes: i.notes || null,
        })),
        subtotal: verifiedOrder.subtotal || subtotal,
        discount: verifiedOrder.discount || discount || undefined,
        totalAmount: verifiedOrder.totalAmount || totalAmount,
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
      setClientOrderId("basiony_ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7));

      if (userId) {
        const updated = await getActiveShift(userId);
        if (updated.activeShift) setActiveShift(updated.activeShift);
      }

      alert(res.message || "تم إتمام الطلب وسداد الحساب بنجاح ✓");
    });`;

if (collectPaymentRegex.test(content)) {
  content = content.replace(collectPaymentRegex, collectPaymentReplacement);
  console.log('5. Updated handleCollectPayment with server verification and network resilience');
} else {
  console.warn('Could not match collectPaymentRegex');
}

// 6. Update handleReprintLastReceipt to sync reprint count with server
const reprintRegex = /const handleReprintLastReceipt = async \(\) => \{[\s\S]*?await triggerSilentThermalPrint\(reprintPayload\);\s*\};/m;

const reprintReplacement = `const handleReprintLastReceipt = async () => {
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

    let updatedCount = (receipt.reprintCount || 0) + 1;

    // Call server to increment reprint count and log audit entry (strictly read-only)
    if (receipt.orderId) {
      try {
        const serverReprint = await getOrderForReprint(receipt.orderId, userName);
        if (serverReprint?.reprintCount) {
          updatedCount = serverReprint.reprintCount;
        }
      } catch (e) {
        console.warn("Server reprint sync warning:", e);
      }
    }

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
  };`;

if (reprintRegex.test(content)) {
  content = content.replace(reprintRegex, reprintReplacement);
  console.log('6. Updated handleReprintLastReceipt to sync with server audit');
} else {
  console.warn('Could not match reprintRegex');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully updated pos-interface.tsx, length:', content.length);
