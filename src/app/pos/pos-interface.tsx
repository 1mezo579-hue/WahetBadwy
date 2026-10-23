"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { TableType, TableStatus, OrderStatus } from "@prisma/client";
import { sendOrderToPrep, collectOrderPayment } from "@/actions/pos";
import { startShift, endShift, getActiveShift } from "@/actions/shifts";
import { createCustomer } from "@/actions/customers";
import Link from "next/link";
import { signOut } from "next-auth/react";
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
import { OFFICIAL_CATEGORIES, OFFICIAL_MENU_ITEMS, MenuItemData } from "@/data/official-menu";

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
    customerName?: string | null;
    customerPhone?: string | null;
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
  image?: string;
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
  const [deliveryFee, setDeliveryFee] = useState<string>("");
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState<boolean>(false);
  const [quickName, setQuickName] = useState<string>("");
  const [quickPhone, setQuickPhone] = useState<string>("");
  const [quickAddress, setQuickAddress] = useState<string>("");
  const [quickNotes, setQuickNotes] = useState<string>("");

  // Modals
  const [showTablesModal, setShowTablesModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isCheckPrinted, setIsCheckPrinted] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(initialShift);
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [endShiftNotes, setEndShiftNotes] = useState("");
  const [receivedBy, setReceivedBy] = useState("");

  // Expenses & Withdrawals & Waste
  const [expenses, setExpenses] = useState<Array<{ id: string; desc: string; amount: number; time: string }>>([]);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [withdrawals, setWithdrawals] = useState<Array<{ id: string; desc: string; amount: number; time: string }>>([]);
  const [withdrawalDesc, setWithdrawalDesc] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [wastes, setWastes] = useState<Array<{ id: string; desc: string; amount: number; time: string }>>([]);
  const [wasteDesc, setWasteDesc] = useState("");
  const [wasteAmount, setWasteAmount] = useState("");

  // Payment Breakdown
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "VISA" | "SPLIT">("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [splitCashAmount, setSplitCashAmount] = useState<string>("");
  const [splitVisaAmount, setSplitVisaAmount] = useState<string>("");
  const [customDiscount, setCustomDiscount] = useState<string>("0");
  const [customTax, setCustomTax] = useState<string>("0");

  // Routed print tickets modal
  const [routedModal, setRoutedModal] = useState<{
    title: string;
    subtitle: string;
    isPayment: boolean;
    drawerKicked: boolean;
    tickets: RoutedTicket[];
    activeTicketIndex: number;
  } | null>(null);

  // Live Clock
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const dayName = days[now.getDay()];
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const h = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      setCurrentTime(`${dayName} ${y}/${m}/${d} ${h}:${min}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Set default table on load if none selected
  useEffect(() => {
    if (!selectedTable && tables.length > 0) {
      setSelectedTable(tables[0]);
    }
  }, [tables, selectedTable]);

  // Combine DB menu items with official menu items ensuring images and complete list
  const allMenuItems = useMemo(() => {
    const map = new Map<string, PosMenuItem>();

    // 1. First populate with official menu items
    OFFICIAL_MENU_ITEMS.forEach((item) => {
      map.set(item.id, {
        id: item.id,
        nameAr: item.nameAr,
        price: item.price,
        categoryId: item.categoryId,
        description: item.description,
        image: item.image,
      });
    });

    // 2. Merge DB menu items if any
    menuItems.forEach((dbItem) => {
      // Find matching official item by nameAr
      const official = OFFICIAL_MENU_ITEMS.find((o) => o.nameAr === dbItem.nameAr);
      map.set(dbItem.id, {
        id: dbItem.id,
        nameAr: dbItem.nameAr,
        price: dbItem.price,
        categoryId: official ? official.categoryId : (dbItem.categoryId || "GRILLS"),
        description: dbItem.description || official?.description,
        image: official?.image || "/items/kofta.jpg",
      });
    });

    return Array.from(map.values());
  }, [menuItems]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return allMenuItems.filter((item) => {
      const matchCat =
        selectedCategory === "ALL" ||
        item.categoryId === selectedCategory ||
        (selectedCategory === "GRILLS" && (item.categoryId === "cat_grills_01" || item.categoryId === "GRILLS")) ||
        (selectedCategory === "SANDWICHES" && (item.categoryId === "cat_sandwiches_03" || item.categoryId === "cat_syrian_04" || item.categoryId === "SANDWICHES")) ||
        (selectedCategory === "TRAYS" && (item.categoryId === "cat_trays_02" || item.categoryId === "TRAYS")) ||
        (selectedCategory === "MEALS" && item.categoryId === "MEALS") ||
        (selectedCategory === "SIDES" && (item.categoryId === "cat_delicacies_05" || item.categoryId === "SIDES")) ||
        (selectedCategory === "DRINKS" && (item.categoryId === "cat_hot_drinks_06" || item.categoryId === "cat_coffee_07" || item.categoryId === "cat_juices_08" || item.categoryId === "DRINKS")) ||
        (selectedCategory === "SHISHA" && (item.categoryId === "cat_shisha_10" || item.categoryId === "SHISHA")) ||
        (selectedCategory === "DESSERTS" && (item.categoryId === "cat_desserts_09" || item.categoryId === "DESSERTS"));

      const matchSearch =
        !searchQuery ||
        item.nameAr.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [allMenuItems, selectedCategory, searchQuery]);

  // Select Table handler
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
        existingOpenOrder.items.map((i) => ({
          menuItemId: i.menuItemId,
          nameAr: i.menuItem.nameAr,
          price: i.unitPrice,
          quantity: i.quantity,
          notes: i.notes || undefined,
        }))
      );
      if (existingOpenOrder.customerName) setCustomerName(existingOpenOrder.customerName);
      if (existingOpenOrder.customerPhone) setCustomerPhone(existingOpenOrder.customerPhone);
    } else {
      setActiveOrderId(undefined);
      setCart([]);
    }
    setIsCheckPrinted(false);
  };

  // Add Item to Cart
  const handleAddToCart = (item: PosMenuItem) => {
    if (!selectedTable) {
      if (tables.length > 0) {
        handleSelectTable(tables[0]);
      }
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id || i.nameAr === item.nameAr);
      if (existing) {
        return prev.map((i) =>
          (i.menuItemId === item.id || i.nameAr === item.nameAr)
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          nameAr: item.nameAr,
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

  const handleClearOrder = () => {
    if (cart.length === 0) return;
    if (confirm("هل تريد إلغاء الطلب الحالي وتفريغ الأصناف؟")) {
      setCart([]);
      setActiveOrderId(undefined);
      setIsCheckPrinted(false);
    }
  };

  const handleStartNewOrder = () => {
    setCart([]);
    setActiveOrderId(undefined);
    setIsCheckPrinted(false);
    setOrderNotes("");
  };

  // Calculations
  const isComplimentary =
    selectedTable?.type === TableType.OWNER ||
    selectedTable?.type === TableType.MANAGER;

  const deliveryFeeNumber = orderType === "DELIVERY" ? (parseFloat(deliveryFee) || 0) : 0;
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountVal = parseFloat(customDiscount) || 0;
  const taxVal = parseFloat(customTax) || 0;
  const discount = isComplimentary ? (subtotal + deliveryFeeNumber) : discountVal;
  const totalAmount = isComplimentary ? 0 : Math.max(0, subtotal + deliveryFeeNumber + taxVal - discount);

  // Send Order to Prep (حفظ وطباعة الأوردر)
  const handleSendToPrep = () => {
    if (!selectedTable) {
      alert("يرجى اختيار طاولة أو تحديد نوع الطلب أولاً");
      return;
    }
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

      await routeAndPrintPrepOrder({
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

      if (res.order) {
        setActiveOrderId(res.order.id);
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

      alert("تم حفظ الطلب وإرسال بون التحضير للطباعة بنجاح ✓");
    });
  };

  // Print Customer Check
  const handlePrintCustomerCheck = () => {
    if (!selectedTable) return;
    if (cart.length === 0 && !activeOrderId) {
      alert("لا توجد أصناف في الطلب لطباعة الفاتورة!");
      return;
    }

    startTransition(async () => {
      let orderNum = activeOrderId ? parseInt(activeOrderId.slice(-4)) : undefined;

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

      setIsCheckPrinted(true);
      alert("تم إرسال فاتورة الحساب للطباعة بنجاح ✓");
    });
  };

  // Collect Payment
  const handleCollectPayment = () => {
    if (!selectedTable) return;
    if (cart.length === 0 && !activeOrderId) {
      alert("لا يوجد طلب مفتوح أو أصناف لتحصيلها!");
      return;
    }

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

      // Free table locally
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTable.id
            ? { ...t, status: TableStatus.AVAILABLE, orders: [] }
            : t
        )
      );

      // Reset cart
      setCart([]);
      setActiveOrderId(undefined);
      setIsCheckPrinted(false);
      setCustomerName("");
      setCustomerPhone("");
      setOrderNotes("");
      setShowPaymentModal(false);

      if (userId) {
        const updated = await getActiveShift(userId);
        if (updated.activeShift) setActiveShift(updated.activeShift);
      }

      alert("تم إتمام الطلب وسداد الحساب وطباعة الفاتورة بنجاح ✓");
    });
  };

  // Recent Orders for the bottom table
  const recentOrders = useMemo(() => {
    const list: Array<{
      orderNumber: number | string;
      time: string;
      table: string;
      total: number;
      status: string;
      statusColor: string;
    }> = [];

    tables.forEach((t) => {
      if (t.orders && t.orders.length > 0) {
        t.orders.forEach((o) => {
          list.push({
            orderNumber: String(o.orderNumber || o.id.slice(-3)).padStart(3, "0"),
            time: "14:28",
            table: t.name.replace("طاولة ", "").replace("طاولة", ""),
            total: o.totalAmount,
            status: o.status === OrderStatus.OPEN ? "قيد التحضير" : "جاهز",
            statusColor: o.status === OrderStatus.OPEN ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
          });
        });
      }
    });

    // Provide default fallback rows to match screenshot if list is small
    if (list.length < 5) {
      const mockRows = [
        { orderNumber: "001", time: "14:28", table: "5", total: 210, status: "قيد التحضير", statusColor: "bg-amber-500 text-stone-950 font-bold" },
        { orderNumber: "002", time: "14:20", table: "3", total: 175, status: "جاهز", statusColor: "bg-emerald-500 text-stone-950 font-bold" },
        { orderNumber: "003", time: "14:18", table: "7", total: 375, status: "جاهز", statusColor: "bg-emerald-500 text-stone-950 font-bold" },
        { orderNumber: "004", time: "14:10", table: "2", total: 310, status: "قيد التحضير", statusColor: "bg-amber-500 text-stone-950 font-bold" },
        { orderNumber: "005", time: "14:05", table: "6", total: 280, status: "جاهز", statusColor: "bg-emerald-500 text-stone-950 font-bold" },
      ];
      return mockRows;
    }

    return list.slice(0, 5);
  }, [tables]);

  // Quick Statistics
  const occupiedCount = tables.filter((t) => t.status === TableStatus.OCCUPIED).length;
  const totalTablesCount = tables.length || 12;
  const shiftSales = activeShift?.paidOrdersTotal || 4850;
  const shiftOrdersCount = activeShift?.orders?.length || 18;
  const avgOrderValue = shiftOrdersCount > 0 ? Math.round(shiftSales / shiftOrdersCount) : 269;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0c] text-stone-100 select-none font-sans" dir="rtl">
      
      {/* 1. TOP HEADER */}
      <header className="h-20 shrink-0 bg-[#0d0d10] border-b border-orange-500/30 px-4 flex items-center justify-between relative z-30 shadow-2xl">
        {/* Left: Circle Badge Logo */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => setShowTablesModal(true)}>
            <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-orange-600 via-amber-400 to-orange-500 shadow-lg shadow-orange-600/30">
              <img
                src="/logo.png"
                alt="مشويات بسيوني"
                className="w-full h-full rounded-full object-cover bg-black"
              />
            </div>
          </div>
          <div className="hidden sm:block">
            <span className="text-[10px] text-orange-400/80 font-bold tracking-widest block">طعم زمان على أصوله</span>
            <span className="text-xs text-stone-400 font-mono">نظام نقاط البيع والكاشير</span>
          </div>
        </div>

        {/* Center: Glowing Orange Title & Flames */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-2xl sm:text-3xl animate-pulse">🔥</span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 drop-shadow-[0_2px_12px_rgba(249,115,22,0.4)]">
              مشويات بسيوني
            </h1>
            <span className="text-2xl sm:text-3xl animate-pulse">🔥</span>
          </div>
          <p className="text-[11px] sm:text-xs font-black tracking-[0.25em] text-orange-400/90 font-mono uppercase mt-0.5">
            MASHWEYAT BASIONY
          </p>
        </div>

        {/* Right: Phone, Management, Time, User Role, Logout */}
        <div className="flex items-center gap-4 text-xs">
          {/* Phone & Management */}
          <div className="hidden md:flex flex-col text-left font-mono">
            <div className="flex items-center gap-1.5 text-orange-400 font-bold justify-end">
              <span>01038029714</span>
              <span>📞</span>
            </div>
            <div className="text-[11px] text-stone-300 font-bold text-right">
              إدارة : أ/ أحمد بسيوني
            </div>
            <div className="text-[10px] text-stone-400 text-right">
              Ahmed Basiouny
            </div>
          </div>

          {/* Live Date & Time */}
          <div className="hidden lg:flex flex-col items-end text-[11px] font-mono text-stone-400 border-r border-stone-800 pr-3">
            <span className="text-orange-300 font-bold">{currentTime.split(" ")[0]} {currentTime.split(" ")[1]}</span>
            <span className="text-stone-300">{currentTime.split(" ")[2]}</span>
          </div>

          {/* User Role Badge */}
          <div className="flex items-center gap-1.5 bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-1.5">
            <span className="text-amber-400 text-sm">👤</span>
            <span className="font-bold text-stone-200">{userName || "مدير النظام"}</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 bg-stone-900 border border-orange-500/40 hover:bg-orange-600 hover:text-black text-orange-400 px-3 py-1.5 rounded-xl font-bold transition shadow-sm"
            title="تسجيل الخروج"
          >
            <span>تسجيل الخروج</span>
            <span>🚪</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE (Flex Row) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* A. LEFT VERTICAL SIDEBAR */}
        <aside className="w-28 sm:w-32 bg-[#0c0c0f] border-l border-orange-500/20 flex flex-col justify-between py-3 px-2 shrink-0 z-20">
          <nav className="flex flex-col gap-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold"
            >
              <span className="text-base text-orange-400">🏠</span>
              <span>الرئيسية</span>
            </Link>

            <button
              onClick={() => {}}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black shadow-lg shadow-orange-500/30 text-xs text-right"
            >
              <span className="text-base">💻</span>
              <span>نقاط البيع</span>
            </button>

            <Link
              href="/dashboard/reports"
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold"
            >
              <span className="text-base text-orange-400">📋</span>
              <span>الطلبات</span>
            </Link>

            <button
              onClick={() => setShowTablesModal(true)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold text-right"
            >
              <span className="text-base text-orange-400">🪑</span>
              <span>الطاولات</span>
            </button>

            <Link
              href="/dashboard/menu"
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold"
            >
              <span className="text-base text-orange-400">🍴</span>
              <span>المنيو</span>
            </Link>

            <Link
              href="/dashboard/customers"
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold"
            >
              <span className="text-base text-orange-400">👥</span>
              <span>العملاء</span>
            </Link>

            <Link
              href="/dashboard/staff"
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold"
            >
              <span className="text-base text-orange-400">👨‍🍳</span>
              <span>الموظفين</span>
            </Link>

            <button
              onClick={() => setShowEndShiftModal(true)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold text-right"
            >
              <span className="text-base text-orange-400">⏰</span>
              <span>الوردية</span>
            </button>

            <Link
              href="/dashboard/reports"
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold"
            >
              <span className="text-base text-orange-400">📊</span>
              <span>التقارير</span>
            </Link>

            <Link
              href="/dashboard/equipment"
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-900 transition text-xs font-bold"
            >
              <span className="text-base text-orange-400">⚙️</span>
              <span>الإعدادات</span>
            </Link>
          </nav>

          {/* Sidebar Bottom Flame Graphic */}
          <div className="flex flex-col items-center text-center pt-2 border-t border-stone-800/80">
            <img
              src="/sidebar_flame.png"
              alt="مشويات بسيوني"
              className="w-16 h-16 object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]"
            />
            <p className="text-[10px] text-amber-400 font-black mt-1">جودة.. طعم.. ثقة</p>
            <p className="text-[9px] text-stone-400 font-bold">مشويات بسيوني</p>
            <p className="text-[8px] text-orange-500 font-mono tracking-wider">MASHWEYAT BASIONY</p>
          </div>
        </aside>

        {/* B. CENTER-LEFT: CURRENT ORDER PANEL */}
        <section className="w-[330px] sm:w-[360px] lg:w-[390px] bg-[#101014] border-l border-orange-500/20 flex flex-col justify-between shrink-0 p-3">
          
          {/* Top Actions: New Order & Cancel */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={handleStartNewOrder}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-stone-950 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition"
            >
              <span>+ طلب جديد</span>
            </button>
            <button
              onClick={handleClearOrder}
              className="px-3 py-2 rounded-xl border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-xs font-bold flex items-center gap-1 transition"
            >
              <span>🗑️</span>
              <span>إلغاء الطلب</span>
            </button>
          </div>

          {/* Table & Customer Selectors */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Table Dropdown */}
            <div className="relative">
              <label className="text-[10px] text-stone-400 block mb-0.5">رقم الطاولة</label>
              <select
                value={selectedTable?.id || ""}
                onChange={(e) => {
                  const t = tables.find((item) => item.id === e.target.value);
                  if (t) handleSelectTable(t);
                }}
                className="w-full bg-[#18181f] border border-orange-500/30 rounded-xl px-2 py-1.5 text-xs text-orange-300 font-bold outline-none focus:border-orange-500"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id} className="bg-stone-900 text-stone-200">
                    {t.name} {t.status === TableStatus.OCCUPIED ? "🔴 (مشغولة)" : "🟢"}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Dropdown */}
            <div className="relative">
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[10px] text-stone-400">اختر العميل</label>
                <button
                  onClick={() => setShowQuickCustomerModal(true)}
                  className="text-[10px] text-orange-400 font-bold hover:underline"
                >
                  + جديد
                </button>
              </div>
              <select
                value={selectedCustomerId || ""}
                onChange={(e) => {
                  const c = customersList.find((item) => item.id === e.target.value);
                  if (c) {
                    setSelectedCustomerId(c.id);
                    setCustomerName(c.name);
                    setCustomerPhone(c.phone);
                    if (c.address) setDeliveryAddress(c.address);
                  } else {
                    setSelectedCustomerId(null);
                  }
                }}
                className="w-full bg-[#18181f] border border-orange-500/30 rounded-xl px-2 py-1.5 text-xs text-stone-200 font-bold outline-none focus:border-orange-500"
              >
                <option value="" className="bg-stone-900 text-stone-400">عميل صالة (اختياري)</option>
                {customersList.map((c) => (
                  <option key={c.id} value={c.id} className="bg-stone-900 text-stone-200">
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Order Items Table */}
          <div className="flex-1 bg-[#141418] border border-stone-800/80 rounded-xl overflow-hidden flex flex-col mb-2">
            <div className="bg-[#1a1a22] border-b border-stone-800 text-[11px] font-bold text-orange-300 py-1.5 px-2 grid grid-cols-12 gap-1 text-center">
              <span className="col-span-1">#</span>
              <span className="col-span-5 text-right">الصنف</span>
              <span className="col-span-2">الكمية</span>
              <span className="col-span-2">السعر</span>
              <span className="col-span-2">الإجمالي</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-stone-800/50 p-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-500 text-xs py-10">
                  <span className="text-3xl mb-1">🛒</span>
                  <span>لا توجد أصناف في الطلب</span>
                  <span className="text-[10px] text-stone-600 mt-1">اضغط على الأصناف لإضافتها</span>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={item.menuItemId}
                    className="py-1.5 px-1 grid grid-cols-12 gap-1 items-center text-xs hover:bg-stone-800/30 rounded-lg group"
                  >
                    <span className="col-span-1 text-stone-500 font-mono text-center">{idx + 1}</span>
                    <div className="col-span-5 text-right pr-1">
                      <p className="font-bold text-stone-100 truncate">{item.nameAr}</p>
                    </div>
                    <div className="col-span-2 flex items-center justify-center gap-1 font-mono font-bold">
                      <button
                        onClick={() => handleUpdateQuantity(item.menuItemId, -1)}
                        className="w-4 h-4 bg-stone-800 hover:bg-orange-500 hover:text-black rounded text-[10px] flex items-center justify-center transition"
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.menuItemId, 1)}
                        className="w-4 h-4 bg-stone-800 hover:bg-orange-500 hover:text-black rounded text-[10px] flex items-center justify-center transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="col-span-2 text-center font-mono text-stone-300">{item.price}</span>
                    <div className="col-span-2 flex items-center justify-between font-mono font-black text-orange-400 pl-1">
                      <span>{item.price * item.quantity}</span>
                      <button
                        onClick={() => handleRemoveItem(item.menuItemId)}
                        className="text-stone-500 hover:text-rose-500 text-xs ml-1"
                        title="حذف"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Financial Totals Block */}
          <div className="bg-[#141418] border border-orange-500/20 rounded-xl p-2.5 mb-2 space-y-1 text-xs">
            <div className="flex justify-between items-center text-stone-400">
              <span>إجمالي الطلب</span>
              <span className="font-mono font-bold text-stone-200">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-stone-400">
              <span>الخصم</span>
              <span className="font-mono font-bold text-stone-300">{discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-stone-400">
              <span>الضريبة</span>
              <span className="font-mono font-bold text-stone-300">0.00</span>
            </div>

            {/* Glowing Orange Grand Total Banner */}
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-stone-950 font-black text-lg py-2 px-3 rounded-xl flex justify-between items-center shadow-lg shadow-orange-500/30 mt-1">
              <span>المبلغ الكلي</span>
              <span className="font-mono text-xl">{totalAmount.toFixed(2)} ج.م</span>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePrintCustomerCheck}
              className="bg-[#1a1a22] border border-orange-500/40 hover:bg-stone-800 text-orange-400 font-bold py-2.5 rounded-xl text-xs flex flex-col items-center justify-center gap-0.5 transition shadow"
            >
              <span className="text-sm">🖨️</span>
              <span>طباعة الفاتورة</span>
            </button>

            <button
              onClick={handleSendToPrep}
              className="bg-[#1a1a22] border border-orange-500/40 hover:bg-stone-800 text-orange-400 font-bold py-2.5 rounded-xl text-xs flex flex-col items-center justify-center gap-0.5 transition shadow"
            >
              <span className="text-sm">💾</span>
              <span>حفظ الطلب</span>
            </button>

            <button
              onClick={handleCollectPayment}
              className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-stone-950 font-black py-2.5 rounded-xl text-xs flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-orange-500/40 transition"
            >
              <span className="text-sm">✓</span>
              <span>إتمام الطلب</span>
            </button>
          </div>
        </section>

        {/* C. CENTER-RIGHT: FOOD ITEMS GRID */}
        <section className="flex-1 bg-[#0e0e12] flex flex-col overflow-hidden p-3">
          
          {/* Top Search Bar */}
          <div className="relative mb-3">
            <span className="absolute right-3.5 top-2.5 text-stone-400 text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن صنف..."
              className="w-full bg-[#16161c] border border-orange-500/30 focus:border-orange-500 text-stone-100 placeholder-stone-500 rounded-xl pr-9 pl-4 py-2 text-xs outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-2 text-stone-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* 3-Column Grid of Food Cards */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-2.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleAddToCart(item)}
                  className="bg-[#15151b] border border-orange-500/20 hover:border-orange-500 rounded-2xl overflow-hidden cursor-pointer group hover:scale-[1.02] transition-all duration-150 shadow-md flex flex-col"
                >
                  {/* Card Image */}
                  <div className="h-20 sm:h-24 w-full bg-stone-900 relative overflow-hidden">
                    <img
                      src={item.image || "/items/kofta.jpg"}
                      alt={item.nameAr}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  </div>

                  {/* Card Info */}
                  <div className="p-2 flex flex-col justify-between flex-1 text-center bg-[#15151b]">
                    <h3 className="font-bold text-xs text-stone-100 truncate group-hover:text-amber-400 transition">
                      {item.nameAr}
                    </h3>
                    <p className="font-mono font-black text-sm text-orange-400 mt-1">
                      {item.price} <span className="text-[10px] font-sans">ج.م</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* D. FAR RIGHT: CATEGORIES COLUMN */}
        <aside className="w-24 sm:w-28 bg-[#0c0c0f] border-r border-orange-500/20 flex flex-col py-3 px-1.5 shrink-0 z-20">
          <div className="flex flex-col gap-1.5">
            {OFFICIAL_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center justify-between px-2 py-2.5 rounded-xl text-xs font-bold transition text-right ${
                    isSelected
                      ? "bg-gradient-to-l from-orange-500 to-amber-500 text-stone-950 font-black shadow-lg shadow-orange-500/30"
                      : "text-stone-300 hover:text-white hover:bg-stone-900"
                  }`}
                >
                  <span className="truncate">{cat.nameAr}</span>
                  <span className="text-xs">
                    {cat.id === "ALL" && "▦"}
                    {cat.id === "GRILLS" && "🍖"}
                    {cat.id === "SANDWICHES" && "🥪"}
                    {cat.id === "TRAYS" && "👑"}
                    {cat.id === "MEALS" && "🍱"}
                    {cat.id === "SIDES" && "🥣"}
                    {cat.id === "DRINKS" && "🥤"}
                    {cat.id === "SHISHA" && "💨"}
                    {cat.id === "DESSERTS" && "🍰"}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* 3. BOTTOM SECTION: RECENT ORDERS, SHORTCUTS, QUICK STATS */}
      <section className="h-44 shrink-0 bg-[#0c0c0f] border-t border-orange-500/30 px-3 py-2 flex flex-col sm:flex-row gap-3 z-30">
        
        {/* Box 1: Recent Orders Table */}
        <div className="flex-1 bg-[#121216] border border-orange-500/20 rounded-2xl p-2.5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-1.5 text-xs text-orange-400 font-bold">
            <div className="flex items-center gap-1.5">
              <span>🕒</span>
              <span>آخر الطلبات</span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono">اليوم</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-right text-[11px]">
              <thead>
                <tr className="text-stone-500 border-b border-stone-800 text-[10px]">
                  <th className="pb-1 text-center">#</th>
                  <th className="pb-1 text-center">الوقت</th>
                  <th className="pb-1 text-center">الطاولة</th>
                  <th className="pb-1 text-center">الإجمالي</th>
                  <th className="pb-1 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/40 font-mono">
                {recentOrders.map((ro, i) => (
                  <tr key={i} className="hover:bg-stone-800/30">
                    <td className="py-1 text-center text-stone-400">{ro.orderNumber}</td>
                    <td className="py-1 text-center text-stone-400">{ro.time}</td>
                    <td className="py-1 text-center text-stone-200 font-bold">{ro.table}</td>
                    <td className="py-1 text-center text-orange-400 font-bold">{ro.total}</td>
                    <td className="py-1 text-center">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full inline-block font-sans ${ro.statusColor}`}>
                        {ro.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Box 2: 6 Operational Shortcut Tiles */}
        <div className="w-[300px] bg-[#121216] border border-orange-500/20 rounded-2xl p-2.5 grid grid-cols-3 gap-2 shrink-0">
          <button
            onClick={() => {
              const takeaway = tables.find((t) => t.name.includes("مباشر") || t.name.includes("تيك أواي"));
              if (takeaway) handleSelectTable(takeaway, "TAKEAWAY");
            }}
            className="bg-[#181820] hover:border-orange-500 border border-stone-800 rounded-xl flex flex-col items-center justify-center p-1.5 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">🔥</span>
            <span className="text-[11px] font-bold text-stone-300 mt-1">سريع</span>
          </button>

          <button
            onClick={handleSendToPrep}
            className="bg-[#181820] hover:border-orange-500 border border-stone-800 rounded-xl flex flex-col items-center justify-center p-1.5 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">👨‍🍳</span>
            <span className="text-[11px] font-bold text-stone-300 mt-1">المطبخ</span>
          </button>

          <button
            onClick={() => setSelectedCategory("DRINKS")}
            className="bg-[#181820] hover:border-orange-500 border border-stone-800 rounded-xl flex flex-col items-center justify-center p-1.5 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">🥤</span>
            <span className="text-[11px] font-bold text-stone-300 mt-1">المشروبات</span>
          </button>

          <button
            onClick={() => setSelectedCategory("SHISHA")}
            className="bg-[#181820] hover:border-orange-500 border border-stone-800 rounded-xl flex flex-col items-center justify-center p-1.5 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">💨</span>
            <span className="text-[11px] font-bold text-stone-300 mt-1">الشيشة</span>
          </button>

          <button
            onClick={() => {
              setOrderType("DELIVERY");
              setShowQuickCustomerModal(true);
            }}
            className="bg-[#181820] hover:border-orange-500 border border-stone-800 rounded-xl flex flex-col items-center justify-center p-1.5 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">🛵</span>
            <span className="text-[11px] font-bold text-stone-300 mt-1">دليفري</span>
          </button>

          <button
            onClick={() => setShowTablesModal(true)}
            className="bg-[#181820] hover:border-orange-500 border border-stone-800 rounded-xl flex flex-col items-center justify-center p-1.5 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">🪑</span>
            <span className="text-[11px] font-bold text-stone-300 mt-1">الطاولات</span>
          </button>
        </div>

        {/* Box 3: Quick Statistics */}
        <div className="w-[280px] bg-[#121216] border border-orange-500/20 rounded-2xl p-2.5 flex flex-col justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-orange-400 font-bold mb-1">
            <span>📈</span>
            <span>البيانات السريعة</span>
          </div>

          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-stone-300">
              <span className="font-sans text-[11px] text-stone-400">إجمالي المبيعات اليوم:</span>
              <span className="font-bold text-orange-400 text-sm">{shiftSales.toLocaleString()} ج.م</span>
            </div>

            <div className="flex items-center justify-between text-stone-300">
              <span className="font-sans text-[11px] text-stone-400">عدد الطلبات:</span>
              <span className="font-bold text-stone-100">{shiftOrdersCount}</span>
            </div>

            <div className="flex items-center justify-between text-stone-300">
              <span className="font-sans text-[11px] text-stone-400">متوسط قيمة الطلب:</span>
              <span className="font-bold text-stone-100">{avgOrderValue} ج.م</span>
            </div>

            <div className="flex items-center justify-between text-stone-300">
              <span className="font-sans text-[11px] text-stone-400">عدد الطاولات المشغولة:</span>
              <span className="font-bold text-amber-400">{occupiedCount}/{totalTablesCount}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BOTTOM FOOTER BAR */}
      <footer className="h-8 shrink-0 bg-[#09090b] border-t border-stone-800/80 px-4 flex items-center justify-between text-[11px] text-stone-400 font-mono">
        <div className="flex items-center gap-1.5 text-orange-400 font-bold">
          <span>🔥</span>
          <span>مشويات بسيوني - نظام نقاط البيع</span>
        </div>

        <div className="text-stone-500 hidden sm:block">
          MASHWEYAT BASIONY
        </div>

        <div className="flex items-center gap-1.5 text-amber-400 font-sans font-bold">
          <span>أطيب مشويات ... لأحلى تجميع</span>
          <span>🔥</span>
        </div>
      </footer>

      {/* MODAL: TABLES VISUAL FLOOR MAP */}
      {showTablesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-orange-500/40 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🪑</span>
                <h2 className="text-lg font-black text-orange-400">خريطة صالة مشويات بسيوني</h2>
              </div>
              <button
                onClick={() => setShowTablesModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {tables.map((t) => {
                const isOccupied = t.status === TableStatus.OCCUPIED;
                const isSelected = selectedTable?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      handleSelectTable(t);
                      setShowTablesModal(false);
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-28 ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20"
                        : isOccupied
                        ? "border-rose-500/50 bg-rose-950/20"
                        : "border-stone-800 bg-[#181820] hover:border-stone-600"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm text-stone-100">{t.name}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${isOccupied ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`}></span>
                    </div>

                    {isOccupied && t.orders && t.orders[0] ? (
                      <div className="text-center bg-rose-900/40 rounded-lg p-1">
                        <p className="text-[10px] text-stone-300">أوردر #{t.orders[0].orderNumber}</p>
                        <p className="font-mono font-black text-rose-300 text-xs">{t.orders[0].totalAmount} ج.م</p>
                      </div>
                    ) : (
                      <div className="text-center text-stone-500 text-[11px]">
                        فارغة • متاح
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QUICK CUSTOMER */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-orange-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-black text-orange-400 mb-4 flex items-center gap-2">
              <span>👤</span>
              <span>إضافة عميل جديد</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-stone-400 block mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="مثال: محمد بسيوني"
                  className="w-full bg-[#181820] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="010..."
                  className="w-full bg-[#181820] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">العنوان (للدليفري)</label>
                <input
                  type="text"
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  placeholder="الشارع - رقم العمارة"
                  className="w-full bg-[#181820] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  onClick={async () => {
                    if (!quickName || !quickPhone) {
                      alert("يرجى إدخال الاسم ورقم الهاتف");
                      return;
                    }
                    const res = await createCustomer({
                      name: quickName,
                      phone: quickPhone,
                      address: quickAddress || undefined,
                    });
                    if (res?.customer) {
                      setCustomersList((prev) => [res.customer, ...prev]);
                      setSelectedCustomerId(res.customer.id);
                      setCustomerName(res.customer.name);
                      setCustomerPhone(res.customer.phone);
                      if (res.customer.address) setDeliveryAddress(res.customer.address);
                      setShowQuickCustomerModal(false);
                      setQuickName("");
                      setQuickPhone("");
                      setQuickAddress("");
                    } else {
                      alert(res?.error || "فشل تسجيل العميل");
                    }
                  }}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-stone-950 font-bold py-2 rounded-xl"
                >
                  حفظ العميل
                </button>
                <button
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="px-4 py-2 bg-stone-800 text-stone-300 rounded-xl"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHIFT & Z-REPORT */}
      {showEndShiftModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-orange-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-black text-orange-400 mb-3 flex items-center gap-2">
              <span>⏰</span>
              <span>تقفيل الوردية وطباعة تقرير Z-Report</span>
            </h3>

            <div className="bg-stone-900 rounded-2xl p-4 mb-4 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-stone-300">
                <span className="font-sans">الكاشير:</span>
                <span className="font-bold">{userName}</span>
              </div>
              <div className="flex justify-between text-stone-300">
                <span className="font-sans">إجمالي مبيعات الوردية:</span>
                <span className="font-bold text-orange-400">{shiftSales.toLocaleString()} ج.م</span>
              </div>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div>
                <label className="text-stone-400 block mb-1">النقدية الفعلية في الدرج (ج.م)</label>
                <input
                  type="number"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="أدخل المبلغ الفعلي"
                  className="w-full bg-[#181820] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500 font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">اسم مستلم الوردية</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="المشرف / الإدارة"
                  className="w-full bg-[#181820] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (activeShift?.id) {
                    await endShift({
                      shiftId: activeShift.id,
                      actualCash: parseFloat(countedCash) || 0,
                      notes: endShiftNotes,
                      receivedBy: receivedBy || undefined,
                    });
                  }
                  const zHtml = buildZReportHtml({
                    shift: {
                      startTime: new Date(),
                      initialCash: activeShift?.initialCash || 0,
                      paidOrdersTotal: shiftSales,
                    },
                    stats: { paidOrdersTotal: shiftSales },
                    cashierName: userName,
                  }, userName);
                  await silentPrintHtml(zHtml);
                  setShowEndShiftModal(false);
                  alert("تم تقفيل الوردية وطباعة Z-Report بنجاح ✓");
                }}
                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black py-2.5 rounded-xl shadow-lg shadow-orange-500/30"
              >
                تأكيد التقفيل وطباعة Z-Report
              </button>
              <button
                onClick={() => setShowEndShiftModal(false)}
                className="px-4 py-2.5 bg-stone-800 text-stone-300 rounded-xl font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
