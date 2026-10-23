"use client";

import { useState, useEffect, useTransition } from "react";
import { TableType, TableStatus, OrderStatus } from "@prisma/client";
import { sendOrderToPrep, collectOrderPayment } from "@/actions/pos";
import { startShift, endShift, getActiveShift } from "@/actions/shifts";
import { createCustomer } from "@/actions/customers";
import Link from "next/link";
import { serialPrinter, SerialPrinterStatus } from "@/utils/printer/web-serial";
import {
  routeAndPrintPrepOrder,
  executePaymentAndOpenDrawer,
  printCustomerCheckOnly,
  RoutedTicket,
} from "@/utils/printer/order-router";
import {
  triggerSilentThermalPrint,
  buildZReportHtml,
  silentPrintHtml,
  triggerTestPrint,
} from "@/utils/printer/silent-print";

interface PosTable {
  id: string;
  name: string;
  number: number | null;
  type: TableType;
  status: TableStatus;
  capacity: number;
  orders: Array<{
    id: string;
    orderNumber: number;
    status: OrderStatus;
    totalAmount: number;
    subtotal: number;
    isComplimentary: boolean;
    items: Array<{
      id: string;
      menuItemId: string;
      quantity: number;
      unitPrice: number;
      notes: string | null;
      menuItem: {
        nameAr: string;
        categoryId?: string;
      };
    }>;
  }>;
}

interface PosCategory {
  id: string;
  nameAr: string;
}

interface PosMenuItem {
  id: string;
  nameAr: string;
  price: number;
  categoryId: string;
  description?: string | null;
}

interface CartItem {
  menuItemId: string;
  nameAr: string;
  categoryName?: string;
  price: number;
  quantity: number;
  notes?: string;
}

export default function PosInterface({
  initialTables,
  categories,
  menuItems,
  userName,
  userId,
  initialShift,
  initialCustomers,
}: {
  initialTables: PosTable[];
  categories: PosCategory[];
  menuItems: PosMenuItem[];
  userName: string;
  userId: string;
  initialShift?: any;
  initialCustomers?: Array<{
    id: string;
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
  }>;
}) {
  const [tables, setTables] = useState<PosTable[]>(initialTables);
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  const [activeTab, setActiveTab] = useState<"MAP" | "ORDER">("MAP");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(undefined);
  const [orderNotes, setOrderNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  // Delivery & Takeaway & Customer State
  const [customersList, setCustomersList] = useState<any[]>(initialCustomers || []);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<string>(""); // Open Delivery Fee input
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState<boolean>(false);
  const [quickName, setQuickName] = useState<string>("");
  const [quickPhone, setQuickPhone] = useState<string>("");
  const [quickAddress, setQuickAddress] = useState<string>("");
  const [quickNotes, setQuickNotes] = useState<string>("");
  const [isCheckPrinted, setIsCheckPrinted] = useState<boolean>(false);

  // Hardware Printer & Cash Drawer State (Sprint 4)
  const [printerStatus, setPrinterStatus] = useState<SerialPrinterStatus>(
    serialPrinter.getStatus()
  );
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [selectedBaudRate, setSelectedBaudRate] = useState<number>(9600);
  const [hardwareFeedback, setHardwareFeedback] = useState<string | null>(null);

  // Routed Tickets Modal State (Sprint 4)
  const [routedModal, setRoutedModal] = useState<{
    title: string;
    subtitle: string;
    isPayment: boolean;
    drawerKicked: boolean;
    tickets: RoutedTicket[];
    activeTicketIndex: number;
  } | null>(null);

  // SPRINT 5: Shift Management & Handover State
  const [activeShift, setActiveShift] = useState<any>(initialShift || null);
  const [shiftTimer, setShiftTimer] = useState<string>("00:00:00");
  const [hasExceeded12Hours, setHasExceeded12Hours] = useState<boolean>(false);
  const [showStartShiftModal, setShowStartShiftModal] = useState<boolean>(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState<boolean>(false);
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [countedCash, setCountedCash] = useState<string>("");
  const [shiftNotes, setShiftNotes] = useState<string>("");
  const [shiftFeedback, setShiftFeedback] = useState<string | null>(null);
  const [zReportData, setZReportData] = useState<any | null>(null);

  // Table Filter State
  const [tableFilter, setTableFilter] = useState<
    "ALL" | "PHONE_TAKEAWAY" | "REGULAR" | "FAMILY" | "VIP" | "SPECIAL"
  >("ALL");

  // Bedouin Grill Official Closing Sheet State (ورقة التقفيل الرسمية)
  const [closingGrossSales, setClosingGrossSales] = useState<string>("");
  const [closingDiscounts, setClosingDiscounts] = useState<string>("0");
  const [closingVisa, setClosingVisa] = useState<string>("0");
  const [closingOtherBalance, setClosingOtherBalance] = useState<string>("0");
  const [closingManagementChecks, setClosingManagementChecks] = useState<string>("0");
  const [closingReceivedBy, setClosingReceivedBy] = useState<string>("");

  // Detailed Breakdown Lists
  const [expensesList, setExpensesList] = useState<
    Array<{ id: string; item: string; amount: number; notes?: string }>
  >([]);
  const [withdrawalsList, setWithdrawalsList] = useState<
    Array<{ id: string; receiver: string; amount: number; notes?: string }>
  >([]);
  const [staffWasteList, setStaffWasteList] = useState<
    Array<{ id: string; item: string; amount: number; responsible?: string; notes?: string }>
  >([]);

  // Dynamic Add Row Fields
  const [newExpenseItem, setNewExpenseItem] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseNotes, setNewExpenseNotes] = useState("");

  const [newWithdrawalReceiver, setNewWithdrawalReceiver] = useState("");
  const [newWithdrawalAmount, setNewWithdrawalAmount] = useState("");
  const [newWithdrawalNotes, setNewWithdrawalNotes] = useState("");

  const [newWasteItem, setNewWasteItem] = useState("");
  const [newWasteAmount, setNewWasteAmount] = useState("");
  const [newWasteResponsible, setNewWasteResponsible] = useState("");

  const [activeClosingSubTab, setActiveClosingSubTab] = useState<
    "SUMMARY" | "EXPENSES" | "WITHDRAWALS" | "WASTE"
  >("SUMMARY");

  // Subscribe to Web Serial status updates
  useEffect(() => {
    const unsubscribe = serialPrinter.onStatusChange((status) => {
      setPrinterStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // SPRINT 5: Shift Duration Live Timer & 12-Hour Enforcer
  useEffect(() => {
    if (!activeShift?.startTime) {
      setShiftTimer("00:00:00");
      setHasExceeded12Hours(false);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(activeShift.startTime).getTime();
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - start);

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (n: number) => n.toString().padStart(2, "0");
      setShiftTimer(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);

      // 12-Hour Shift Maximum Enforcer
      if (hours >= 12) {
        setHasExceeded12Hours(true);
      } else {
        setHasExceeded12Hours(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeShift]);

  // Connect to Web Serial printer
  const handleConnectPrinter = async () => {
    setHardwareFeedback("جاري فتح نافذة اختيار منفذ الطابعة...");
    const res = await serialPrinter.connect(selectedBaudRate);
    if (res.success) {
      setHardwareFeedback("🟢 تم الاتصال بالطابعة الحرارية بنجاح!");
      setTimeout(() => setHardwareFeedback(null), 3000);
    } else {
      setHardwareFeedback(`❌ ${res.error}`);
    }
  };

  // Disconnect printer
  const handleDisconnectPrinter = async () => {
    await serialPrinter.disconnect();
    setHardwareFeedback("تم فصل الاتصال بالطابعة.");
    setTimeout(() => setHardwareFeedback(null), 3000);
  };

  // Test Cash Drawer Kick
  const handleTestCashDrawer = async () => {
    setHardwareFeedback("جاري إرسال نبضة فتح درج النقدية (ESC p)...");
    const res = await serialPrinter.kickDrawer();
    if (res.success) {
      setHardwareFeedback("🚪 تم فتح درج النقدية بنجاح! (ESC/POS 0x1B 0x70)");
      setTimeout(() => setHardwareFeedback(null), 4000);
    } else {
      setHardwareFeedback(`❌ ${res.error}`);
    }
  };

  // SPRINT 5: Action - Start New Shift
  const handleStartShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await startShift({
        userId,
        initialCash: Number(openingFloat) || 0,
        notes: shiftNotes,
      });

      if (res?.error) {
        setShiftFeedback(`❌ ${res.error}`);
      } else if (res.shift) {
        setActiveShift(res.shift);
        setShowStartShiftModal(false);
        setShiftNotes("");
        setOpeningFloat(0);
        setShiftFeedback(null);
        alert(res.message);
      }
    });
  };

  // Helper to add Expense Item
  const handleAddExpenseItem = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newExpenseAmount);
    if (!newExpenseItem || isNaN(amount) || amount <= 0) {
      alert("يرجى كتابة بيان المصروف والمبلغ بشكل صحيح");
      return;
    }
    setExpensesList((prev) => [
      ...prev,
      { id: Date.now().toString(), item: newExpenseItem, amount, notes: newExpenseNotes },
    ]);
    setNewExpenseItem("");
    setNewExpenseAmount("");
    setNewExpenseNotes("");
  };

  const handleRemoveExpenseItem = (id: string) => {
    setExpensesList((prev) => prev.filter((item) => item.id !== id));
  };

  // Helper to add Management Withdrawal Item
  const handleAddWithdrawalItem = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newWithdrawalAmount);
    if (!newWithdrawalReceiver || isNaN(amount) || amount <= 0) {
      alert("يرجى كتابة اسم المستلم والمبلغ بشكل صحيح");
      return;
    }
    setWithdrawalsList((prev) => [
      ...prev,
      { id: Date.now().toString(), receiver: newWithdrawalReceiver, amount, notes: newWithdrawalNotes },
    ]);
    setNewWithdrawalReceiver("");
    setNewWithdrawalAmount("");
    setNewWithdrawalNotes("");
  };

  const handleRemoveWithdrawalItem = (id: string) => {
    setWithdrawalsList((prev) => prev.filter((w) => w.id !== id));
  };

  // Helper to add Staff Waste Item
  const handleAddWasteItem = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newWasteAmount);
    if (!newWasteItem || isNaN(amount) || amount <= 0) {
      alert("يرجى كتابة الصنف أو سبب التالف والقيمة بشكل صحيح");
      return;
    }
    setStaffWasteList((prev) => [
      ...prev,
      { id: Date.now().toString(), item: newWasteItem, amount, responsible: newWasteResponsible },
    ]);
    setNewWasteItem("");
    setNewWasteAmount("");
    setNewWasteResponsible("");
  };

  const handleRemoveWasteItem = (id: string) => {
    setStaffWasteList((prev) => prev.filter((s) => s.id !== id));
  };

  // Fast Direct Takeaway Virtual Table (حساب فوري بدون حجز طاولة)
  const directFastTakeawayTable: PosTable = {
    id: "DIRECT_TAKEAWAY",
    name: "تيك أواي فوري مباشر (بدون طاولة)",
    number: 997,
    type: TableType.REGULAR,
    status: TableStatus.AVAILABLE,
    capacity: 99,
    orders: [],
  };

  const handleStartDirectTakeaway = () => {
    setSelectedTable(directFastTakeawayTable);
    setOrderType("TAKEAWAY");
    setActiveOrderId(undefined);
    setCart([]);
    setIsCheckPrinted(false);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setActiveTab("ORDER");
  };

  // 10 Takeaway Phone Tables: Find first available slot
  const handleStartPhoneTakeaway = () => {
    const freePhoneTable =
      tables.find(
        (t) =>
          t.name.includes("تليفون") &&
          (t.status === TableStatus.AVAILABLE || !t.orders || t.orders.length === 0)
      ) || tables.find((t) => t.name.includes("تليفون"));

    if (freePhoneTable) {
      handleSelectTable(freePhoneTable, "TAKEAWAY");
    } else {
      const fallback = tables.find((t) => t.name.includes("تيك أواي")) || tables[0];
      if (fallback) handleSelectTable(fallback, "TAKEAWAY");
    }
  };

  // SPRINT 5: Action - End Shift (تقفيل وتسليم الوردية - ورقة تقفيل مشويات اولاد بسيوني الرسمية)
  const handleEndShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const actual = parseFloat(countedCash);
    if (isNaN(actual) || actual < 0) {
      alert("يرجى إدخال المبلغ الفعلي بعد الجرد بشكل صحيح.");
      return;
    }

    const expTotal = expensesList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const withTotal = withdrawalsList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const wasteTotal = staffWasteList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const grossSalesVal = parseFloat(closingGrossSales) || (activeShift.paidOrdersTotal || 0);
    const discountsVal = parseFloat(closingDiscounts) || 0;
    const visaVal = parseFloat(closingVisa) || 0;
    const otherBalanceVal = parseFloat(closingOtherBalance) || 0;
    const checksVal = parseFloat(closingManagementChecks) || 0;

    startTransition(async () => {
      const res = await endShift({
        shiftId: activeShift.id,
        actualCash: actual,
        notes: shiftNotes,
        grossSales: grossSalesVal,
        discounts: discountsVal,
        visaAmount: visaVal,
        otherBalance: otherBalanceVal,
        expensesTotal: expTotal,
        expensesDetails: expensesList,
        managementChecks: checksVal,
        staffWasteTotal: wasteTotal,
        staffWasteDetails: staffWasteList,
        managementWithdrawalsTotal: withTotal,
        managementWithdrawalsDetails: withdrawalsList,
        receivedBy: closingReceivedBy,
      });

      if (res?.error) {
        setShiftFeedback(`❌ ${res.error}`);
      } else if (res.shift) {
        setZReportData({
          shift: res.shift,
          stats: res.stats,
        });
        setActiveShift(null);
        setShowEndShiftModal(false);
        setCountedCash("");
        setShiftNotes("");
        setShiftFeedback(null);
        setClosingGrossSales("");
        setClosingDiscounts("0");
        setClosingVisa("0");
        setClosingOtherBalance("0");
        setClosingManagementChecks("0");
        setClosingReceivedBy("");
        setExpensesList([]);
        setWithdrawalsList([]);
        setStaffWasteList([]);
      }
    });
  };

  // Quick customer selection helper
  const handleSelectCustomer = (c: any) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setDeliveryAddress(c.address || "");
  };

  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName || !quickPhone) return;

    startTransition(async () => {
      const res = await createCustomer({
        name: quickName,
        phone: quickPhone,
        address: quickAddress,
        notes: quickNotes,
      });

      if (res.success && res.customer) {
        setCustomersList((prev) => [res.customer, ...prev]);
        setSelectedCustomerId(res.customer.id);
        setCustomerName(res.customer.name);
        setCustomerPhone(res.customer.phone);
        setDeliveryAddress(res.customer.address || "");
        setShowQuickCustomerModal(false);
        setQuickName("");
        setQuickPhone("");
        setQuickAddress("");
        setQuickNotes("");
      } else {
        alert(res.error || "فشل تسجيل العميل");
      }
    });
  };

  // Table Selection logic
  const handleSelectTable = (table: PosTable, forcedType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY") => {
    setSelectedTable(table);
    if (forcedType) {
      setOrderType(forcedType);
    } else if (table.name.includes("دليفري")) {
      setOrderType("DELIVERY");
    } else if (table.name.includes("تيك أواي")) {
      setOrderType("TAKEAWAY");
    } else {
      setOrderType("DINE_IN");
    }

    const existingOpenOrder =
      table.orders && table.orders.length > 0 ? table.orders[0] : null;

    if (existingOpenOrder) {
      setActiveOrderId(existingOpenOrder.id);
      setCart(
        existingOpenOrder.items.map((i) => {
          const cat = categories.find((c) => c.id === i.menuItem.categoryId);
          return {
            menuItemId: i.menuItemId,
            nameAr: i.menuItem.nameAr,
            categoryName: cat?.nameAr,
            price: i.unitPrice,
            quantity: i.quantity,
            notes: i.notes || undefined,
          };
        })
      );
    } else {
      setActiveOrderId(undefined);
      setCart([]);
    }

    setIsCheckPrinted(false);
    setActiveTab("ORDER");
  };

  // Add Item to Cart
  const handleAddToCart = (item: PosMenuItem) => {
    if (!selectedTable) {
      // Auto-fallback: if no table is selected and user clicks item, pick the first available or delivery table
      const fallback = tables[0];
      if (fallback) {
        handleSelectTable(fallback);
      } else {
        alert("يرجى اختيار طاولة أو نوع الطلب أولاً قبل إضافة الأصناف!");
        setActiveTab("MAP");
        return;
      }
    }

    const cat = categories.find((c) => c.id === item.categoryId);

    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          nameAr: item.nameAr,
          categoryName: cat?.nameAr,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const handleUpdateQuantity = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.menuItemId === menuItemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (menuItemId: string) => {
    setCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  // Check Complimentary status for selected table
  const isComplimentary =
    selectedTable?.type === TableType.OWNER ||
    selectedTable?.type === TableType.MANAGER;

  // Delivery Fee Calculation (Open field as requested by user)
  const deliveryFeeNumber = orderType === "DELIVERY" ? (parseFloat(deliveryFee) || 0) : 0;
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = isComplimentary ? (subtotal + deliveryFeeNumber) : 0;
  const totalAmount = isComplimentary ? 0 : (subtotal + deliveryFeeNumber);

  // SPRINT 4: Action A - Send to Prep (حفظ وطباعة الأوردر)
  const handleSendToPrep = () => {
    if (!selectedTable) return;
    if (cart.length === 0) {
      alert("السلة فارغة! يرجى إضافة أصناف أولاً.");
      return;
    }

    startTransition(async () => {
      const res = await sendOrderToPrep({
        orderId: activeOrderId,
        tableId: selectedTable.id,
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

      // Execute Order Routing to Kitchen, Barista, Shisha, and Customer Check
      const routeRes = await routeAndPrintPrepOrder({
        tableName: selectedTable.name,
        orderNumber: res.order?.orderNumber,
        orderType,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        deliveryFee: deliveryFeeNumber,
        items: cart,
        subtotal,
        discount,
        totalAmount,
        isComplimentary,
        notes: orderNotes,
        cashierName: userName,
      });

      // طباعة بون التحضير / الشيك تلقائياً على طابعة Xprinter 80mm
      await triggerSilentThermalPrint({
        title:
          orderType === "DELIVERY"
            ? "بون دليفري (توصيل)"
            : orderType === "TAKEAWAY"
            ? "بون تيك أواي (سفري)"
            : "بون تحضير الصالة (KITCHEN/BAR)",
        receiptType: "PREP",
        tableName: selectedTable.name,
        orderNumber: res.order?.orderNumber,
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
        isComplimentary,
        notes: orderNotes || undefined,
        cashierName: userName,
        isPaid: false,
        timestamp: new Date(),
      });

      // Display multi-ticket preparation modal (drawerKicked: false)
      setRoutedModal({
        title: "تم حفظ وتوجيه بونات التحضير والطباعة بنجاح ✓",
        subtitle: `${selectedTable.name} • (تمت الطباعة تلقائياً على Xprinter 80mm - درج النقدية مغلق)`,
        isPayment: false,
        drawerKicked: false,
        tickets: routeRes.tickets,
        activeTicketIndex: 0,
      });

      // Update local table status to OCCUPIED if regular table
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTable.id
            ? {
                ...t,
                status: TableStatus.OCCUPIED,
                orders: res.order ? [res.order as any] : t.orders,
              }
            : t
        )
      );
      if (res.order) setActiveOrderId(res.order.id);

      // Refresh shift metrics
      if (userId) {
        const updated = await getActiveShift(userId);
        if (updated.activeShift) setActiveShift(updated.activeShift);
      }
    });
  };

  // تقفيل الشيك: طباعة فاتورة العميل لطاولة الصالة (دون فتح الدرج)، وتحويل الزر لفتح الدرج بالتحصيل
  const handlePrintCustomerCheck = () => {
    if (!selectedTable) return;
    if (cart.length === 0 && !activeOrderId) {
      alert("لا توجد أصناف في الطلب لتقفيل الشيك!");
      return;
    }

    startTransition(async () => {
      let orderNum = activeOrderId ? parseInt(activeOrderId.slice(-4)) : undefined;

      // إذا لم يكن الطلب محفوظاً بعد في الداتابيز، يتم حفظه أولاً
      if (!activeOrderId && cart.length > 0) {
        const res = await sendOrderToPrep({
          orderId: activeOrderId,
          tableId: selectedTable.id,
          orderType,
          customerId: selectedCustomerId || undefined,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          deliveryAddress: deliveryAddress || undefined,
          deliveryFee: deliveryFeeNumber,
          items: cart,
          notes: orderNotes,
        });

        if (res.order) {
          setActiveOrderId(res.order.id);
          orderNum = res.order.orderNumber;
          setTables((prev) =>
            prev.map((t) =>
              t.id === selectedTable.id
                ? {
                    ...t,
                    status: TableStatus.OCCUPIED,
                    orders: [res.order as any],
                  }
                : t
            )
          );
        }
      }

      // طباعة شيك العميل الفعلي عبر المتصفح → Xprinter 80mm (HTML + window.print)
      // مع --kiosk-printing: تطبع صامتة. بدونه: تفتح print preview.
      await triggerSilentThermalPrint({
        title: "شيك حساب العميل (CUSTOMER CHECK)",
        receiptType: "CHECK",
        tableName: selectedTable.name,
        orderNumber: orderNum,
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
        isComplimentary,
        notes: orderNotes || undefined,
        cashierName: userName,
        isPaid: false,
        timestamp: new Date(),
      });

      // تم تقفيل الشيك -> تفعيل حالة طباعة الشيك ليتحول الزر لفتح الدرج بالتحصيل
      setIsCheckPrinted(true);

      // عرض تأكيد تقفيل الشيك (الطباعة تمت فعلياً عبر window.print)
      setRoutedModal({
        title: "🧾 تم تقفيل وطباعة شيك العميل",
        subtitle: `${selectedTable.name} • تم إرسال الشيك للطابعة (جاهز للتحصيل وفتح الدرج)`,
        isPayment: false,
        drawerKicked: false,
        tickets: [],
        activeTicketIndex: 0,
      });
    });
  };

  // SPRINT 4 & REQ: Collect Payment (فتح درج النقدية والتحصيل بدون أي رسالة تأكيد)
  const handleCollectPayment = () => {
    if (!selectedTable) return;
    if (cart.length === 0 && !activeOrderId) {
      alert("لا يوجد طلب مفتوح أو أصناف لتحصيلها!");
      return;
    }

    // تنبيه المستخدم تم إلغاؤه تماماً بناء على طلب العميل (بدون رسالة تأكيد)
    startTransition(async () => {
      const res = await collectOrderPayment({
        orderId: activeOrderId,
        tableId: selectedTable.id,
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


      // طباعة فاتورة الدفع الفعلية عبر المتصفح → Xprinter 80mm (HTML + window.print)
      // مع --kiosk-printing: تطبع صامتة فوراً. درج النقدية يفتح عبر Windows printer driver.
      await triggerSilentThermalPrint({
        title: "فاتورة سداد نقدي (PAID RECEIPT)",
        receiptType: "RECEIPT",
        tableName: selectedTable.name,
        orderNumber: activeOrderId ? parseInt(activeOrderId.slice(-4)) : undefined,
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
        isComplimentary,
        notes: orderNotes || undefined,
        cashierName: userName,
        isPaid: true,
        timestamp: new Date(),
      });

      // Display final paid receipt confirmation modal
      setRoutedModal({
        title: "تم التحصيل وسداد الحساب بنجاح ✓",
        subtitle: `${selectedTable.name} • ✅ تمت الطباعة على Xprinter 80mm`,
        isPayment: true,
        drawerKicked: false,
        tickets: [],
        activeTicketIndex: 0,
      });

      const isDirectFastTakeaway = selectedTable.id === "DIRECT_TAKEAWAY";

      // Free table locally if not virtual fast takeaway
      if (!isDirectFastTakeaway) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === selectedTable.id
              ? { ...t, status: TableStatus.AVAILABLE, orders: [] }
              : t
          )
        );

        // Reset cart and check state and return to map
        setCart([]);
        setActiveOrderId(undefined);
        setSelectedTable(null);
        setIsCheckPrinted(false);
        setActiveTab("MAP");
      } else {
        // FAST TAKEAWAY (بدون طاولة): تفريغ السلة والبقاء في شاشة المنيو فوراً لخدمة العميل التالي
        setCart([]);
        setActiveOrderId(undefined);
        setIsCheckPrinted(false);
        setCustomerName("");
        setCustomerPhone("");
        setOrderNotes("");
      }

      // Refresh shift metrics
      if (userId) {
        const updated = await getActiveShift(userId);
        if (updated.activeShift) setActiveShift(updated.activeShift);
      }
    });
  };

  // Filtered menu items
  const filteredMenuItems = menuItems.filter((item) => {
    const matchCat =
      selectedCategory === "ALL" || item.categoryId === selectedCategory;
    const matchSearch = item.nameAr
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // Calculate live expected cash for current active shift
  const liveExpected = activeShift
    ? (activeShift.initialCash || 0) + (activeShift.paidOrdersTotal || 0)
    : 0;

  const actualCountedNum = parseFloat(countedCash) || 0;
  const liveShortageOverage = countedCash !== "" ? actualCountedNum - liveExpected : 0;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top POS Kiosk Navigation Bar */}
      <header className="bg-primary-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-primary-800 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-primary-950 font-black flex items-center justify-center text-sm shadow">
              مب
            </div>
            <span className="font-black text-base tracking-wide">
              مشويات اولاد بسيوني POS
            </span>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-primary-900 rounded-xl p-1 border border-primary-800">
            <button
              onClick={() => setActiveTab("MAP")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "MAP"
                  ? "bg-amber-500 text-primary-950 shadow"
                  : "text-primary-200 hover:text-white"
              }`}
            >
              <span>🪑</span>
              <span>خريطة الصالة (28 طاولة)</span>
            </button>
            <button
              onClick={() => {
                if (!selectedTable) {
                  alert("يرجى اختيار طاولة أولاً من الخريطة");
                  return;
                }
                setActiveTab("ORDER");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "ORDER"
                  ? "bg-amber-500 text-primary-950 shadow"
                  : "text-primary-200 hover:text-white"
              }`}
            >
              <span>🍽️</span>
              <span>
                تسجيل الطلب {selectedTable ? `(${selectedTable.name})` : ""}
              </span>
            </button>
          </div>
        </div>

        {/* Right side: Shift Pill + Hardware Web Serial + Admin link */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* SPRINT 5: Shift Status Pill & Handover Enforcer */}
          {activeShift ? (
            <button
              onClick={() => setShowEndShiftModal(true)}
              className={`px-3 py-1.5 rounded-xl font-bold border transition flex items-center gap-2 shadow-sm ${
                hasExceeded12Hours
                  ? "bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse"
                  : "bg-primary-900/80 border-primary-700 text-amber-300 hover:bg-primary-800"
              }`}
              title="اضغط لتقفيل الوردية والجرد النقدي (End Shift)"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  hasExceeded12Hours ? "bg-rose-500" : "bg-emerald-400"
                }`}
              ></span>
              <div className="text-right">
                <p className="leading-tight">
                  وردية #{activeShift.shiftNumber} • {shiftTimer}
                </p>
                {hasExceeded12Hours && (
                  <p className="text-[10px] text-rose-400 font-black">
                    🚨 تجاوزت 12 ساعة (يجب التسليم)
                  </p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] mr-1">
                تسليم الوردية 📋
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowStartShiftModal(true)}
              className="px-3.5 py-1.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-primary-950 transition flex items-center gap-1.5 shadow"
            >
              <span>⏱️</span>
              <span>فتح وردية جديدة</span>
            </button>
          )}

          {/* Automatic Xprinter 80mm Thermal Printing Badge */}
          <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/60 rounded-xl px-2.5 py-1 text-emerald-300 text-xs font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>🖨️ Xprinter 80mm تلقائي</span>
            <button
              onClick={() => triggerTestPrint(userName)}
              className="mr-1 px-2 py-0.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-sm active:scale-95"
              title="تجربة طباعة فاتورة اختبار فورية على طابعة Xprinter"
            >
              طباعة تجربة
            </button>
            <button
              onClick={() => setShowPrinterSettings(true)}
              className="px-1.5 py-0.5 rounded-lg hover:bg-emerald-900/60 text-emerald-300 text-[10px] transition"
              title="إعدادات الطابعة ودرج النقدية"
            >
              ⚙️
            </button>
          </div>

          <Link
            href="/dashboard/reports"
            className="px-3 py-1.5 rounded-xl bg-primary-800 hover:bg-primary-700 text-emerald-300 font-bold transition flex items-center gap-1"
          >
            <span>📊</span>
            <span>التقارير</span>
          </Link>

          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-xl bg-primary-800 hover:bg-primary-700 text-amber-300 font-bold transition"
          >
            ⚙️
          </Link>
        </div>
      </header>

      {/* SPRINT 5: 12-Hour Shift Warning Banner */}
      {hasExceeded12Hours && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-base">🚨</span>
            <span>
              تنبيه إداري: الوردية رقم #{activeShift?.shiftNumber} تجاوزت الحد الأقصى المسموح به (12 ساعة عمل متواصلة). يرجى تقفيل الوردية وتسليم العهدة الآن!
            </span>
          </div>
          <button
            onClick={() => setShowEndShiftModal(true)}
            className="px-3 py-1 bg-white text-rose-700 rounded-lg font-black hover:bg-rose-50 transition"
          >
            تقفيل الوردية فوراً 📋
          </button>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* VIEW 1: Visual Table Map */}
        {activeTab === "MAP" && (
          <div className="flex-1 p-6 overflow-y-auto bg-slate-100 space-y-6">
            {/* Top Quick Actions: Direct Takeaway (بدون طاولة), Phone Takeaway (10 طاولات), Delivery, Customers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option: Punch Takeaway and Cash out immediately without table */}
              <button
                onClick={handleStartDirectTakeaway}
                className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-700 hover:to-teal-900 text-white p-4 rounded-2xl shadow-md flex items-center justify-between text-right active:scale-[0.99] transition group border border-emerald-500/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl animate-bounce">⚡</span>
                    <h3 className="font-black text-base">تيك أواي فوري (بدون طاولة)</h3>
                  </div>
                  <p className="text-xs text-emerald-100 mt-1">
                    أضرب تيك أواي وحاسب على طول من غير حجز أي طاولة
                  </p>
                </div>
                <span className="w-8 h-8 rounded-xl bg-white/20 text-white font-black flex items-center justify-center text-sm group-hover:bg-white group-hover:text-emerald-800 transition">
                  ←
                </span>
              </button>

              {/* 10 Phone Takeaway Tables for Phone Pickup Orders */}
              <button
                onClick={handleStartPhoneTakeaway}
                className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-800 hover:from-amber-700 hover:to-orange-900 text-white p-4 rounded-2xl shadow-md flex items-center justify-between text-right active:scale-[0.99] transition group border border-amber-500/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📞</span>
                    <h3 className="font-black text-base">أوردر تليفون تيك أواي (10)</h3>
                  </div>
                  <p className="text-xs text-amber-100 mt-1">
                    حجز خانة تيك أواي هاتف للاستلام عند وصول العميل
                  </p>
                </div>
                <span className="w-8 h-8 rounded-xl bg-white/20 text-white font-black flex items-center justify-center text-sm group-hover:bg-white group-hover:text-amber-800 transition">
                  ←
                </span>
              </button>

              {/* Delivery */}
              <button
                onClick={() => {
                  const delTable =
                    tables.find((t) => t.name.includes("دليفري")) || tables[0];
                  if (delTable) handleSelectTable(delTable, "DELIVERY");
                }}
                className="bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white p-4 rounded-2xl shadow-md flex items-center justify-between text-right active:scale-[0.99] transition group border border-blue-600/30"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛵</span>
                    <h3 className="font-black text-base">طلب دليفري جديد (توصيل)</h3>
                  </div>
                  <p className="text-xs text-blue-100 mt-1">
                    تسجيل عميل وتحديد رسوم توصيل
                  </p>
                </div>
                <span className="w-8 h-8 rounded-xl bg-white/20 text-white font-black flex items-center justify-center text-sm group-hover:bg-white group-hover:text-blue-900 transition">
                  ←
                </span>
              </button>

              {/* Customers Directory */}
              <Link
                href="/dashboard/customers"
                className="bg-white border border-slate-200 hover:border-amber-400 p-4 rounded-2xl shadow-sm flex items-center justify-between text-right transition group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👥</span>
                    <h3 className="font-black text-base text-slate-800 group-hover:text-amber-700">
                      دليل العملاء والهواتف
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    📞 خدمة العملاء: 01558962994
                  </p>
                </div>
                <span className="text-xs bg-amber-50 text-amber-800 font-bold px-2.5 py-1 rounded-lg">
                  {customersList.length} عميل
                </span>
              </Link>
            </div>

            {/* Table Filters & Distribution */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setTableFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    tableFilter === "ALL" ? "bg-primary-900 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  الكل ({tables.length})
                </button>
                <button
                  onClick={() => setTableFilter("PHONE_TAKEAWAY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    tableFilter === "PHONE_TAKEAWAY" ? "bg-amber-600 text-white shadow-sm" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  <span>📞</span>
                  <span>تيك أواي تليفون ({tables.filter(t => t.name.includes("تليفون")).length})</span>
                </button>
                <button
                  onClick={() => setTableFilter("REGULAR")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    tableFilter === "REGULAR" ? "bg-slate-800 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  طاولات عادية ({tables.filter(t => t.type === TableType.REGULAR && !t.name.includes("تليفون") && !t.name.includes("تيك أواي") && !t.name.includes("دليفري")).length})
                </button>
                <button
                  onClick={() => setTableFilter("FAMILY")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    tableFilter === "FAMILY" ? "bg-indigo-600 text-white shadow-sm" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  باكيات عائلات ({tables.filter(t => t.type === TableType.FAMILY_BOOTH).length})
                </button>
                <button
                  onClick={() => setTableFilter("VIP")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    tableFilter === "VIP" ? "bg-amber-600 text-white shadow-sm" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  طاولات VIP ({tables.filter(t => t.type === TableType.VIP).length})
                </button>
                <button
                  onClick={() => setTableFilter("SPECIAL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    tableFilter === "SPECIAL" ? "bg-purple-600 text-white shadow-sm" : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  المالك والمدير ({tables.filter(t => t.type === TableType.OWNER || t.type === TableType.MANAGER).length})
                </button>
              </div>

              {/* Status Legend */}
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span>متاحة</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>مشغولة</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span>تيك أواي هاتف</span>
                </span>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3.5">
              {tables
                .filter((table) => {
                  if (tableFilter === "ALL") return true;
                  if (tableFilter === "PHONE_TAKEAWAY") return table.name.includes("تليفون");
                  if (tableFilter === "FAMILY") return table.type === TableType.FAMILY_BOOTH;
                  if (tableFilter === "VIP") return table.type === TableType.VIP;
                  if (tableFilter === "REGULAR")
                    return (
                      table.type === TableType.REGULAR &&
                      !table.name.includes("تليفون") &&
                      !table.name.includes("تيك أواي") &&
                      !table.name.includes("دليفري")
                    );
                  if (tableFilter === "SPECIAL")
                    return (
                      table.type === TableType.OWNER ||
                      table.type === TableType.MANAGER
                    );
                  return true;
                })
                .map((table) => {
                const hasOpenOrder = table.orders && table.orders.length > 0;
                const isSpecial =
                  table.type === TableType.OWNER ||
                  table.type === TableType.MANAGER;
                const isPhoneTakeaway = table.name.includes("تليفون");

                let cardBg = "bg-white border-slate-200 hover:border-primary-400";
                let statusBadge =
                  "bg-emerald-100 text-emerald-800 border-emerald-200";
                let statusLabel = "متاحة";

                if (hasOpenOrder || table.status === TableStatus.OCCUPIED) {
                  cardBg = isPhoneTakeaway
                    ? "bg-amber-50/90 border-amber-400 ring-2 ring-amber-300"
                    : "bg-rose-50/70 border-rose-300 ring-2 ring-rose-200";
                  statusBadge = isPhoneTakeaway
                    ? "bg-amber-500 text-white border-amber-600"
                    : "bg-rose-500 text-white border-rose-600";
                  statusLabel = isPhoneTakeaway ? "قيد الاستلام" : "مشغولة";
                } else if (isPhoneTakeaway) {
                  cardBg = "bg-amber-50/40 border-amber-200 hover:border-amber-400";
                  statusBadge = "bg-amber-100 text-amber-900 border-amber-300";
                  statusLabel = "جاهزة للحجز";
                } else if (isSpecial) {
                  cardBg = "bg-purple-50/60 border-purple-300";
                  statusBadge =
                    "bg-purple-100 text-purple-800 border-purple-200";
                  statusLabel = "طاولة خاصة";
                }

                return (
                  <button
                    key={table.id}
                    onClick={() => handleSelectTable(table)}
                    className={`${cardBg} rounded-2xl p-4 border text-right transition duration-200 shadow-sm hover:shadow-lg flex flex-col justify-between h-36 relative overflow-hidden group`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}
                        >
                          {statusLabel}
                        </span>
                        {isSpecial && (
                          <span
                            className="text-[11px] font-bold text-amber-600"
                            title="أوردرات هذه الطاولة ضيافة تلقائياً"
                          >
                            👑 ضيافة
                          </span>
                        )}
                        {isPhoneTakeaway && (
                          <span className="text-[11px] font-black text-amber-700">
                            📞 هاتف
                          </span>
                        )}
                      </div>

                      <h3 className="font-black text-slate-800 text-sm group-hover:text-primary-800 transition line-clamp-1">
                        {table.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        سعة {table.capacity} أفراد{" "}
                        {table.number ? `• #${table.number}` : ""}
                      </p>
                    </div>

                    {hasOpenOrder ? (
                      <div className={`${isPhoneTakeaway ? "bg-amber-100/90 border border-amber-300" : "bg-rose-100"} p-1.5 rounded-lg text-center`}>
                        {isPhoneTakeaway && table.orders[0].customerName && (
                          <p className="text-[10px] font-black text-amber-950 truncate">
                            👤 {table.orders[0].customerName}
                          </p>
                        )}
                        <p className={`text-[10px] font-bold ${isPhoneTakeaway ? "text-amber-900" : "text-rose-800"}`}>
                          أوردر #{table.orders[0].orderNumber}
                        </p>
                        <p className={`text-xs font-mono font-black ${isPhoneTakeaway ? "text-amber-950" : "text-rose-900"}`}>
                          {table.orders[0].isComplimentary
                            ? "ضيافة (0 ج.م)"
                            : `${table.orders[0].totalAmount.toFixed(2)} ج.م`}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold text-primary-600 text-center py-1 bg-slate-50 rounded-lg group-hover:bg-primary-50 transition">
                        + فتح طلب جديد
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: Menu Items Grid & Shopping Cart */}
        {activeTab === "ORDER" && selectedTable && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* RIGHT: Menu Grid */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-4 border-l border-slate-200">
              {/* Category Filter & Search Bar */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث عن صنف أو وجبة أو مشروب أو شيشة..."
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <span className="absolute right-3.5 top-3 text-slate-400">
                      🔍
                    </span>
                  </div>

                  <button
                    onClick={() => setActiveTab("MAP")}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0"
                  >
                    تغيير الطاولة 🪑
                  </button>
                </div>

                {/* Categories Tab */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedCategory("ALL")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                      selectedCategory === "ALL"
                        ? "bg-primary-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    الكل ({menuItems.length})
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                        selectedCategory === c.id
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {c.nameAr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Items Touch Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-400 active:scale-95 transition text-right flex flex-col justify-between min-h-[7.5rem] group relative overflow-hidden"
                  >
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm group-hover:text-primary-800 transition line-clamp-2">
                        {item.nameAr}
                      </h4>
                      {item.description && (
                        <p
                          className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-snug font-normal bg-amber-50/60 p-1 rounded-md border border-amber-200/60"
                          title={item.description}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                      <span className="font-mono font-black text-amber-700 text-sm sm:text-base">
                        {item.price.toFixed(2)} ج.م
                      </span>
                      <span className="w-7 h-7 rounded-lg bg-primary-50 group-hover:bg-primary-700 group-hover:text-white text-primary-800 font-bold flex items-center justify-center transition text-sm">
                        +
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* LEFT: Shopping Cart & Cashier Actions */}
            <div className="w-full lg:w-96 bg-white border-r border-slate-200 flex flex-col h-full shadow-xl">
              {/* Cart Header (Order Type Switcher + Table/Customer Info) */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50 space-y-3">
                {/* 1. Order Type Switcher */}
                <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-black">
                  <button
                    onClick={() => setOrderType("DINE_IN")}
                    className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                      orderType === "DINE_IN"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>🍽️</span>
                    <span>صالة</span>
                  </button>
                  <button
                    onClick={() => setOrderType("TAKEAWAY")}
                    className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                      orderType === "TAKEAWAY"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>🥡</span>
                    <span>تيك أواي</span>
                  </button>
                  <button
                    onClick={() => setOrderType("DELIVERY")}
                    className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                      orderType === "DELIVERY"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>🛵</span>
                    <span>دليفري</span>
                  </button>
                </div>

                {/* 2. Order Context Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {orderType === "DELIVERY"
                        ? "🛵"
                        : orderType === "TAKEAWAY"
                        ? "🥡"
                        : "🪑"}
                    </span>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">
                        {orderType === "DELIVERY"
                          ? "طلب توصيل (دليفري)"
                          : orderType === "TAKEAWAY"
                          ? "طلب سفري (تيك أواي)"
                          : selectedTable.name}
                      </h3>
                      <p className="text-[10px] text-slate-500">
                        {activeOrderId
                          ? `طلب مفتوح رقم: #${activeOrderId.slice(-4)}`
                          : "طلب جديد (قيد التجهيز)"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCart([])}
                    disabled={cart.length === 0}
                    className="text-xs font-bold text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
                  >
                    تفريغ السلة
                  </button>
                </div>

                {/* 3. Delivery Customer Selection & Open Delivery Fee */}
                {orderType === "DELIVERY" && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 flex items-center gap-1">
                        <span>👤 بيانات عميل التوصيل:</span>
                      </span>
                      <button
                        onClick={() => setShowQuickCustomerModal(true)}
                        className="text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded-lg transition shadow-xs"
                      >
                        + عميل جديد
                      </button>
                    </div>

                    {/* Customer Select Dropdown */}
                    <select
                      value={selectedCustomerId || ""}
                      onChange={(e) => {
                        const cid = e.target.value;
                        if (!cid) {
                          setSelectedCustomerId(null);
                          setCustomerName("");
                          setCustomerPhone("");
                          setDeliveryAddress("");
                        } else {
                          const c = customersList.find((x) => x.id === cid);
                          if (c) handleSelectCustomer(c);
                        }
                      }}
                      className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none font-semibold"
                    >
                      <option value="">-- اختر من قائمة العملاء المسجلين --</option>
                      {customersList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} - 📞 {c.phone}
                        </option>
                      ))}
                    </select>

                    {/* Manual inputs if customer not selected or to override */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="اسم العميل *"
                        className="bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-slate-800 outline-none text-xs"
                      />
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="رقم الهاتف *"
                        className="bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-slate-800 outline-none text-xs font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="عنوان التوصيل بالتفصيل (عبد القادر / المستعمرة)..."
                      className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-slate-800 outline-none text-xs"
                    />

                    {/* Open Delivery Fee Input (CRITICAL USER REQUIREMENT) */}
                    <div className="pt-1 border-t border-amber-300/60">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-black text-amber-950 flex items-center gap-1">
                          <span>🛵 رسوم التوصيل:</span>
                          <span className="text-[10px] font-normal text-amber-800">
                            (خانة مفتوحة للمناطق البعيدة)
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={deliveryFee}
                            onChange={(e) => setDeliveryFee(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white border-2 border-amber-500 rounded-xl px-3 py-1.5 text-sm font-black font-mono text-amber-900 outline-none focus:ring-2 focus:ring-amber-500/40"
                          />
                          <span className="absolute left-2.5 top-2 text-xs text-amber-700 font-bold">
                            ج.م
                          </span>
                        </div>
                        {/* Quick Preset Chips */}
                        <div className="flex items-center gap-1">
                          {[15, 25, 35, 50].map((fee) => (
                            <button
                              key={fee}
                              type="button"
                              onClick={() => setDeliveryFee(fee.toString())}
                              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition ${
                                deliveryFee === fee.toString()
                                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                  : "bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
                              }`}
                            >
                              +{fee}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Takeaway Customer Name & Direct Fast Notice */}
                {orderType === "TAKEAWAY" && (
                  <div className={`${selectedTable?.id === "DIRECT_TAKEAWAY" ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200" : "bg-slate-100 border-slate-200"} border rounded-xl p-2.5 space-y-1.5`}>
                    {selectedTable?.id === "DIRECT_TAKEAWAY" ? (
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-emerald-800 flex items-center gap-1">
                          <span className="animate-bounce">⚡</span>
                          <span>كاشير تيك أواي فوري مباشر (بدون طاولة)</span>
                        </span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                          محاسبة فورية
                        </span>
                      </div>
                    ) : (
                      <label className="text-xs font-bold text-slate-700 block">
                        اسم عميل السفري / هاتف الاستلام (اختياري):
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="اسم العميل (اختياري)..."
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 outline-none"
                      />
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="رقم الهاتف (اختياري)..."
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 outline-none font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* SPECIAL LOGIC: Complimentary Banner for Owner / Manager table */}
                {isComplimentary && orderType === "DINE_IN" && (
                  <div className="bg-amber-100 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-900 font-bold flex items-center gap-2 animate-pulse">
                    <span className="text-base">👑</span>
                    <div>
                      <p className="font-black">
                        طلب ضيافة (Complimentary Order)
                      </p>
                      <p className="text-[10px] font-medium text-amber-800">
                        طاولة خاصة بالمالك/المدير - يتم إعفاء الحساب بنسبة 100% ولا يدخل في نقدية الوردية.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
                    <span className="text-4xl mb-2">🛒</span>
                    <p className="font-bold text-sm">السلة فارغة حالياً</p>
                    <p className="text-xs mt-1">
                      اضغط على الأصناف من القائمة لإضافتها للطلب
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.menuItemId}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-slate-800 text-xs truncate">
                          {item.nameAr}
                        </p>
                        <p className="font-mono text-xs text-slate-500 mt-0.5">
                          {item.price.toFixed(2)} ج.م × {item.quantity} ={" "}
                          <strong className="text-slate-800">
                            {(item.price * item.quantity).toFixed(2)} ج.م
                          </strong>
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            handleUpdateQuantity(item.menuItemId, -1)
                          }
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="w-5 text-center font-bold font-mono text-xs text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            handleUpdateQuantity(item.menuItemId, 1)
                          }
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs hover:bg-slate-100"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.menuItemId)}
                          className="text-slate-400 hover:text-rose-600 p-1 mr-1"
                          title="حذف"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer & Action Workflow */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                {/* Notes Input */}
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="ملاحظات على الطلب (مثال: بدون بصل، سكر برة)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none bg-white focus:ring-1 focus:ring-primary-500"
                />

                {/* Subtotals & Totals */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>مجموع الأصناف:</span>
                    <span className="font-mono font-bold">
                      {subtotal.toFixed(2)} ج.م
                    </span>
                  </div>

                  {orderType === "DELIVERY" && deliveryFeeNumber > 0 && (
                    <div className="flex justify-between text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded">
                      <span>رسوم التوصيل (مفتوحة):</span>
                      <span className="font-mono">
                        +{deliveryFeeNumber.toFixed(2)} ج.م
                      </span>
                    </div>
                  )}

                  {isComplimentary && (
                    <div className="flex justify-between text-amber-700 font-bold">
                      <span>خصم الضيافة (100%):</span>
                      <span className="font-mono">
                        -{discount.toFixed(2)} ج.م
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>المطلوب تحصيله:</span>
                    <span className="font-mono text-base text-primary-900">
                      {totalAmount.toFixed(2)} ج.م
                    </span>
                  </div>
                </div>

                {/* DINE-IN VS TAKEAWAY/DELIVERY WORKFLOW */}
                {orderType === "DINE_IN" ? (
                  <div className="space-y-2 pt-1">
                    {!isCheckPrinted ? (
                      /* قبل تقفيل الشيك: إرسال للتحضير أو تقفيل الشيك */
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={isPending || cart.length === 0}
                          onClick={handleSendToPrep}
                          className="py-3 px-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>🖨️</span>
                          <span>إرسال للتحضير</span>
                        </button>

                        <button
                          disabled={isPending || (cart.length === 0 && !activeOrderId)}
                          onClick={handlePrintCustomerCheck}
                          className="py-3 px-2 rounded-xl text-xs font-black text-amber-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:opacity-90 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-1.5 border border-amber-600/30"
                        >
                          <span>🧾</span>
                          <span>تقفيل الشيك (طباعة)</span>
                        </button>
                      </div>
                    ) : (
                      /* بعد طباعة الشيك -> زر فتح الدرج والتحصيل المباشر */
                      <div className="space-y-1.5 animate-fade-in">
                        <button
                          disabled={isPending || (cart.length === 0 && !activeOrderId)}
                          onClick={handleCollectPayment}
                          className="w-full py-3.5 px-4 rounded-2xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition shadow-lg ring-4 ring-emerald-500/30 flex items-center justify-between"
                        >
                          <span className="text-xl">🚪</span>
                          <span>فتح الدرج والتحصيل ({totalAmount.toFixed(2)} ج.م)</span>
                          <span className="text-xl">💵</span>
                        </button>

                        <div className="flex items-center justify-between px-1 pt-0.5">
                          <button
                            type="button"
                            onClick={handlePrintCustomerCheck}
                            className="text-[11px] text-slate-500 hover:text-slate-800 underline font-semibold flex items-center gap-1"
                          >
                            <span>🖨️ إعادة طباعة الفاتورة</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSendToPrep}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-semibold flex items-center gap-1"
                          >
                            <span>+ إضافة أصناف جديدة</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* بالنسبة للدليفري والتيك أواي */
                  <div className="space-y-2 pt-1">
                    {selectedTable?.id === "DIRECT_TAKEAWAY" ? (
                      /* FAST TAKEAWAY DIRECT CHECKOUT WITHOUT TABLE */
                      <div className="space-y-2 animate-fade-in">
                        <button
                          disabled={isPending || cart.length === 0}
                          onClick={handleCollectPayment}
                          className="w-full py-4 px-4 rounded-2xl text-base font-black text-white bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-700 hover:to-teal-900 active:scale-[0.99] disabled:opacity-50 transition shadow-lg ring-4 ring-emerald-500/30 flex items-center justify-between"
                        >
                          <span className="text-2xl">🚪</span>
                          <span>⚡ تحصيل كاش فوري وفتح الدرج ({totalAmount.toFixed(2)} ج.م)</span>
                          <span className="text-2xl">💵</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={isPending || cart.length === 0}
                          onClick={handleSendToPrep}
                          className="py-3 px-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>🖨️</span>
                          <span>إرسال للتحضير</span>
                        </button>

                        <button
                          disabled={isPending || (cart.length === 0 && !activeOrderId)}
                          onClick={handleCollectPayment}
                          className="py-3 px-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <span>💳</span>
                          <span>تحصيل وفتح الدرج ({totalAmount.toFixed(2)} ج.م)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SPRINT 5: Start New Shift Modal */}
      {showStartShiftModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl">
                  ⏱️
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    فتح وردية كاشير جديدة
                  </h3>
                  <p className="text-xs text-slate-500">
                    بدء فترة العمل وتسجيل العهدة النقدية الافتتاحية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStartShiftModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {shiftFeedback && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
                {shiftFeedback}
              </div>
            )}

            <form onSubmit={handleStartShiftSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  العهدة الافتتاحية في درج النقدية (ج.م):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-base font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  المبلغ الموجود بالدرج في بداية الوردية (الفكة الافتتاحية).
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ملاحظات افتتاح الوردية (اختياري):
                </label>
                <input
                  type="text"
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="مثال: تسلمت فكة 200 ج.م من الوردية السابقة..."
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-primary-950 font-black text-sm shadow-md transition disabled:opacity-50"
                >
                  {isPending ? "جاري فتح الوردية..." : "تأكيد فتح الوردية وتصفير العداد 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SPRINT 5 & REQ: End Shift & Handover Modal (ورقة تقفيل مشويات اولاد بسيوني الرسمية) */}
      {showEndShiftModal && activeShift && (() => {
        const expTotal = expensesList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const withTotal = withdrawalsList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        const wasteTotal = staffWasteList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        const grossVal = closingGrossSales !== "" ? (parseFloat(closingGrossSales) || 0) : (activeShift.paidOrdersTotal || 0);
        const discVal = parseFloat(closingDiscounts) || 0;
        const visaVal = parseFloat(closingVisa) || 0;
        const otherVal = parseFloat(closingOtherBalance) || 0;
        const checksVal = parseFloat(closingManagementChecks) || 0;

        const liveExpectedClosing = Math.max(
          0,
          (activeShift.initialCash || 0) + grossVal - discVal - visaVal - otherVal - expTotal - checksVal - withTotal
        );

        const diff = countedCash !== "" ? (parseFloat(countedCash) || 0) - liveExpectedClosing : 0;
        const todayArabicDay = new Date().toLocaleDateString("ar-EG", { weekday: "long" });
        const todayArabicDate = new Date().toLocaleDateString("ar-EG");

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl text-right space-y-4 max-h-[94vh] overflow-y-auto border border-slate-100">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center text-xl font-bold">
                    📋
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">
                      ورقة التقفيل الرسمية - مشويات اولاد بسيوني
                    </h3>
                    <p className="text-xs text-slate-500">
                      وردية #{activeShift.shiftNumber} • الكاشير: {userName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEndShiftModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {shiftFeedback && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
                  {shiftFeedback}
                </div>
              )}

              {/* Sub-Tabs: Main Voucher, Expenses, Withdrawals, Waste */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveClosingSubTab("SUMMARY")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    activeClosingSubTab === "SUMMARY"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>📋</span>
                  <span>الورقة الأساسية (9 بنود)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveClosingSubTab("EXPENSES")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    activeClosingSubTab === "EXPENSES"
                      ? "bg-white text-sky-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>🛒</span>
                  <span>المصاريف ({expensesList.length})</span>
                  {expTotal > 0 && <span className="font-mono text-[10px] text-sky-700">({expTotal} ج)</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveClosingSubTab("WITHDRAWALS")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    activeClosingSubTab === "WITHDRAWALS"
                      ? "bg-white text-purple-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>💼</span>
                  <span>مسحوبات إدارة ({withdrawalsList.length})</span>
                  {withTotal > 0 && <span className="font-mono text-[10px] text-purple-700">({withTotal} ج)</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveClosingSubTab("WASTE")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    activeClosingSubTab === "WASTE"
                      ? "bg-white text-rose-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>⚠️</span>
                  <span>توالف إستاف ({staffWasteList.length})</span>
                  {wasteTotal > 0 && <span className="font-mono text-[10px] text-rose-700">({wasteTotal} ج)</span>}
                </button>
              </div>

              {/* TAB 1: SUMMARY VOUCHER (Matches the uploaded sheet exactly) */}
              {activeClosingSubTab === "SUMMARY" && (
                <div className="space-y-3">
                  {/* Voucher Header Banner matching original paper */}
                  <div className="bg-sky-100/80 border-2 border-sky-300 rounded-2xl p-3 text-center space-y-1">
                    <h2 className="text-xl font-black text-slate-800 tracking-wide">مشويات اولاد بسيوني</h2>
                    <p className="text-xs font-bold text-slate-600">مطعم وكافيه</p>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 pt-1 border-t border-sky-200">
                      <span>إيراد يوم : <strong className="text-slate-900">{todayArabicDay}</strong></span>
                      <span>الموافق: <strong className="text-slate-900 font-mono">{todayArabicDate}</strong></span>
                    </div>
                  </div>

                  {/* 9 Voucher Line Items with Arrows and Boxes */}
                  <div className="space-y-2 text-xs">
                    {/* 1. Gross Sales */}
                    <div className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="w-36 font-black text-slate-800 text-sm">
                        إجمالى المبيعات
                      </div>
                      <div className="text-sky-600 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <input
                          type="number"
                          step="any"
                          value={closingGrossSales !== "" ? closingGrossSales : (activeShift.paidOrdersTotal || 0).toString()}
                          onChange={(e) => setClosingGrossSales(e.target.value)}
                          className="w-full text-center font-mono font-black text-base py-1 px-2 border-2 border-slate-700 rounded-lg bg-white outline-none"
                        />
                      </div>
                    </div>

                    {/* 2. Discounts */}
                    <div className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="w-36 font-black text-slate-800 text-sm">
                        خصومات
                      </div>
                      <div className="text-sky-600 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <input
                          type="number"
                          step="any"
                          value={closingDiscounts}
                          onChange={(e) => setClosingDiscounts(e.target.value)}
                          className="w-full text-center font-mono font-black text-base py-1 px-2 border-2 border-slate-700 rounded-lg bg-white outline-none text-rose-700"
                        />
                      </div>
                    </div>

                    {/* 3. Visa */}
                    <div className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="w-36 font-black text-slate-800 text-sm">
                        فيزا
                      </div>
                      <div className="text-sky-600 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <input
                          type="number"
                          step="any"
                          value={closingVisa}
                          onChange={(e) => setClosingVisa(e.target.value)}
                          placeholder="0"
                          className="w-full text-center font-mono font-black text-base py-1 px-2 border-2 border-slate-700 rounded-lg bg-white outline-none text-blue-700"
                        />
                      </div>
                    </div>

                    {/* 4. Other Balance */}
                    <div className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="w-36 font-black text-slate-800 text-sm">
                        رصيد أخر
                      </div>
                      <div className="text-sky-600 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <input
                          type="number"
                          step="any"
                          value={closingOtherBalance}
                          onChange={(e) => setClosingOtherBalance(e.target.value)}
                          placeholder="0"
                          className="w-full text-center font-mono font-black text-base py-1 px-2 border-2 border-slate-700 rounded-lg bg-white outline-none"
                        />
                      </div>
                    </div>

                    {/* 5. Expenses */}
                    <div className="flex items-center justify-between gap-3 bg-amber-50/60 p-2 rounded-xl border border-amber-200">
                      <div className="w-36 font-black text-slate-800 text-sm flex items-center justify-between">
                        <span>مصاريف</span>
                        <button
                          type="button"
                          onClick={() => setActiveClosingSubTab("EXPENSES")}
                          className="text-[10px] bg-amber-200 hover:bg-amber-300 text-amber-900 px-2 py-0.5 rounded font-bold"
                        >
                          تعديل ({expensesList.length}) ✏️
                        </button>
                      </div>
                      <div className="text-sky-600 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <div
                          onClick={() => setActiveClosingSubTab("EXPENSES")}
                          className="w-full text-center font-mono font-black text-base py-1 px-2 border-2 border-slate-700 rounded-lg bg-white cursor-pointer hover:border-amber-500 text-rose-800"
                        >
                          {expTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* 6. Management Checks */}
                    <div className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="w-36 font-black text-slate-800 text-sm">
                        شيكات إداره
                      </div>
                      <div className="text-sky-600 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <input
                          type="number"
                          step="any"
                          value={closingManagementChecks}
                          onChange={(e) => setClosingManagementChecks(e.target.value)}
                          placeholder="0"
                          className="w-full text-center font-mono font-black text-base py-1 px-2 border-2 border-slate-700 rounded-lg bg-white outline-none"
                        />
                      </div>
                    </div>

                    {/* 7. Staff Waste */}
                    <div className="flex items-center justify-between gap-3 bg-rose-50/60 p-2 rounded-xl border border-rose-200">
                      <div className="w-36 font-black text-slate-800 text-sm flex items-center justify-between">
                        <span>توالف إصطاف</span>
                        <button
                          type="button"
                          onClick={() => setActiveClosingSubTab("WASTE")}
                          className="text-[10px] bg-rose-200 hover:bg-rose-300 text-rose-900 px-2 py-0.5 rounded font-bold"
                        >
                          تعديل ({staffWasteList.length}) ✏️
                        </button>
                      </div>
                      <div className="text-sky-600 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <div
                          onClick={() => setActiveClosingSubTab("WASTE")}
                          className="w-full text-center font-mono font-black text-base py-1 px-2 border-2 border-slate-700 rounded-lg bg-white cursor-pointer hover:border-rose-500 text-rose-700"
                        >
                          {wasteTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* 8. Management Withdrawals */}
                    <div className="flex items-center justify-between gap-3 bg-purple-50/60 p-2 rounded-xl border border-purple-200">
                      <div className="w-36 font-black text-slate-800 text-sm flex items-center justify-between">
                        <span>مسحوبات اداره</span>
                        <button
                          type="button"
                          onClick={() => setActiveClosingSubTab("WITHDRAWALS")}
                          className="text-[10px] bg-purple-200 hover:bg-purple-300 text-purple-900 px-2 py-0.5 rounded font-bold"
                        >
                          تعديل ({withdrawalsList.length}) ✏️
                        </button>
                      </div>
                      <div className="text-sky-600 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <div
                          onClick={() => setActiveClosingSubTab("WITHDRAWALS")}
                          className="w-full text-center font-mono font-black text-base py-1 px-2 border-2 border-slate-700 rounded-lg bg-white cursor-pointer hover:border-purple-500 text-purple-900"
                        >
                          {withTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* 9. End of Day Net Cash Balance */}
                    <div className="flex items-center justify-between gap-3 bg-emerald-100 border-2 border-emerald-400 p-2.5 rounded-xl">
                      <div className="w-36 font-black text-emerald-950 text-sm">
                        رصيد أخر اليوم (الصافي)
                      </div>
                      <div className="text-emerald-700 font-black text-lg">←</div>
                      <div className="flex-1 max-w-[170px]">
                        <div className="w-full text-center font-mono font-black text-lg py-1 px-2 border-2 border-emerald-800 rounded-lg bg-white text-emerald-900 shadow-sm">
                          {liveExpectedClosing.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Receiver */}
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <label className="w-36 font-black text-slate-800 text-xs">
                        المستلم /
                      </label>
                      <input
                        type="text"
                        value={closingReceivedBy}
                        onChange={(e) => setClosingReceivedBy(e.target.value)}
                        placeholder="اسم المستلم / المشرف..."
                        className="flex-1 py-1.5 px-3 border border-slate-300 rounded-xl bg-white text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EXPENSES BREAKDOWN */}
              {activeClosingSubTab === "EXPENSES" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-black text-sm text-slate-800">
                      🛒 تسجيل بنود المصاريف المنصرفة من الدرج
                    </h4>
                    <span className="font-mono font-black text-sm text-rose-700">
                      إجمالي المصاريف: {expTotal.toFixed(2)} ج.م
                    </span>
                  </div>

                  {/* Add Expense Form */}
                  <form onSubmit={handleAddExpenseItem} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={newExpenseItem}
                        onChange={(e) => setNewExpenseItem(e.target.value)}
                        placeholder="بيان المصروف (خضار، فحم، غاز، نظافة...)"
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={newExpenseAmount}
                        onChange={(e) => setNewExpenseAmount(e.target.value)}
                        placeholder="المبلغ (ج.م)..."
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none font-mono focus:ring-1 focus:ring-sky-500"
                      />
                      <input
                        type="text"
                        value={newExpenseNotes}
                        onChange={(e) => setNewExpenseNotes(e.target.value)}
                        placeholder="ملاحظات (اختياري)..."
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      ➕ إضافة بند مصروف
                    </button>
                  </form>

                  {/* Expenses List */}
                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {expensesList.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">
                        لم يتم تسجيل أي مصاريف حتى الآن
                      </p>
                    ) : (
                      expensesList.map((exp) => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-800">{exp.item}</span>
                            {exp.notes && <span className="text-[11px] text-slate-400 mr-2">({exp.notes})</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-rose-700">
                              {exp.amount.toFixed(2)} ج.م
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExpenseItem(exp.id)}
                              className="text-slate-400 hover:text-rose-600 font-bold p-1"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: MANAGEMENT WITHDRAWALS */}
              {activeClosingSubTab === "WITHDRAWALS" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-black text-sm text-slate-800">
                      💼 تسجيل مسحوبات الإدارة من الدرج
                    </h4>
                    <span className="font-mono font-black text-sm text-purple-800">
                      إجمالي المسحوبات: {withTotal.toFixed(2)} ج.م
                    </span>
                  </div>

                  <form onSubmit={handleAddWithdrawalItem} className="bg-purple-50/50 p-3 rounded-2xl border border-purple-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={newWithdrawalReceiver}
                        onChange={(e) => setNewWithdrawalReceiver(e.target.value)}
                        placeholder="اسم المستلم (الحاج بدوي، المدير...)"
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={newWithdrawalAmount}
                        onChange={(e) => setNewWithdrawalAmount(e.target.value)}
                        placeholder="المبلغ (ج.م)..."
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none font-mono focus:ring-1 focus:ring-purple-500"
                      />
                      <input
                        type="text"
                        value={newWithdrawalNotes}
                        onChange={(e) => setNewWithdrawalNotes(e.target.value)}
                        placeholder="السبب / بيان السحب..."
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      ➕ إضافة مسحوب إدارة
                    </button>
                  </form>

                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {withdrawalsList.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">
                        لا توجد مسحوبات إدارة مسجلة
                      </p>
                    ) : (
                      withdrawalsList.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-purple-100 bg-white text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-800">{w.receiver}</span>
                            {w.notes && <span className="text-[11px] text-slate-400 mr-2">({w.notes})</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-purple-900">
                              {w.amount.toFixed(2)} ج.م
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveWithdrawalItem(w.id)}
                              className="text-slate-400 hover:text-rose-600 font-bold p-1"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: STAFF WASTE */}
              {activeClosingSubTab === "WASTE" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-black text-sm text-slate-800">
                      ⚠️ تسجيل توالف الإستاف والتشغيل
                    </h4>
                    <span className="font-mono font-black text-sm text-rose-700">
                      إجمالي التوالف: {wasteTotal.toFixed(2)} ج.م
                    </span>
                  </div>

                  <form onSubmit={handleAddWasteItem} className="bg-rose-50/50 p-3 rounded-2xl border border-rose-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        value={newWasteItem}
                        onChange={(e) => setNewWasteItem(e.target.value)}
                        placeholder="الصنف أو سبب التالف (طبق محروق، كسر...)"
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={newWasteAmount}
                        onChange={(e) => setNewWasteAmount(e.target.value)}
                        placeholder="القيمة التقديرية (ج.م)..."
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none font-mono focus:ring-1 focus:ring-rose-500"
                      />
                      <input
                        type="text"
                        value={newWasteResponsible}
                        onChange={(e) => setNewWasteResponsible(e.target.value)}
                        placeholder="المسؤول / القسم..."
                        className="px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      ➕ إضافة تالف إستاف
                    </button>
                  </form>

                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {staffWasteList.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">
                        لا توجد توالف مسجلة
                      </p>
                    ) : (
                      staffWasteList.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-rose-100 bg-white text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-800">{s.item}</span>
                            {s.responsible && <span className="text-[11px] text-slate-400 mr-2">({s.responsible})</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-rose-700">
                              {s.amount.toFixed(2)} ج.م
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveWasteItem(s.id)}
                              className="text-slate-400 hover:text-rose-600 font-bold p-1"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Cashier Counted Cash & Submit */}
              <form onSubmit={handleEndShiftSubmit} className="space-y-4 pt-2 border-t">
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1">
                    أدخل النقدية الفعلية بعد الجرد بالدرج (Actual Cash Counted):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    placeholder="قم بعد النقود بالدرج وأدخل المبلغ هنا..."
                    className="w-full px-4 py-3 rounded-2xl border-2 border-sky-500 text-lg font-mono font-black outline-none focus:ring-4 focus:ring-sky-200"
                  />
                </div>

                {/* Live Shortage / Overage Indicator */}
                {countedCash !== "" && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs font-black flex items-center justify-between ${
                      diff === 0
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : diff < 0
                        ? "bg-rose-50 border-rose-300 text-rose-900"
                        : "bg-blue-50 border-blue-300 text-blue-900"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {diff === 0 ? "✅" : diff < 0 ? "⚠️" : "ℹ️"}
                      </span>
                      <span>
                        {diff === 0
                          ? "الدرج متطابق تماماً بدون أي عجز أو زيادة!"
                          : diff < 0
                          ? `يوجد عجز نقدي بقيمة: ${Math.abs(diff).toFixed(2)} ج.م`
                          : `يوجد زيادة نقدية بقيمة: ${diff.toFixed(2)} ج.م`}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-black">
                      {diff > 0 ? "+" : ""}
                      {diff.toFixed(2)} ج.م
                    </span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ملاحظات تسليم الوردية:
                  </label>
                  <input
                    type="text"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="أي ملاحظات حول الجرد أو التسليم..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || countedCash === ""}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-700 to-primary-900 hover:from-sky-800 hover:to-primary-950 text-white font-black text-sm shadow-md transition disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ والتقفيل..." : "تأكيد تقفيل الوردية وحفظ ورقة التقفيل الرسمية 📋"}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* SPRINT 5 & REQ: Z-Report & Bedouin Grill Printable Closing Voucher Modal */}
      {zReportData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-center space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700 text-2xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg">
                تم تقفيل الوردية وحفظ ورقة التقفيل الرسمية
              </h3>
              <p className="text-xs text-slate-500">تم تسجيل كافة البيانات في السجل المالي</p>
            </div>

            {/* Official Bedouin Grill Closing Sheet Representation */}
            <div id="printable-closing-sheet" className="bg-white border-2 border-slate-800 p-4 rounded-2xl text-right font-sans text-xs space-y-3 shadow-inner">
              
              {/* Header Box */}
              <div className="bg-sky-200 border-2 border-slate-800 rounded-xl p-2.5 text-center">
                <h2 className="text-xl font-black text-slate-900">مشويات اولاد بسيوني</h2>
                <p className="text-xs font-black text-slate-800">مطعم وكافيه</p>
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 pt-1 border-t border-slate-400 mt-1">
                  <span>إيراد يوم : <strong>{new Date().toLocaleDateString("ar-EG", { weekday: "long" })}</strong></span>
                  <span>الموافق: <strong className="font-mono">{new Date().toLocaleDateString("ar-EG")}</strong></span>
                </div>
              </div>

              {/* 9 Voucher Boxes with Arrows */}
              <div className="space-y-1.5 font-bold">
                <div className="flex items-center justify-between border-b pb-1">
                  <span className="w-32">إجمالى المبيعات</span>
                  <span className="text-sky-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-sm px-3 py-0.5 border border-slate-800 rounded bg-slate-50 min-w-[100px] text-center">
                    {(zReportData.stats?.grossSales || zReportData.stats?.salesTotal || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-1">
                  <span className="w-32">خصومات</span>
                  <span className="text-sky-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-sm px-3 py-0.5 border border-slate-800 rounded bg-slate-50 min-w-[100px] text-center text-rose-700">
                    {(zReportData.stats?.discounts || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-1">
                  <span className="w-32">فيزا</span>
                  <span className="text-sky-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-sm px-3 py-0.5 border border-slate-800 rounded bg-slate-50 min-w-[100px] text-center">
                    {(zReportData.stats?.visaAmount || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-1">
                  <span className="w-32">رصيد أخر</span>
                  <span className="text-sky-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-sm px-3 py-0.5 border border-slate-800 rounded bg-slate-50 min-w-[100px] text-center">
                    {(zReportData.stats?.otherBalance || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-1">
                  <span className="w-32">مصاريف</span>
                  <span className="text-sky-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-sm px-3 py-0.5 border border-slate-800 rounded bg-slate-50 min-w-[100px] text-center text-rose-800">
                    {(zReportData.stats?.expensesTotal || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-1">
                  <span className="w-32">شيكات إداره</span>
                  <span className="text-sky-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-sm px-3 py-0.5 border border-slate-800 rounded bg-slate-50 min-w-[100px] text-center">
                    {(zReportData.stats?.managementChecks || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-1">
                  <span className="w-32">توالف إصطاف</span>
                  <span className="text-sky-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-sm px-3 py-0.5 border border-slate-800 rounded bg-slate-50 min-w-[100px] text-center text-rose-700">
                    {(zReportData.stats?.staffWasteTotal || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b pb-1">
                  <span className="w-32">مسحوبات اداره</span>
                  <span className="text-sky-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-sm px-3 py-0.5 border border-slate-800 rounded bg-slate-50 min-w-[100px] text-center text-purple-900">
                    {(zReportData.stats?.managementWithdrawalsTotal || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 font-black bg-slate-100 p-1.5 rounded-lg border border-slate-300">
                  <span className="w-32 text-slate-900">رصيد أخر اليوم</span>
                  <span className="text-emerald-700 font-black text-sm">←</span>
                  <span className="font-mono font-black text-base px-3 py-0.5 border-2 border-slate-900 rounded bg-white min-w-[100px] text-center text-emerald-950">
                    {(zReportData.stats?.endOfDayBalance || zReportData.stats?.expectedCash || 0).toFixed(2)}
                  </span>
                </div>

                {/* Receiver */}
                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <span>المستلم / <strong className="text-slate-900 mr-2">{zReportData.stats?.receivedBy || "—"}</strong></span>
                  <span className="text-slate-500 font-mono">الكاشير: {userName}</span>
                </div>

                {/* Actual & Shortage */}
                <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded">
                  <span>الفعلي بعد الجرد: {(zReportData.stats?.actualCash || 0).toFixed(2)} ج.م</span>
                  <span className={zReportData.stats?.shortageOverage < 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                    الفارق: {zReportData.stats?.shortageOverage > 0 ? "+" : ""}{(zReportData.stats?.shortageOverage || 0).toFixed(2)} ج.م
                  </span>
                </div>
              </div>
            </div>

              <button
                onClick={() => silentPrintHtml(buildZReportHtml(zReportData, userName))}
                className="py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-xs transition shadow flex items-center justify-center gap-1.5"
                title="طباعة تقرير تقفيل الوردية على طابعة Xprinter 80mm"
              >
                <span>🖨️</span>
                <span>طباعة ورقة التقفيل (80mm)</span>
              </button>
              <button
                onClick={() => setZReportData(null)}
                className="py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition shadow"
              >
                تم وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPRINT 4: Web Serial Printer Hardware Settings Modal */}
      {showPrinterSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-right space-y-5 border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-800 flex items-center justify-center text-xl">
                  🖨️
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    إعدادات الطابعة الحرارية ودرج النقدية
                  </h3>
                  <p className="text-xs text-slate-500">
                    Web Serial API Hardware Integration
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPrinterSettings(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Connection Status Card */}
            <div
              className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                printerStatus.isConnected
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-3.5 h-3.5 rounded-full ${
                    printerStatus.isConnected
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-slate-400"
                  }`}
                ></span>
                <div>
                  <p className="text-sm font-black">
                    {printerStatus.isConnected
                      ? "الطابعة متصلة وجاهزة للعمل"
                      : "الطابعة غير متصلة"}
                  </p>
                  <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                    {printerStatus.isConnected
                      ? `معدل النقل: ${printerStatus.baudRate} Baud`
                      : "اضغط على زر الربط لاختيار منفذ USB/Serial COM"}
                  </p>
                </div>
              </div>
            </div>

            {/* Hardware feedback banner */}
            {hardwareFeedback && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900">
                {hardwareFeedback}
              </div>
            )}

            {/* Baud Rate Config */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                معدل نقل البيانات (Baud Rate):
              </label>
              <select
                value={selectedBaudRate}
                disabled={printerStatus.isConnected}
                onChange={(e) => setSelectedBaudRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none bg-slate-50 font-mono"
              >
                <option value={9600}>9600 (الافتراضي لمعظم طابعات POS)</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={115200}>115200 (طابعات USB سريعة)</option>
              </select>
            </div>

            {/* Hardware Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {printerStatus.isConnected ? (
                <button
                  onClick={handleDisconnectPrinter}
                  className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
                >
                  فصل اتصال الطابعة
                </button>
              ) : (
                <button
                  onClick={handleConnectPrinter}
                  className="w-full py-3 rounded-xl bg-primary-800 hover:bg-primary-900 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                >
                  <span>🔌 ربط الطابعة الحرارية (Web Serial)</span>
                </button>
              )}

              {/* Dedicated Cash Drawer Kick Test Button */}
              <button
                onClick={handleTestCashDrawer}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-primary-950 font-black text-xs shadow transition flex items-center justify-center gap-2"
              >
                <span>🚪 اختبار فتح درج النقدية (Test Drawer Kick)</span>
              </button>
            </div>

            {/* Silent Printing to Windows Default Printer (Xprinter 80mm) */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>الطباعة التلقائية (Xprinter 80mm)</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  ● نشطة وتعمل تلقائياً
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                يتم إرسال كافة الشيكات، فواتير السداد، وبونات التحضير مباشرة إلى طابعة الويندوز الافتراضية (Xprinter).
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => triggerTestPrint(userName)}
                  className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>🖨️</span>
                  <span>طباعة فاتورة تجربة</span>
                </button>

                <a
                  href="/start-pos-kiosk.bat"
                  download="تشغيل_كاشير_مشويات_اولاد_بسيوني_طباعة_صامتة.bat"
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-black text-amber-300 font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 text-center"
                  title="تحميل اختصار سطح المكتب للتشغيل الصامت بدون نوافذ"
                >
                  <span>📥</span>
                  <span>تحميل اختصار Kiosk (.bat)</span>
                </a>
              </div>
              <p className="text-[10px] text-amber-900 bg-amber-100/60 p-2 rounded-xl">
                💡 <strong>للطباعة الفورية بدون ظهور نافذة معاينة نهائياً:</strong> قم بتشغيل شاشة الكاشير من ملف (.bat) أعلاه أو تشغيل المتصفح بأمر <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">--kiosk-printing</code>.
              </p>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              يدعم طابعات الإيصالات الحرارية Epson, Xprinter, Bixolon المتصلة عبر
              USB أو RS232 Serial.
            </p>
          </div>
        </div>
      )}

      {/* SPRINT 4: Multi-Ticket Routed Visual Modal */}
      {routedModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl text-right space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl font-bold ${
                    routedModal.drawerKicked
                      ? "bg-amber-100 text-amber-800 ring-4 ring-amber-300/40 animate-bounce"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {routedModal.drawerKicked ? "🚪" : "🖨️"}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {routedModal.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {routedModal.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRoutedModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Cash Drawer Status Alert */}
            {routedModal.drawerKicked && (
              <div className="p-3 bg-amber-100 border border-amber-300 rounded-2xl text-xs font-black text-amber-950 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-lg">🚪</span>
                  <span>تم فتح درج النقدية بنجاح عبر أمر ESC/POS (0x1B 0x70)</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px]">
                  Action B
                </span>
              </div>
            )}

            {!routedModal.drawerKicked && (
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>ℹ️</span>
                  <span>
                    تم توجيه البونات إلى الأقسام مع الاحتفاظ بدرج النقدية مغلقاً.
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900 text-[10px]">
                  Action A
                </span>
              </div>
            )}

            {/* Ticket Department Tabs */}
            {routedModal.tickets.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {routedModal.tickets.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() =>
                      setRoutedModal((prev) =>
                        prev ? { ...prev, activeTicketIndex: idx } : null
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition border ${
                      routedModal.activeTicketIndex === idx
                        ? `${t.badgeColor} shadow-sm ring-2 ring-primary-500`
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t.title.split("(")[0].trim()} ({t.items.length})
                  </button>
                ))}
              </div>
            )}

            {/* Thermal Paper Ticket Visual Rendering */}
            {routedModal.tickets[routedModal.activeTicketIndex] && (
              <div className="flex-1 overflow-y-auto">
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-5 rounded-2xl font-mono text-xs space-y-3 shadow-inner">
                  <div className="text-center border-b pb-2">
                    <p className="font-black text-sm tracking-wide text-slate-900">
                      مشويات اولاد بسيوني - MASHWEYAT AWLAD BASIONY
                    </p>
                    <p className="font-bold text-primary-800 text-xs mt-0.5">
                      {routedModal.tickets[routedModal.activeTicketIndex].title}
                    </p>
                  </div>

                  {/* CRITICAL: Prominent Table Name Display on Every Ticket */}
                  <div className="bg-amber-100/70 border border-amber-300 p-2 rounded-xl text-center">
                    <p className="text-[10px] text-amber-800 font-bold">
                      طاولة العميل (Dining Table):
                    </p>
                    <p className="text-base font-black text-amber-950 font-sans">
                      {routedModal.tickets[routedModal.activeTicketIndex].tableName}
                    </p>
                    {routedModal.tickets[routedModal.activeTicketIndex].orderNumber && (
                      <p className="text-[11px] font-bold text-amber-900 mt-0.5">
                        رقم الطلب: #{routedModal.tickets[routedModal.activeTicketIndex].orderNumber}
                      </p>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between font-bold text-slate-700 border-b pb-1 text-[11px]">
                      <span>الصنف والكمية</span>
                      <span>السعر</span>
                    </div>

                    {routedModal.tickets[routedModal.activeTicketIndex].items.map((i, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-slate-800 font-semibold">
                          <span>
                            {i.quantity}x {i.nameAr}
                          </span>
                          <span>{(i.price * i.quantity).toFixed(2)} ج.م</span>
                        </div>
                        {i.notes && (
                          <p className="text-[10px] text-amber-800 font-sans pr-3">
                            └ ملاحظة: {i.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer of ticket */}
                  <div className="border-t pt-2 flex justify-between font-black text-slate-900 text-sm">
                    <span>حالة البون:</span>
                    <span className="text-emerald-700">
                      {routedModal.drawerKicked
                        ? "مدفوع بالكامل (PAID)"
                        : "مرسل للتحضير (OPEN)"}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center pt-2">
                    {new Date().toLocaleDateString("ar-EG")} -{" "}
                    {new Date().toLocaleTimeString("ar-EG")}
                  </p>
                </div>
              </div>
            )}

            {/* Modal Controls */}
            <div className="pt-2 border-t flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRoutedModal(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition shadow-sm"
              >
                إغلاق المعاينة
              </button>

              <button
                onClick={() => {
                  triggerSilentThermalPrint({
                    title: routedModal.isPayment ? "فاتورة سداد نقدي (PAID RECEIPT)" : "إيصال طلب (ORDER TICKET)",
                    receiptType: routedModal.isPayment ? "RECEIPT" : "PREP",
                    tableName: selectedTable?.name || "مشويات اولاد بسيوني",
                    orderNumber: activeOrderId ? parseInt(activeOrderId.slice(-4)) : undefined,
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
                    isComplimentary,
                    notes: orderNotes || undefined,
                    cashierName: userName,
                    isPaid: routedModal.isPayment,
                  });
                }}
                className="py-3 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5"
                title="إعادة طباعة الإيصال فوراً على طابعة Xprinter 80mm"
              >
                <span>🖨️</span>
                <span>إعادة طباعة على Xprinter (80mm)</span>
              </button>

              {/* إذا كان المعروض شيك العميل: إتاحة زر فتح الدرج والتحصيل الفوري مباشرة */}
              {routedModal.tickets.some((t) => t.type === "CUSTOMER_CHECK") && (
                <button
                  onClick={() => {
                    setRoutedModal(null);
                    handleCollectPayment();
                  }}
                  className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-1.5 ring-2 ring-emerald-400/40"
                >
                  <span>🚪 فتح الدرج والتحصيل فوراً ({totalAmount.toFixed(2)} ج.م)</span>
                  <span>💵</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK CUSTOMER REGISTRATION MODAL FOR DELIVERY */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl">
                  🛵
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    تسجيل عميل دليفري جديد
                  </h3>
                  <p className="text-xs text-slate-500">
                    إضافة العميل لقاعدة البيانات لطلبات التوصيل السريع
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickCustomerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuickCustomer} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  اسم العميل <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  رقم الهاتف (المحمول) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="tel"
                  required
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="مثال: 01558962994"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  عنوان التوصيل بالتفصيل:
                </label>
                <textarea
                  rows={2}
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  placeholder="منطقة عبد القادر - بجوار جامع السلام - عمارة 5..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ملاحظات إضافية (اختياري):
                </label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="مثال: يفضل عيش بلدي ساخن، طحينة زيادة..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow disabled:opacity-50"
                >
                  {isPending ? "جاري الحفظ..." : "حفظ واختيار العميل ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
