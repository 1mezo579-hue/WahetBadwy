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

  // SPRINT 5: Action - End Shift (تقفيل وتسليم الوردية)
  const handleEndShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const actual = parseFloat(countedCash);
    if (isNaN(actual) || actual < 0) {
      alert("يرجى إدخال المبلغ الفعلي بعد الجرد بشكل صحيح.");
      return;
    }

    startTransition(async () => {
      const res = await endShift({
        shiftId: activeShift.id,
        actualCash: actual,
        notes: shiftNotes,
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

      // Display multi-ticket preparation modal (drawerKicked: false)
      setRoutedModal({
        title: "تم حفظ وتوجيه بونات التحضير بنجاح",
        subtitle: `${selectedTable.name} • (تم توجيه ${routeRes.tickets.length} بونات للأقسام - درج النقدية مغلق)`,
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

      // طباعة فاتورة / شيك العميل عبر الطابعة الحرارية (درج النقدية مغلق)
      const checkRes = await printCustomerCheckOnly({
        tableName: selectedTable.name,
        orderNumber: orderNum,
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

      // تم تقفيل الشيك -> تفعيل حالة طباعة الشيك ليتحول الزر لفتح الدرج بالتحصيل
      setIsCheckPrinted(true);

      // عرض معاينة الشيك المطبوع
      setRoutedModal({
        title: "🧾 تم تقفيل وطباعة شيك العميل",
        subtitle: `${selectedTable.name} • تم إرسال الشيك للطابعة (جاهز للتحصيل وفتح الدرج)`,
        isPayment: false,
        drawerKicked: false,
        tickets: [checkRes.checkTicket],
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

      // CRITICAL: Execute payment receipt & KICK OPEN CASH DRAWER
      const paymentRes = await executePaymentAndOpenDrawer({
        tableName: selectedTable.name,
        orderNumber: activeOrderId ? parseInt(activeOrderId.slice(-4)) : undefined,
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

      // Display final paid receipt modal with CASH DRAWER OPENED confirmation
      setRoutedModal({
        title: "تم التحصيل وسداد الحساب بنجاح ✓",
        subtitle: `${selectedTable.name} • 🚪 تم فتح درج النقدية بنجاح عبر إشارة ESC/POS`,
        isPayment: true,
        drawerKicked: true,
        tickets: [paymentRes.receiptTicket],
        activeTicketIndex: 0,
      });

      // Free table locally
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
              وب
            </div>
            <span className="font-black text-base tracking-wide">
              واحة بدوي POS
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

          {/* SPRINT 4: Thermal Printer Web Serial Status Pill */}
          <button
            onClick={() => setShowPrinterSettings(true)}
            className={`px-3 py-1.5 rounded-xl font-bold border transition flex items-center gap-2 ${
              printerStatus.isConnected
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900"
                : "bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                printerStatus.isConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
              }`}
            ></span>
            <span>
              {printerStatus.isConnected ? "🖨️ الطابعة متصلة" : "🖨️ ربط الطابعة"}
            </span>
          </button>

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
            {/* Top Quick Actions for Delivery & Takeaway */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  const delTable =
                    tables.find((t) => t.name.includes("دليفري")) || tables[0];
                  if (delTable) handleSelectTable(delTable, "DELIVERY");
                }}
                className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white p-4 rounded-2xl shadow-md flex items-center justify-between text-right active:scale-[0.99] transition group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛵</span>
                    <h3 className="font-black text-base">طلب دليفري جديد (توصيل)</h3>
                  </div>
                  <p className="text-xs text-amber-100 mt-1">
                    تسجيل عميل جديد وتحديد رسوم توصيل مفتوحة
                  </p>
                </div>
                <span className="w-8 h-8 rounded-xl bg-white/20 text-white font-black flex items-center justify-center text-sm group-hover:bg-white group-hover:text-amber-800 transition">
                  ←
                </span>
              </button>

              <button
                onClick={() => {
                  const takeTable =
                    tables.find((t) => t.name.includes("تيك أواي")) || tables[0];
                  if (takeTable) handleSelectTable(takeTable, "TAKEAWAY");
                }}
                className="bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white p-4 rounded-2xl shadow-md flex items-center justify-between text-right active:scale-[0.99] transition group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🥡</span>
                    <h3 className="font-black text-base">طلب تيك أواي جديد (سفري)</h3>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    طلب سريع بدون حجز طاولة صالة
                  </p>
                </div>
                <span className="w-8 h-8 rounded-xl bg-white/20 text-white font-black flex items-center justify-center text-sm group-hover:bg-white group-hover:text-slate-900 transition">
                  ←
                </span>
              </button>

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
                    📞 خدمة التوصيل: 01558962994
                  </p>
                </div>
                <span className="text-xs bg-amber-50 text-amber-800 font-bold px-2.5 py-1 rounded-lg">
                  {customersList.length} عميل
                </span>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  خريطة وتوزيع طاولات الصالة
                </h2>
                <p className="text-xs text-slate-500">
                  انقر على أي طاولة لفتح طلبها أو إنشاء أوردر جديد فوراً.
                </p>
              </div>

              {/* Status Legend */}
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span>متاحة (فاضية)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
                  <span>مشغولة (عليها طلب)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  <span>طاولة خاصة (ضيافة)</span>
                </span>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3.5">
              {tables.map((table) => {
                const hasOpenOrder = table.orders && table.orders.length > 0;
                const isSpecial =
                  table.type === TableType.OWNER ||
                  table.type === TableType.MANAGER;

                let cardBg = "bg-white border-slate-200 hover:border-primary-400";
                let statusBadge =
                  "bg-emerald-100 text-emerald-800 border-emerald-200";
                let statusLabel = "متاحة";

                if (hasOpenOrder || table.status === TableStatus.OCCUPIED) {
                  cardBg = "bg-rose-50/70 border-rose-300 ring-2 ring-rose-200";
                  statusBadge = "bg-rose-500 text-white border-rose-600";
                  statusLabel = "مشغولة";
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
                      <div className="bg-rose-100 p-1.5 rounded-lg text-center">
                        <p className="text-[10px] font-bold text-rose-800">
                          أوردر #{table.orders[0].orderNumber}
                        </p>
                        <p className="text-xs font-mono font-black text-rose-900">
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
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-400 active:scale-95 transition text-right flex flex-col justify-between h-28 group"
                  >
                    <h4 className="font-extrabold text-slate-800 text-sm group-hover:text-primary-800 transition line-clamp-2">
                      {item.nameAr}
                    </h4>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <span className="font-mono font-black text-amber-700 text-base">
                        {item.price.toFixed(2)} ج.م
                      </span>
                      <span className="w-7 h-7 rounded-lg bg-primary-50 group-hover:bg-primary-700 group-hover:text-white text-primary-800 font-bold flex items-center justify-center transition">
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

                {/* 4. Takeaway Customer Name */}
                {orderType === "TAKEAWAY" && (
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      اسم عميل السفري / رقم الطلب (اختياري):
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="مثال: أحمد عبد الله (سفري)"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 outline-none"
                    />
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
                      /* المرحلة الأولى: قبل تقفيل الشيك (إرسال للتحضير أو تقفيل الشيك) */
                      <div className="grid grid-cols-2 gap-2">
                        {/* زر إرسال للتحضير: يوجه فقط للمطبخ والباريستا والشيشة ولا يطبع فاتورة العميل */}
                        <button
                          disabled={isPending || cart.length === 0}
                          onClick={handleSendToPrep}
                          className="py-3 px-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition shadow-sm flex flex-col items-center justify-center gap-0.5"
                        >
                          <span className="flex items-center gap-1">
                            <span>🖨️</span>
                            <span>إرسال للتحضير</span>
                          </span>
                          <span className="text-[10px] text-indigo-200 font-normal">
                            مطبخ / باريستا / شيشة
                          </span>
                        </button>

                        {/* زر تقفيل الشيك: يطبع فاتورة العميل فقط بدون فتح الدرج */}
                        <button
                          disabled={isPending || (cart.length === 0 && !activeOrderId)}
                          onClick={handlePrintCustomerCheck}
                          className="py-3 px-2 rounded-xl text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:opacity-90 disabled:opacity-50 transition shadow-md flex flex-col items-center justify-center gap-0.5 border border-amber-600/30"
                        >
                          <span className="flex items-center gap-1">
                            <span>🧾</span>
                            <span>تقفيل الشيك (طباعة)</span>
                          </span>
                          <span className="text-[10px] text-amber-900 font-bold">
                            طباعة فاتورة العميل
                          </span>
                        </button>
                      </div>
                    ) : (
                      /* المرحلة الثانية: بعد طباعة الشيك -> يتحول الزر تلقائياً لفتح الدرج بالتحصيل بدون رسالة تأكيد */
                      <div className="space-y-1.5 animate-fade-in">
                        <button
                          disabled={isPending || (cart.length === 0 && !activeOrderId)}
                          onClick={handleCollectPayment}
                          className="w-full py-3.5 px-3 rounded-2xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition shadow-lg ring-4 ring-emerald-500/30 flex items-center justify-between"
                        >
                          <span className="text-xl">🚪</span>
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-black">
                              فتح الدرج بالتحصيل ({totalAmount.toFixed(2)} ج.م)
                            </span>
                            <span className="text-[10px] text-emerald-100 font-normal">
                              فتح فوري للدرج (بدون رسالة تأكيد) + إخلاء الطاولة
                            </span>
                          </div>
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
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      disabled={isPending || cart.length === 0}
                      onClick={handleSendToPrep}
                      className="py-3 px-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition shadow-sm flex flex-col items-center justify-center gap-0.5"
                    >
                      <span>🖨️ إرسال للتحضير</span>
                      <span className="text-[10px] text-indigo-200 font-normal">
                        توجيه للأقسام
                      </span>
                    </button>

                    <button
                      disabled={isPending || (cart.length === 0 && !activeOrderId)}
                      onClick={handleCollectPayment}
                      className="py-3 px-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition shadow-sm flex flex-col items-center justify-center gap-0.5"
                    >
                      <span>💳 تحصيل وفتح الدرج 🚪</span>
                      <span className="text-[10px] text-emerald-200 font-normal">
                        فتح فوري للدرج (بدون تأكيد)
                      </span>
                    </button>
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

      {/* SPRINT 5: End Shift & Handover Modal (CRITICAL REQUIREMENT #3) */}
      {showEndShiftModal && activeShift && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl text-right space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary-100 text-primary-900 flex items-center justify-center text-xl">
                  📋
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">
                    تقفيل وتسليم الوردية (Shift Handover)
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

            {/* Shift Financial Summary Breakdown */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>وقت بدء الوردية:</span>
                <span className="font-mono font-bold">
                  {new Date(activeShift.startTime).toLocaleTimeString("ar-EG")}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>مدة العمل المنقضية:</span>
                <span className="font-mono font-bold text-primary-800">
                  {shiftTimer} {hasExceeded12Hours && "(تجاوزت 12 ساعة ⚠️)"}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>العهدة الافتتاحية للدرج:</span>
                <span className="font-mono font-bold">
                  {(activeShift.initialCash || 0).toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>المبيعات النقدية المحصلة:</span>
                <span className="font-mono font-bold text-emerald-700">
                  +{(activeShift.paidOrdersTotal || 0).toFixed(2)} ج.م
                </span>
              </div>

              {/* CRITICAL REQUIREMENT 3: Notice of Complimentary Exclusion */}
              {(activeShift.complimentaryOrdersCount || 0) > 0 && (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-[11px] text-purple-900 font-bold flex items-center gap-2">
                  <span>👑</span>
                  <div>
                    <span>تم استبعاد طلبات الضيافة بنجاح: </span>
                    <strong className="text-purple-950">
                      {activeShift.complimentaryOrdersCount} طلب بقيمة{" "}
                      {(activeShift.complimentaryWaivedTotal || 0).toFixed(2)} ج.م
                    </strong>
                    <p className="text-[10px] text-purple-700 font-normal">
                      (طاولة المالك وطاولة المدير - معفاة 100% ولا تدخل في عهدة الدرج)
                    </p>
                  </div>
                </div>
              )}

              {/* Expected Cash in Drawer */}
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                <span>النقدية المتوقعة بالدرج (Expected Cash):</span>
                <span className="font-mono text-base text-primary-900">
                  {liveExpected.toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* Cashier Counted Cash Form */}
            <form onSubmit={handleEndShiftSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-800 block mb-1">
                  أدخل النقدية الفعلية بعد الجرد (Actual Cash Counted):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="قم بعد النقود بالدرج وأدخل المبلغ هنا..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-primary-500 text-lg font-mono font-black outline-none focus:ring-4 focus:ring-primary-200"
                />
              </div>

              {/* Live Shortage / Overage Indicator */}
              {countedCash !== "" && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs font-black flex items-center justify-between ${
                    liveShortageOverage === 0
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : liveShortageOverage < 0
                      ? "bg-rose-50 border-rose-300 text-rose-900"
                      : "bg-blue-50 border-blue-300 text-blue-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {liveShortageOverage === 0
                        ? "✅"
                        : liveShortageOverage < 0
                        ? "⚠️"
                        : "ℹ️"}
                    </span>
                    <span>
                      {liveShortageOverage === 0
                        ? "الدرج متطابق تماماً بدون أي عجز أو زيادة!"
                        : liveShortageOverage < 0
                        ? `يوجد عجز نقدي بقيمة: ${Math.abs(liveShortageOverage).toFixed(2)} ج.م`
                        : `يوجد زيادة نقدية بقيمة: ${liveShortageOverage.toFixed(2)} ج.م`}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-black">
                    {liveShortageOverage > 0 ? "+" : ""}
                    {liveShortageOverage.toFixed(2)} ج.م
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ملاحظات تسليم الوردية:
                </label>
                <textarea
                  rows={2}
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="أي ملاحظات حول الجرد أو التسليم..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-primary-500"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isPending || countedCash === ""}
                className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-sm shadow-md transition disabled:opacity-50"
              >
                {isPending ? "جاري التقفيل..." : "تأكيد تقفيل الوردية وطباعة Z-Report 🖨️"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SPRINT 5: Z-Report Shift Closing Modal */}
      {zReportData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700 text-2xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                تقرير إغلاق الوردية (Z-REPORT)
              </h3>
              <p className="text-xs text-slate-500">تم حفظ الوردية في السجل المالي</p>
            </div>

            {/* Thermal Ticket Paper Look */}
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 p-4 rounded-2xl text-right font-mono text-xs space-y-2">
              <div className="text-center border-b pb-1 font-black text-slate-800">
                واحة بدوي - تقرير Z-REPORT
              </div>
              <div className="flex justify-between text-slate-600">
                <span>رقم الوردية:</span>
                <span>#{zReportData.shift.shiftNumber}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>الكاشير:</span>
                <span className="font-sans font-bold">{userName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>العهدة الافتتاحية:</span>
                <span>{zReportData.stats.initialCash.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>المبيعات النقدية:</span>
                <span className="text-emerald-700 font-bold">
                  +{zReportData.stats.salesTotal.toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 border-t pt-1">
                <span>النقدية المتوقعة:</span>
                <span>{zReportData.stats.expectedCash.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800">
                <span>المبلغ بعد الجرد (الفعلي):</span>
                <span>{zReportData.stats.actualCash.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between font-black text-sm border-t pt-1">
                <span>الفارق (العجز/الزيادة):</span>
                <span
                  className={
                    zReportData.stats.shortageOverage < 0
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }
                >
                  {zReportData.stats.shortageOverage > 0 ? "+" : ""}
                  {zReportData.stats.shortageOverage.toFixed(2)} ج.م
                </span>
              </div>
            </div>

            <button
              onClick={() => setZReportData(null)}
              className="w-full py-3 bg-primary-800 hover:bg-primary-900 text-white font-bold rounded-xl text-xs transition shadow"
            >
              تم وإغلاق
            </button>
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
                      واحة بدوي - WAHET BADAWY
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
            <div className="pt-2 border-t flex items-center gap-2">
              <button
                onClick={() => setRoutedModal(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition shadow-sm"
              >
                إغلاق المعاينة
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
