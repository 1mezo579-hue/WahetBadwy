"use client";

import { useState, useEffect, useTransition } from "react";
import { TableType, TableStatus, OrderStatus } from "@prisma/client";
import { sendOrderToPrep, collectOrderPayment } from "@/actions/pos";
import Link from "next/link";
import { serialPrinter, SerialPrinterStatus } from "@/utils/printer/web-serial";
import {
  routeAndPrintPrepOrder,
  executePaymentAndOpenDrawer,
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
}: {
  initialTables: PosTable[];
  categories: PosCategory[];
  menuItems: PosMenuItem[];
  userName: string;
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

  // Subscribe to Web Serial status updates
  useEffect(() => {
    const unsubscribe = serialPrinter.onStatusChange((status) => {
      setPrinterStatus(status);
    });
    return () => unsubscribe();
  }, []);

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

  // Test Cash Drawer Kick (Independent hardware test)
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

  // Table Selection logic
  const handleSelectTable = (table: PosTable) => {
    setSelectedTable(table);
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

    setActiveTab("ORDER");
  };

  // Add Item to Cart
  const handleAddToCart = (item: PosMenuItem) => {
    if (!selectedTable) {
      alert("يرجى اختيار طاولة أولاً قبل إضافة الأصناف!");
      setActiveTab("MAP");
      return;
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

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = isComplimentary ? subtotal : 0;
  const totalAmount = isComplimentary ? 0 : subtotal;

  /**
   * SPRINT 4 REQUIREMENT 1: Action A - Send to Prep (حفظ وطباعة الأوردر)
   * - Saves order as OPEN.
   * - Routes dedicated Kitchen Ticket for kitchen items.
   * - Routes dedicated Barista Ticket for barista items.
   * - Routes dedicated Shisha Ticket for shisha items.
   * - Generates Customer Check.
   * - CRITICAL: Every prep ticket displays DiningTable.name!
   * - CRITICAL: NONE of these print jobs open the cash drawer.
   */
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
        subtitle: `طاولة: ${selectedTable.name} • (تم توجيه ${routeRes.tickets.length} بونات طباعة - درج النقدية مغلق)`,
        isPayment: false,
        drawerKicked: false,
        tickets: routeRes.tickets,
        activeTicketIndex: 0,
      });

      // Update local table status to OCCUPIED
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
    });
  };

  /**
   * SPRINT 4 REQUIREMENT 2: Action B - Collect Payment (تحصيل)
   * - Saves order as PAID and frees table.
   * - CRITICAL CASH DRAWER LOGIC: Kicks open the cash drawer via ESC/POS command (0x1B 0x70...).
   * - DRAWER MUST ONLY OPEN ON THIS ACTION.
   * - Prints final tax receipt.
   */
  const handleCollectPayment = () => {
    if (!selectedTable) return;
    if (cart.length === 0 && !activeOrderId) {
      alert("لا يوجد طلب مفتوح أو أصناف لتحصيلها!");
      return;
    }

    const confirmMsg = isComplimentary
      ? `تأكيد إغلاق طلب الضيافة لطاولة ${selectedTable.name} (المبلغ: 0 ج.م)؟`
      : `تأكيد تحصيل مبلغ ${totalAmount.toFixed(
          2
        )} ج.م لطاولة ${selectedTable.name} وفتح درج النقدية وإخلاء الطاولة؟`;

    if (!confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await collectOrderPayment({
        orderId: activeOrderId,
        tableId: selectedTable.id,
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
        subtitle: `طاولة: ${selectedTable.name} • 🚪 تم فتح درج النقدية بنجاح عبر إشارة ESC/POS`,
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

      // Reset cart and return to map
      setCart([]);
      setActiveOrderId(undefined);
      setSelectedTable(null);
      setActiveTab("MAP");
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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top POS Kiosk Navigation Bar */}
      <header className="bg-primary-950 text-white px-4 py-2.5 flex items-center justify-between border-b border-primary-800 shadow-md shrink-0">
        <div className="flex items-center gap-4">
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

        {/* Right side: Hardware Web Serial Status & Admin link */}
        <div className="flex items-center gap-3 text-xs">
          {/* SPRINT 4: Thermal Printer Web Serial Status Pill */}
          <button
            onClick={() => setShowPrinterSettings(true)}
            className={`px-3 py-1.5 rounded-lg font-bold border transition flex items-center gap-2 ${
              printerStatus.isConnected
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900"
                : "bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                printerStatus.isConnected
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-slate-400"
              }`}
            ></span>
            <span>
              {printerStatus.isConnected
                ? "🖨️ طابعة الكاشير متصلة"
                : "🖨️ ربط الطابعة (Serial)"}
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-primary-200 bg-primary-900/60 px-3 py-1.5 rounded-lg border border-primary-800">
            <span>👤 الكاشير:</span>
            <strong className="text-white font-bold">{userName}</strong>
          </div>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg bg-primary-800 hover:bg-primary-700 text-amber-300 font-bold transition"
          >
            لوحة الإدارة ⚙️
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* VIEW 1: Visual Table Map */}
        {activeTab === "MAP" && (
          <div className="flex-1 p-6 overflow-y-auto bg-slate-100 space-y-6">
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
              {/* Cart Header (Table Info + Complimentary Banner) */}
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🪑</span>
                    <div>
                      <h3 className="font-black text-slate-800 text-base">
                        {selectedTable.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">
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

                {/* SPECIAL LOGIC: Complimentary Banner for Owner / Manager table */}
                {isComplimentary && (
                  <div className="bg-amber-100 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-900 font-bold flex items-center gap-2 animate-pulse">
                    <span className="text-base">👑</span>
                    <div>
                      <p className="font-black">
                        طلب ضيافة (Complimentary Order)
                      </p>
                      <p className="text-[10px] font-medium text-amber-800">
                        طاولة خاصة بالمالك/المدير - يتم إعفاء الحساب بنسبة 100%.
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
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono font-bold">
                      {subtotal.toFixed(2)} ج.م
                    </span>
                  </div>
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

                {/* SPRINT 4 WORKFLOW: Action A vs Action B */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Action A: Send to Prep (حفظ وتوجيه بونات التحضير) */}
                  <button
                    disabled={isPending || cart.length === 0}
                    onClick={handleSendToPrep}
                    className="py-3 px-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition shadow-sm flex flex-col items-center justify-center gap-0.5"
                  >
                    <span>🖨️ إرسال للتحضير (طباعة)</span>
                    <span className="text-[10px] text-indigo-200 font-normal">
                      مطبخ / باريستا / شيشة (بدون فتح الدرج)
                    </span>
                  </button>

                  {/* Action B: Collect Payment (تحصيل وفتح درج النقدية) */}
                  <button
                    disabled={isPending || (cart.length === 0 && !activeOrderId)}
                    onClick={handleCollectPayment}
                    className="py-3 px-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition shadow-sm flex flex-col items-center justify-center gap-0.5"
                  >
                    <span>💳 تحصيل وفتح الدرج 🚪</span>
                    <span className="text-[10px] text-emerald-200 font-normal">
                      فتح الدرج (ESC/POS) + إيصال سداد
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
                className="flex-1 py-3 bg-primary-800 hover:bg-primary-900 text-white font-bold rounded-xl text-xs transition shadow"
              >
                إغلاق والمتابعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
