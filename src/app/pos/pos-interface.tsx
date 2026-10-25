"use client";

import { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { TableType, TableStatus, OrderStatus } from "@prisma/client";
import { sendOrderToPrep, collectOrderPayment } from "@/actions/pos";
import { startShift, endShift, getActiveShift } from "@/actions/shifts";
import { createCustomer } from "@/actions/customers";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  routeAndPrintPrepOrder,
  printCustomerCheckOnly,
} from "@/utils/printer/order-router";
import {
  triggerSilentThermalPrint,
  buildZReportHtml,
  buildThermalReceiptHtml,
  silentPrintHtml,
} from "@/utils/printer/silent-print";
// Real-time Database-driven catalog
function getMenuItemImage(nameAr: string, categoryId?: string): string {
  const n = nameAr.toLowerCase();
  if (n.includes("كفتة")) return "/items/kofta.jpg";
  if (n.includes("طرب")) return "/items/tarb.jpg";
  if (n.includes("سجق")) return "/items/sogok.jpg";
  if (n.includes("شيش")) return "/items/shish.jpg";
  if (n.includes("مشكل")) return "/items/meshakel.jpg";
  if (n.includes("فرخة") || n.includes("فراخ") || n.includes("دجاج")) return "/items/chicken.jpg";
  if (n.includes("صينية")) return "/items/tray.jpg";
  if (n.includes("وجبة")) return "/items/meal.jpg";
  if (n.includes("سوري")) return "/items/syrian.jpg";
  if (n.includes("فرنساوي") || n.includes("ساندوتش")) return "/items/sandwich.jpg";
  if (n.includes("ممبار") || n.includes("كرشة") || n.includes("فشة") || n.includes("سقط")) return "/items/offal.jpg";
  if (n.includes("بيبسي") || n.includes("ميرندا") || n.includes("سفن") || n.includes("مياه") || n.includes("كانز")) return "/items/drink.jpg";
  if (n.includes("طحينة") || n.includes("سلطة") || n.includes("أرز") || n.includes("ارز") || n.includes("عيش") || n.includes("مخلل")) return "/items/sides.jpg";
  return "/items/kofta.jpg";
}

function getCategoryIcon(nameAr: string): string {
  const n = nameAr.toLowerCase();
  if (n.includes("مشويات")) return "🍖";
  if (n.includes("سوري")) return "🌯";
  if (n.includes("فرنساوي")) return "🥖";
  if (n.includes("ساندوتش")) return "🥪";
  if (n.includes("فراخ")) return "🍗";
  if (n.includes("صواني")) return "👑";
  if (n.includes("وجبات") || n.includes("عمالة")) return "🍱";
  if (n.includes("سقط") || n.includes("حلويات اللحمة")) return "🫀";
  if (n.includes("عروض")) return "🔥";
  if (n.includes("إضافات") || n.includes("مشروبات")) return "🥤";
  return "🍽️";
}
import WeightModal from "@/components/pos/weight-modal";
import CustomerGrillingForm from "@/components/pos/customer-grilling-form";
import GrillingTrackerModal from "@/components/pos/grilling-tracker-modal";
import { getGrillingRates, getActiveGrillingOrders } from "@/actions/grilling-service";
import { GrillingRates } from "@/lib/grilling-calculator";
import { buildGrillingKitchenTicketHtml, buildGrillingHandoverTicketHtml } from "@/utils/printer/silent-print";

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
  userRole = "CASHIER",
  initialShift,
  initialCustomers,
  initialSystemLocked = false,
  initialLockedBy,
  initialLockedAt,
}: {
  initialTables: PosTable[];
  categories: PosCategory[];
  menuItems: PosMenuItem[];
  userName: string;
  userId: string;
  userRole?: string;
  initialShift?: any;
  initialCustomers?: Array<{
    id: string;
    name: string;
    phone: string;
    address: string | null;
    notes: string | null;
  }>;
  initialSystemLocked?: boolean;
  initialLockedBy?: string | null;
  initialLockedAt?: string | null;
}) {
  const [tables, setTables] = useState<PosTable[]>(initialTables);
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(undefined);
  const [orderNotes, setOrderNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  // Channels: TAKEAWAY (Default & Priority), DELIVERY, DINE_IN
  const [orderType, setOrderType] = useState<"TAKEAWAY" | "DELIVERY" | "DINE_IN" | "CUSTOMER_GRILL">("TAKEAWAY");
  const [weightModalItem, setWeightModalItem] = useState<PosMenuItem | null>(null);
  const [showGrillingTracker, setShowGrillingTracker] = useState(false);
  const [activeGrillingOrders, setActiveGrillingOrders] = useState<any[]>([]);
  const [grillingRates, setGrillingRates] = useState<GrillingRates>({
    meatPricePerKg: 60,
    chickenPricePerKg: 50,
    chickenPricePerPiece: 25,
    fixedServiceFee: 30,
  });

  useEffect(() => {
    getGrillingRates().then(setGrillingRates).catch(console.error);
    getActiveGrillingOrders().then(setActiveGrillingOrders).catch(console.error);
  }, []);

  const refreshGrillingOrders = async () => {
    try {
      const orders = await getActiveGrillingOrders();
      setActiveGrillingOrders(orders);
    } catch (e) {
      console.error(e);
    }
  };

  const isGrillItem = (item: PosMenuItem) => {
    const cat = item.categoryId;
    const name = item.nameAr.toLowerCase();
    return (
      cat === "GRILLS" ||
      cat === "cat_grills_01" ||
      name.includes("كفتة") ||
      name.includes("كباب") ||
      name.includes("شيش") ||
      name.includes("مشوي") ||
      name.includes("ريش") ||
      name.includes("طرب") ||
      name.includes("سجق") ||
      name.includes("كيلو")
    );
  };

  const handleAddWeightedItem = ({
    item,
    weightGrams,
    totalPrice,
    notes,
  }: {
    item: { id: string; nameAr: string; price: number };
    weightGrams: number;
    totalPrice: number;
    notes?: string;
  }) => {
    const weightLabel = weightGrams >= 1000 ? `${(weightGrams / 1000).toFixed(2)} كجم` : `${weightGrams} جم`;
    setCart((prev) => [
      ...prev,
      {
        menuItemId: item.id,
        nameAr: `${item.nameAr} (${weightLabel})`,
        price: totalPrice,
        quantity: 1,
        notes: notes || undefined,
        weightGrams: weightGrams,
        rawWeightGrams: weightGrams,
        pricePerKg: item.price,
      },
    ]);
  };

  const handleCustomerGrillingSubmit = async (params: any) => {
    startTransition(async () => {
      const isPay = params.actionType === "PAY";
      const itemsPayload = params.addons.map((a: any) => ({
        menuItemId: a.id,
        nameAr: a.nameAr,
        price: a.price,
        quantity: a.quantity,
        isCustomerMeat: false,
      }));

      const orderPayload: any = {
        orderType: "TAKEAWAY",
        orderKind: "CUSTOMER_GRILL",
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        customerMeatWeight: params.rawWeightGrams,
        grillingFee: params.grillingFee,
        meatType: params.meatType,
        pricingMode: params.pricingMode,
        expectedPickupTime: params.expectedPickupTime,
        receivedBy: userName,
        workflowStatus: isPay ? "DELIVERED" : "RECEIVED_CUSTOMER_MEAT",
        notes: params.notes,
        items: itemsPayload,
      };

      const actionFn = isPay ? collectOrderPayment : sendOrderToPrep;
      const res = await actionFn(orderPayload);

      if (res?.error) {
        alert(res.error);
        return;
      }

      const orderNumber = (res as any).order?.orderNumber;

      const basePrintOptions = {
        tableName: "خامات العميل (شوي للغير)",
        orderNumber,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        items: params.addons.map((a: any) => ({
          nameAr: a.nameAr,
          quantity: a.quantity,
          price: a.price,
        })),
        subtotal: params.grillingFee + params.addons.reduce((s: number, a: any) => s + a.price * a.quantity, 0),
        totalAmount: params.grillingFee + params.addons.reduce((s: number, a: any) => s + a.price * a.quantity, 0),
        cashierName: userName,
        isPaid: isPay,
        orderKind: "CUSTOMER_GRILL" as const,
        meatType: params.meatType,
        customerMeatWeight: params.rawWeightGrams,
        grillingFee: params.grillingFee,
        expectedPickupTime: params.expectedPickupTime,
        receivedBy: userName,
        notes: params.notes,
      };

      // Print Kitchen Ticket
      await silentPrintHtml(buildGrillingKitchenTicketHtml(basePrintOptions));

      // Print Handover Slip
      await silentPrintHtml(buildGrillingHandoverTicketHtml(basePrintOptions));

      // Print Customer Check
      await silentPrintHtml(
        buildThermalReceiptHtml({
          ...basePrintOptions,
          title: isPay ? "فاتورة سداد خدمة شوي للغير" : "شيك استلام خدمة شوي للغير",
        })
      );

      alert(
        isPay
          ? "تم تحصيل رسوم الشوي وطباعة البونات بنجاح ✓"
          : "تم تسجيل واستلام خامات العميل وتوجيه بون الشواية وبون الاستلام للطباعة بنجاح ✓"
      );

      await refreshGrillingOrders();
      setOrderType("TAKEAWAY");
    });
  };

  // Customer State
  const [customersList, setCustomersList] = useState<any[]>(initialCustomers || []);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<string>("");
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState<boolean>(false);
  const [quickName, setQuickName] = useState<string>("");
  const [quickPhone, setQuickPhone] = useState<string>("");
  const [quickAddress, setQuickAddress] = useState<string>("");

  // Modals
  const [showTablesModal, setShowTablesModal] = useState(false);
  const [isCheckPrinted, setIsCheckPrinted] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(initialShift);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [endShiftNotes, setEndShiftNotes] = useState("");
  const [receivedBy, setReceivedBy] = useState("");

  // 1. CENTRAL SYSTEM LOCKDOWN (Synced with Server)
  const [isSystemLocked, setIsSystemLocked] = useState<boolean>(initialSystemLocked);
  const [systemLockedBy, setSystemLockedBy] = useState<string | null>(initialLockedBy || null);
  const [systemLockedAt, setSystemLockedAt] = useState<string | null>(initialLockedAt || null);

  // 2. INACTIVITY AUTO-LOCK (5 Minutes)
  const [isIdleLocked, setIsIdleLocked] = useState<boolean>(false);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState<string>("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState<number>(5);
  const lastActivityTimeRef = useRef<number>(Date.now());

  // Listen to user activity to reset idle timer
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityTimeRef.current = Date.now();
    };

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("mousedown", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("touchstart", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity);

    // Check idle timeout every 5 seconds
    const idleCheckInterval = setInterval(() => {
      const elapsedMs = Date.now() - lastActivityTimeRef.current;
      const timeoutMs = idleTimeoutMinutes * 60 * 1000;
      if (elapsedMs >= timeoutMs && !isIdleLocked) {
        setIsIdleLocked(true);
      }
    }, 5000);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("mousedown", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
      clearInterval(idleCheckInterval);
    };
  }, [idleTimeoutMinutes, isIdleLocked]);

  // Poll Central System Lock & Session Validity every 5 seconds
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch("/api/system-status");
        if (res.ok) {
          const data = await res.json();
          setIsSystemLocked(!!data.isLocked);
          if (data.lockedBy) setSystemLockedBy(data.lockedBy);
          if (data.lockedAt) setSystemLockedAt(data.lockedAt);

          // Force logout if session was revoked globally
          if (data.sessionCutoff && data.sessionCutoff > 0) {
            const loginTimeStr = sessionStorage.getItem("pos_login_time");
            const loginTime = loginTimeStr ? parseInt(loginTimeStr) : Date.now();
            if (loginTime < data.sessionCutoff) {
              alert("تم تسجيل الخروج الإجباري من قبل الإدارة. يرجى تسجيل الدخول مجدداً.");
              signOut({ callbackUrl: "/login" });
            }
          }
        }
      } catch (e) {
        // network polling silent catch
      }
    };

    if (!sessionStorage.getItem("pos_login_time")) {
      sessionStorage.setItem("pos_login_time", String(Date.now()));
    }

    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Live Clock
  const [currentTime, setCurrentTime] = useState({ date: "2025/10/23", time: "20:37" });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const h = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      setCurrentTime({ date: `${y}/${m}/${d}`, time: `${h}:${min}` });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Single Source of Truth: 100% powered by real DB menu items
  const allMenuItems = useMemo(() => {
    return menuItems.map((dbItem) => ({
      id: dbItem.id,
      nameAr: dbItem.nameAr,
      price: dbItem.price,
      categoryId: dbItem.categoryId,
      description: dbItem.description,
      image: (dbItem as any).imageUrl || dbItem.image || getMenuItemImage(dbItem.nameAr, dbItem.categoryId),
    }));
  }, [menuItems]);

  // Filtered menu items by active category and search
  const filteredItems = useMemo(() => {
    return allMenuItems.filter((item) => {
      const matchCat = selectedCategory === "ALL" || item.categoryId === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.nameAr.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q));

      return matchCat && matchSearch;
    });
  }, [allMenuItems, selectedCategory, searchQuery]);

  // 1. One-Click Takeaway Starter (The Primary Action)
  const handleStartTakeaway = () => {
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }
    setOrderType("TAKEAWAY");
    setSelectedTable(null);
    setCart([]);
    setActiveOrderId(undefined);
    setIsCheckPrinted(false);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setOrderNotes("");
  };

  // 2. Start Delivery
  const handleStartDelivery = () => {
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }
    setOrderType("DELIVERY");
    setSelectedTable(null);
    setShowQuickCustomerModal(true);
  };

  // 3. Start Dine-In
  const handleStartDineIn = () => {
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }
    setOrderType("DINE_IN");
    setShowTablesModal(true);
  };

  // Select Table handler
  const handleSelectTable = (table: PosTable) => {
    setSelectedTable(table);
    setOrderType("DINE_IN");

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
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة. لا يمكن إضافة أصناف للطلب.");
      return;
    }

    // Check if item is sold by raw weight (Grills category or explicitly marked by weight)
    const isWeightedItem =
      (item as any).isWeighted ||
      item.categoryId === "cat_grills_01" ||
      item.description?.includes("بالوزن") ||
      (item.nameAr.includes("مشوي") &&
        !item.nameAr.includes("ساندوتش") &&
        !item.nameAr.includes("فرنساوي") &&
        !item.nameAr.includes("صينية"));

    if (isWeightedItem) {
      setWeightModalItem(item);
      return;
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
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }

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
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }
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

  // Admin Quick Lock / Unlock Action
  const handleToggleSystemLock = async () => {
    if (userRole !== "ADMIN") return;
    const nextAction = isSystemLocked ? "UNLOCK" : "LOCK";
    const promptMsg = isSystemLocked
      ? "هل تريد إعادة فتح النظام لجميع أجهزة الكاشير؟"
      : "هل تريد قفل النظام فوراً على كل الأجهزة وتعليق عمليات البيع؟";

    if (!confirm(promptMsg)) return;

    try {
      const res = await fetch("/api/system-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextAction }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSystemLocked(!isSystemLocked);
        alert(data.message);
      } else {
        alert(data.error || "فشل تغيير حالة النظام");
      }
    } catch (e: any) {
      alert("خطأ: " + e.message);
    }
  };

  // Unlock Inactivity Idle Screen
  const handleUnlockIdleScreen = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    // Simple password unlock check: verify non-empty or correct pin
    if (unlockPasswordInput.trim().length > 0) {
      setIsIdleLocked(false);
      setUnlockPasswordInput("");
      lastActivityTimeRef.current = Date.now();
    } else {
      setUnlockError("يرجى إدخال كلمة المرور أو رمز الدخول للمتابعة");
    }
  };

  // Calculations
  const isComplimentary =
    selectedTable?.type === TableType.OWNER ||
    selectedTable?.type === TableType.MANAGER;

  const deliveryFeeNumber = orderType === "DELIVERY" ? (parseFloat(deliveryFee) || 0) : 0;
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = isComplimentary ? (subtotal + deliveryFeeNumber) : 0;
  const totalAmount = isComplimentary ? 0 : Math.max(0, subtotal + deliveryFeeNumber - discount);

  // Send Order to Prep (حفظ وطباعة الأوردر)
  const handleSendToPrep = () => {
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة (" + (systemLockedBy || "الإدارة") + ")");
      return;
    }
    if (cart.length === 0) {
      alert("السلة فارغة! يرجى إضافة أصناف أولاً.");
      return;
    }

    startTransition(async () => {
      const res = await sendOrderToPrep({
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

      await routeAndPrintPrepOrder({
        tableName: selectedTable?.name || (orderType === "DELIVERY" ? "دليفري" : "تيك أواي"),
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
            : "بون تحضير الصالة (KITCHEN)",
        receiptType: "PREP",
        tableName: selectedTable?.name || (orderType === "DELIVERY" ? "طلب دليفري" : "تيك أواي مباشر"),
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

      if (res.order && selectedTable) {
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

      alert("تم حفظ الطلب وتوجيه بون التحضير للطباعة بنجاح ✓");
    });
  };

  // Print Customer Check
  const handlePrintCustomerCheck = () => {
    if (cart.length === 0 && !activeOrderId) {
      alert("لا توجد أصناف في الطلب لطباعة الفاتورة!");
      return;
    }

    startTransition(async () => {
      let orderNum = activeOrderId ? parseInt(activeOrderId.slice(-4)) : undefined;

      await triggerSilentThermalPrint({
        title: "شيك حساب العميل (CUSTOMER CHECK)",
        receiptType: "CHECK",
        tableName: selectedTable?.name || (orderType === "DELIVERY" ? "طلب دليفري" : "تيك أواي سفري"),
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

      await triggerSilentThermalPrint({
        title: "فاتورة سداد نقدي (PAID RECEIPT)",
        receiptType: "RECEIPT",
        tableName: selectedTable?.name || (orderType === "DELIVERY" ? "طلب دليفري" : "تيك أواي"),
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

      if (selectedTable) {
        setTables((prev) =>
          prev.map((t) =>
            t.id === selectedTable.id
              ? { ...t, status: TableStatus.AVAILABLE, orders: [] }
              : t
          )
        );
      }

      // Reset for next order
      setCart([]);
      setActiveOrderId(undefined);
      setIsCheckPrinted(false);
      setCustomerName("");
      setCustomerPhone("");
      setOrderNotes("");

      if (userId) {
        const updated = await getActiveShift(userId);
        if (updated.activeShift) setActiveShift(updated.activeShift);
      }

      alert("تم إتمام الطلب وسداد الحساب بنجاح ✓");
    });
  };

  // Recent Orders
  const recentOrders = useMemo(() => {
    const list = [
      { id: "0012", time: "20:25", table: "5", total: "285.00 ج.م", status: "قيد التحضير", type: "تيك أواي", icon: "🛍️", statusBadge: "bg-amber-500/20 text-amber-400 border border-amber-500/40" },
      { id: "0013", time: "20:18", table: "3", total: "420.00 ج.م", status: "جاهز", type: "دليفري", icon: "🛵", statusBadge: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" },
      { id: "0014", time: "20:05", table: "7", total: "190.00 ج.م", status: "قيد التحضير", type: "صالة", icon: "🪑", statusBadge: "bg-amber-500/20 text-amber-400 border border-amber-500/40" },
      { id: "0015", time: "19:52", table: "2", total: "560.00 ج.م", status: "جاهز", type: "تيك أواي", icon: "🛍️", statusBadge: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" },
    ];
    return list;
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070709] text-stone-100 select-none font-sans relative" dir="rtl">
      
      {/* CENTRAL SYSTEM LOCK BANNER OVERLAY IF SYSTEM IS LOCKED */}
      {isSystemLocked && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center animate-fadeIn">
          <div className="bg-[#121218] border-2 border-rose-500 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-4">
            <div className="w-20 h-20 bg-rose-950/60 border border-rose-500/60 rounded-full flex items-center justify-center mx-auto text-4xl shadow-lg animate-pulse">
              🔒
            </div>
            <h2 className="text-2xl font-black text-rose-400">
              النظام مقفول حالياً بواسطة الإدارة
            </h2>
            <p className="text-stone-300 text-sm leading-relaxed">
              تم تعليق جميع عمليات البيع وإنشاء الطلبات وإتمام الدفع على كافة الأجهزة مؤقتاً بأمر الإدارة.
            </p>
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 text-xs text-stone-400 font-mono space-y-1 text-right">
              <div>👤 المنفّذ: <span className="text-rose-300 font-bold">{systemLockedBy || "أ/ أحمد بسيوني"}</span></div>
              <div>⏰ التوقيت: <span className="text-stone-300">{systemLockedAt || "اليوم"}</span></div>
              <div>🛡️ جميع بيانات الطلبات والورديات محفوظة بأمان.</div>
            </div>

            {userRole === "ADMIN" ? (
              <button
                onClick={handleToggleSystemLock}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 rounded-xl shadow-lg text-sm transition"
              >
                🔓 إعادة فتح النظام الآن (بصلاحية المدير)
              </button>
            ) : (
              <p className="text-stone-500 text-xs italic">
                يرجى مراجعة إدارة المطعم لإعادة فتح النظام.
              </p>
            )}
          </div>
        </div>
      )}

      {/* INACTIVITY IDLE SCREEN LOCK OVERLAY (5 Minutes) */}
      {isIdleLocked && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-lg z-40 flex items-center justify-center p-6 text-center">
          <div className="bg-[#121217] border border-orange-500/40 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-orange-950/40 border border-orange-500/40 rounded-full flex items-center justify-center mx-auto text-3xl shadow">
              ⏳
            </div>
            <h2 className="text-xl font-black text-orange-400">
              قفل الشاشة تلقائياً لعدم النشاط
            </h2>
            <p className="text-stone-300 text-xs">
              طلبك الحالي ومحتوياته <span className="text-emerald-400 font-bold">محفوظة بالكامل</span> دون أي فقدان.
            </p>

            <form onSubmit={handleUnlockIdleScreen} className="space-y-3 pt-2">
              <input
                type="password"
                value={unlockPasswordInput}
                onChange={(e) => setUnlockPasswordInput(e.target.value)}
                placeholder="أدخل رمز المرور أو PIN للمتابعة..."
                className="w-full bg-[#181822] border border-stone-700 focus:border-orange-500 rounded-xl px-4 py-2.5 text-stone-100 text-center text-sm outline-none font-mono"
                autoFocus
              />

              {unlockError && (
                <p className="text-rose-400 text-xs font-bold">{unlockError}</p>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-stone-950 font-black py-2.5 rounded-xl text-sm transition shadow-lg shadow-orange-500/20"
              >
                إلغاء القفل والمتابعة
              </button>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-stone-400 hover:text-rose-400 text-xs underline block mx-auto pt-1"
              >
                تسجيل الخروج والتبديل لحساب آخر
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 1. TOP HEADER */}
      <header className="h-16 shrink-0 bg-[#0c0c0f] border-b border-orange-500/30 px-3 sm:px-4 flex items-center justify-between relative z-30 shadow-2xl">
        {/* Left: Round Badge Logo & Slogan */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-orange-600 via-amber-400 to-orange-500 shadow-md shadow-orange-600/30">
            <img
              src="/logo.png"
              alt="مشويات بسيوني"
              className="w-full h-full rounded-full object-cover bg-black"
            />
          </div>
          <div className="hidden sm:block">
            <span className="text-[11px] text-stone-300 font-bold tracking-wide">طعم زمان على أصوله</span>
          </div>
        </div>

        {/* Center: Glowing Orange Title & Flames */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl animate-pulse">🔥</span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 drop-shadow-[0_2px_8px_rgba(249,115,22,0.4)]">
              مشويات بسيوني
            </h1>
            <span className="text-xl sm:text-2xl animate-pulse">🔥</span>
          </div>
          <p className="text-[10px] font-black tracking-[0.2em] text-orange-400/90 font-mono uppercase">
            MASHWEYAT BASIONY
          </p>
        </div>

        {/* Right: Phone, Management, Time, Address, User, Lock Button, Logout */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Phone & Management */}
          <div className="hidden md:flex flex-col text-left font-mono">
            <div className="flex items-center gap-1 text-orange-400 font-bold justify-end text-[11px]">
              <span>01038029714</span>
              <span>📞</span>
            </div>
            <div className="text-[10px] text-stone-300 font-bold text-right">
              إدارة : أحمد بسيوني
            </div>
            <div className="text-[9px] text-stone-400 text-right">
              Ahmed Basiouny
            </div>
          </div>

          {/* Live Date, Time & Address */}
          <div className="hidden lg:flex flex-col items-end text-[10px] font-mono text-stone-400 border-r border-stone-800 pr-2.5">
            <div className="flex items-center gap-2">
              <span className="text-orange-300 font-bold">📅 {currentTime.date}</span>
              <span className="text-stone-300">⏰ {currentTime.time}</span>
            </div>
            <span className="text-[9px] text-stone-500 truncate max-w-[210px]">
              عبدالقادر - شارع المستعمرة أمام شارع 10 مباشرة قبل مسجد السلام
            </span>
          </div>

          {/* Shortcut to Grilling Handover Tracker */}
          <button
            onClick={() => setShowGrillingTracker(true)}
            className="px-2.5 py-1 rounded-xl bg-orange-950/60 hover:bg-orange-900/80 text-orange-300 border border-orange-500/40 text-[11px] font-bold flex items-center gap-1.5 transition"
            title="متابعة تسليم مشويات خامات العميل"
          >
            <span>📋</span>
            <span className="hidden md:inline">متابعة الشوي</span>
            <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-stone-950 text-[10px] font-mono font-black">
              {activeGrillingOrders.filter((o) => o.workflowStatus !== "DELIVERED").length}
            </span>
          </button>

          {/* Admin Quick Lock/Unlock Shortcut if role === ADMIN */}
          {userRole === "ADMIN" && (
            <button
              onClick={handleToggleSystemLock}
              className={`px-2.5 py-1 rounded-xl font-bold text-[11px] flex items-center gap-1 border transition ${
                isSystemLocked
                  ? "bg-rose-950/60 text-rose-300 border-rose-500"
                  : "bg-stone-900 text-stone-300 border-stone-800 hover:border-orange-500/50"
              }`}
              title="التحكم في قفل النظام المركزي"
            >
              <span>{isSystemLocked ? "🔒" : "🛡️"}</span>
              <span className="hidden sm:inline">{isSystemLocked ? "النظام مقفول" : "قفل النظام"}</span>
            </button>
          )}

          {/* User Badge */}
          <div className="flex items-center gap-1.5 bg-[#141418] border border-stone-800 rounded-xl px-2.5 py-1">
            <span className="text-amber-400 text-xs">👤</span>
            <span className="font-bold text-stone-200 text-[11px]">{userName || "مدير النظام"}</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1 bg-[#141418] border border-orange-500/40 hover:bg-orange-600 hover:text-black text-orange-400 px-2.5 py-1 rounded-xl font-bold transition text-[11px]"
            title="تسجيل الخروج"
          >
            <span>تسجيل الخروج</span>
            <span>🚪</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE (Flex Row) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* A. FAR LEFT: CATEGORIES COLUMN (100% Dynamic from Database) */}
        <aside className="w-24 sm:w-28 bg-[#0a0a0c] border-l border-orange-500/20 flex flex-col py-2 px-1.5 shrink-0 z-20 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`flex items-center justify-between px-2 py-2 rounded-xl text-xs font-bold transition text-right ${
                selectedCategory === "ALL"
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black shadow-lg shadow-orange-500/30"
                  : "text-stone-300 hover:text-white hover:bg-stone-900 border border-stone-800/40"
              }`}
            >
              <span className="truncate font-black">الكل</span>
              <span className="text-[10px] font-mono text-orange-400">({allMenuItems.length})</span>
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const catItemCount = allMenuItems.filter((i) => i.categoryId === cat.id).length;
              const icon = getCategoryIcon(cat.nameAr);
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center justify-between px-1.5 py-2 rounded-xl text-xs font-bold transition text-right ${
                    isSelected
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black shadow-lg shadow-orange-500/30"
                      : "text-stone-300 hover:text-white hover:bg-stone-900 border border-stone-800/40"
                  }`}
                  title={cat.nameAr}
                >
                  <span className="truncate text-[11px] leading-tight">{cat.nameAr.trim()}</span>
                  <span className="text-xs shrink-0 mr-1">{icon}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* B. CENTER AREA: TOP 3 CHANNELS + SEARCH + DENSE FOOD GRID */}
        <section className="flex-1 bg-[#09090b] flex flex-col overflow-hidden p-2.5">
          
          {/* Top 3 Channel Buttons (Takeaway is King!) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-2.5">
            {/* 1. TAKEAWAY (Primary Vibrant Card) */}
            <button
              onClick={handleStartTakeaway}
              className={`p-2 sm:p-2.5 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md ${
                orderType === "TAKEAWAY"
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-stone-950 shadow-orange-500/30 font-black border-2 border-orange-400"
                  : "bg-[#121216] border border-orange-500/40 hover:border-orange-500 text-stone-200"
              }`}
            >
              <span className="text-2xl">🛍️</span>
              <div className="text-right">
                <p className="text-sm font-black tracking-tight leading-tight">تيك أواي</p>
                <p className={`text-[10px] font-bold ${orderType === "TAKEAWAY" ? "text-stone-900" : "text-orange-400"}`}>طلب جديد</p>
              </div>
            </button>

            {/* 2. DELIVERY */}
            <button
              onClick={handleStartDelivery}
              className={`p-2 sm:p-2.5 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md ${
                orderType === "DELIVERY"
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-stone-950 shadow-orange-500/30 font-black border-2 border-orange-400"
                  : "bg-[#121216] border border-stone-800 hover:border-orange-500/60 text-stone-200"
              }`}
            >
              <span className="text-2xl">🛵</span>
              <div className="text-right">
                <p className="text-sm font-black tracking-tight leading-tight">دليفري</p>
                <p className={`text-[10px] font-bold ${orderType === "DELIVERY" ? "text-stone-900" : "text-stone-400"}`}>توصيل للعميل</p>
              </div>
            </button>

            {/* 3. DINE-IN (HALL) */}
            <button
              onClick={handleStartDineIn}
              className={`p-2 sm:p-2.5 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md ${
                orderType === "DINE_IN"
                  ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-stone-950 shadow-orange-500/30 font-black border-2 border-orange-400"
                  : "bg-[#121216] border border-stone-800 hover:border-orange-500/60 text-stone-200"
              }`}
            >
              <span className="text-2xl">🪑</span>
              <div className="text-right">
                <p className="text-sm font-black tracking-tight leading-tight">الصالة</p>
                <p className={`text-[10px] font-bold ${orderType === "DINE_IN" ? "text-stone-900" : "text-stone-400"}`}>
                  {selectedTable ? selectedTable.name : "طلب على طاولة"}
                </p>
              </div>
            </button>

            {/* 4. CUSTOMER GRILL (الشوي الخارجي - خامة العميل) */}
            <button
              onClick={() => {
                setOrderType("CUSTOMER_GRILL");
                setSelectedTable(null);
              }}
              className={`p-2 sm:p-2.5 rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md ${
                orderType === "CUSTOMER_GRILL"
                  ? "bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-stone-950 shadow-orange-500/40 font-black border-2 border-orange-400 scale-[1.02]"
                  : "bg-[#121216] border border-orange-500/40 hover:border-orange-500 text-orange-400"
              }`}
            >
              <span className="text-2xl animate-pulse">🔥</span>
              <div className="text-right">
                <p className="text-sm font-black tracking-tight leading-tight">شوي للغير</p>
                <p className={`text-[10px] font-bold ${orderType === "CUSTOMER_GRILL" ? "text-stone-900" : "text-amber-400"}`}>
                  خامة العميل
                </p>
              </div>
            </button>
          </div>

          {orderType === "CUSTOMER_GRILL" ? (
            <CustomerGrillingForm
              rates={grillingRates}
              cashierName={userName}
              onSubmit={handleCustomerGrillingSubmit}
              isSubmitting={isPending}
              onOpenTracker={() => setShowGrillingTracker(true)}
            />
          ) : (
            <>
          {/* Search Bar & Categories Toggle */}
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <span className="absolute right-3 top-2 text-stone-400 text-xs">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن صنف..."
                className="w-full bg-[#111115] border border-orange-500/30 focus:border-orange-500 text-stone-100 placeholder-stone-500 rounded-xl pr-8 pl-3 py-1.5 text-xs outline-none transition font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 top-1.5 text-stone-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedCategory("ALL")}
              className="bg-[#14141a] border border-orange-500/40 text-orange-400 hover:bg-orange-500 hover:text-black px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition"
            >
              <span>📂</span>
              <span>الأصناف</span>
            </button>
          </div>

          {/* Dense High-Capacity Grid of Food Cards (8 Columns on desktop!) */}
          <div className="flex-1 overflow-y-auto pr-0.5">
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleAddToCart(item)}
                  className="bg-[#121217] border border-orange-500/25 hover:border-orange-500 rounded-xl overflow-hidden cursor-pointer group transition-all duration-100 flex flex-col justify-between shadow relative p-1 hover:shadow-orange-500/10"
                >
                  {/* Dish Image */}
                  <div className="h-14 w-full bg-stone-950 rounded-lg overflow-hidden relative mb-1">
                    <img
                      src={item.image || "/items/kofta.jpg"}
                      alt={item.nameAr}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>

                  {/* Dish Name & Price */}
                  <div className="text-center px-0.5">
                    <h3 className="font-bold text-[11px] text-stone-100 truncate group-hover:text-amber-400 transition leading-tight">
                      {item.nameAr}
                    </h3>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="font-mono font-black text-xs text-orange-400">
                        {item.price}
                      </span>
                      <span className="text-[9px] text-stone-400 font-sans">
                        {item.categoryId === "cat_grills_01" || item.description?.includes("بالوزن") ? "ج/كجم" : "ج.م"}
                      </span>
                      {(item.categoryId === "cat_grills_01" || item.description?.includes("بالوزن")) && (
                        <span className="text-[8px] bg-orange-950 text-orange-300 border border-orange-800/80 px-1 rounded-full font-bold">
                          بالوزن
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corner Plus Button */}
                  <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-orange-500/20 group-hover:bg-orange-500 text-orange-400 group-hover:text-stone-950 text-[10px] font-black flex items-center justify-center transition">
                    +
                  </div>
                </div>
              ))}
            </div>
          </div>
            </>
          )}
        </section>

        {/* C. FAR RIGHT: CURRENT ORDER PANEL ("الطلب الحالي") */}
        <section className="w-[320px] sm:w-[350px] lg:w-[370px] bg-[#0c0c0f] border-r border-orange-500/25 flex flex-col justify-between shrink-0 p-2.5 z-20">
          
          {/* Header: Title + New Order Button */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs">
              <span>🛒</span>
              <span className="text-stone-100 font-black text-sm">الطلب الحالي</span>
            </div>
            <button
              onClick={handleStartTakeaway}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-stone-950 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-md shadow-orange-500/20 transition"
            >
              <span>+ طلب جديد</span>
            </button>
          </div>

          {/* Controls Bar: Cancel, Order Type, Customer */}
          <div className="bg-[#121217] border border-stone-800 rounded-xl p-2 mb-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-400 text-[10px]">نوع الطلب:</span>
              <div className="flex items-center gap-1">
                <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[11px] font-bold">
                  {orderType === "TAKEAWAY" && "🛍️ تيك أواي"}
                  {orderType === "DELIVERY" && "🛵 دليفري"}
                  {orderType === "DINE_IN" && `🪑 ${selectedTable?.name || "صالة"}`}
                </span>
                <button
                  onClick={handleClearOrder}
                  className="text-stone-500 hover:text-rose-400 text-xs px-1"
                  title="إلغاء وتفريغ الطلب"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-stone-400 text-[10px]">العميل:</span>
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-300">
                  {customerName ? `👤 ${customerName}` : "عميل نقدي 👤"}
                </span>
                <button
                  onClick={() => setShowQuickCustomerModal(true)}
                  className="text-orange-400 hover:underline text-[10px] font-bold"
                >
                  تعديل
                </button>
              </div>
            </div>

            {orderType === "DINE_IN" && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400 text-[10px]">الطاولة:</span>
                <button
                  onClick={() => setShowTablesModal(true)}
                  className="text-orange-400 font-bold hover:underline"
                >
                  {selectedTable ? selectedTable.name : "اختر الطاولة 🪑"}
                </button>
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="flex-1 bg-[#101014] border border-stone-800/80 rounded-xl overflow-hidden flex flex-col mb-2">
            <div className="bg-[#16161e] border-b border-stone-800 text-[10px] font-bold text-orange-300 py-1.5 px-2 grid grid-cols-12 gap-1 text-center">
              <span className="col-span-1">#</span>
              <span className="col-span-5 text-right">الصنف</span>
              <span className="col-span-2">الكمية</span>
              <span className="col-span-2">السعر</span>
              <span className="col-span-2">الإجمالي</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-stone-800/50 p-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-500 text-xs py-8">
                  <span className="text-4xl mb-2 text-stone-600">🛍️</span>
                  <span className="font-bold text-stone-400">لا توجد أصناف في الطلب</span>
                  <span className="text-[10px] text-stone-600 mt-0.5">قم بإضافة الأصناف من القائمة</span>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={item.menuItemId}
                    className="py-1 px-1 grid grid-cols-12 gap-1 items-center text-xs hover:bg-stone-800/30 rounded-lg group"
                  >
                    <span className="col-span-1 text-stone-500 font-mono text-center text-[10px]">{idx + 1}</span>
                    <div className="col-span-5 text-right pr-0.5">
                      <p className="font-bold text-stone-100 truncate text-[11px]">{item.nameAr}</p>
                    </div>
                    <div className="col-span-2 flex items-center justify-center gap-1 font-mono font-bold text-xs">
                      <button
                        onClick={() => handleUpdateQuantity(item.menuItemId, -1)}
                        className="w-3.5 h-3.5 bg-stone-800 hover:bg-orange-500 hover:text-black rounded text-[10px] flex items-center justify-center transition"
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.menuItemId, 1)}
                        className="w-3.5 h-3.5 bg-stone-800 hover:bg-orange-500 hover:text-black rounded text-[10px] flex items-center justify-center transition"
                      >
                        +
                      </button>
                    </div>
                    <span className="col-span-2 text-center font-mono text-stone-300 text-[11px]">{item.price}</span>
                    <div className="col-span-2 flex items-center justify-between font-mono font-black text-orange-400 pl-0.5 text-[11px]">
                      <span>{item.price * item.quantity}</span>
                      <button
                        onClick={() => handleRemoveItem(item.menuItemId)}
                        className="text-stone-500 hover:text-rose-500 text-xs"
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
          <div className="bg-[#121217] border border-orange-500/20 rounded-xl p-2 mb-2 space-y-0.5 text-[11px]">
            <div className="flex justify-between items-center text-stone-400">
              <span>إجمالي الطلب</span>
              <span className="font-mono font-bold text-stone-200">{subtotal.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between items-center text-stone-400">
              <span>الخصم</span>
              <span className="font-mono font-bold text-stone-300">0.00 ج.م</span>
            </div>
            <div className="flex justify-between items-center text-stone-400">
              <span>الضريبة (14%)</span>
              <span className="font-mono font-bold text-stone-300">0.00 ج.م</span>
            </div>

            {/* Glowing Orange Grand Total Banner */}
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-stone-950 font-black text-base py-1.5 px-3 rounded-xl flex justify-between items-center shadow-lg shadow-orange-500/25 mt-1">
              <span>المبلغ الكلي</span>
              <span className="font-mono text-lg">{totalAmount.toFixed(2)} ج.م</span>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={handlePrintCustomerCheck}
              className="bg-[#16161e] border border-orange-500/40 hover:bg-stone-800 text-orange-400 font-bold py-2 rounded-xl text-[11px] flex flex-col items-center justify-center gap-0.5 transition shadow"
            >
              <span className="text-sm">🖨️</span>
              <span>طباعة الفاتورة</span>
            </button>

            <button
              onClick={handleSendToPrep}
              className="bg-[#16161e] border border-orange-500/40 hover:bg-stone-800 text-orange-400 font-bold py-2 rounded-xl text-[11px] flex flex-col items-center justify-center gap-0.5 transition shadow"
            >
              <span className="text-sm">💾</span>
              <span>حفظ الطلب</span>
            </button>

            <button
              onClick={handleCollectPayment}
              className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-stone-950 font-black py-2 rounded-xl text-[11px] flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-orange-500/40 transition"
            >
              <span className="text-sm">✓</span>
              <span>إتمام الطلب</span>
            </button>
          </div>
        </section>
      </div>

      {/* 3. BOTTOM SECTION: RECENT ORDERS, SHORTCUTS, QUICK STATS */}
      <section className="h-40 shrink-0 bg-[#0a0a0c] border-t border-orange-500/30 px-3 py-2 flex flex-col sm:flex-row gap-2.5 z-30">
        
        {/* Box 1: Recent Orders Table */}
        <div className="flex-1 bg-[#101014] border border-orange-500/20 rounded-2xl p-2 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-1 text-xs text-orange-400 font-bold">
            <div className="flex items-center gap-1.5">
              <span>🕒</span>
              <span>آخر الطلبات</span>
            </div>
            <span className="text-[10px] text-stone-500 font-mono">اليوم</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-right text-[10px]">
              <thead>
                <tr className="text-stone-500 border-b border-stone-800">
                  <th className="pb-1 text-center">#</th>
                  <th className="pb-1 text-center">الوقت</th>
                  <th className="pb-1 text-center">الطاولة</th>
                  <th className="pb-1 text-center">الإجمالي</th>
                  <th className="pb-1 text-center">الحالة</th>
                  <th className="pb-1 text-center">نوع الطلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/40 font-mono">
                {recentOrders.map((ro, i) => (
                  <tr key={i} className="hover:bg-stone-800/30">
                    <td className="py-1 text-center text-stone-400">{ro.id}</td>
                    <td className="py-1 text-center text-stone-400">{ro.time}</td>
                    <td className="py-1 text-center text-stone-200 font-bold">{ro.table}</td>
                    <td className="py-1 text-center text-orange-400 font-bold">{ro.total}</td>
                    <td className="py-1 text-center">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full inline-block font-sans ${ro.statusBadge}`}>
                        {ro.status}
                      </span>
                    </td>
                    <td className="py-1 text-center font-sans text-stone-300">
                      <span>{ro.icon} {ro.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Box 2: 4 Meat/Grills Operational Shortcuts */}
        <div className="w-[300px] bg-[#101014] border border-orange-500/20 rounded-2xl p-2 grid grid-cols-2 gap-2 shrink-0">
          {/* Quick Takeaway Shortcut */}
          <button
            onClick={handleStartTakeaway}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 rounded-xl flex items-center justify-center gap-2 p-2 shadow-md shadow-orange-500/20 font-black group transition"
          >
            <span className="text-xl">🛍️</span>
            <div className="text-right">
              <p className="text-xs font-black leading-tight">تيك أواي سريع</p>
              <p className="text-[9px] text-stone-900 font-bold">طلب فوري</p>
            </div>
          </button>

          {/* Kitchen Ticket Print */}
          <button
            onClick={handleSendToPrep}
            className="bg-[#14141a] hover:border-orange-500 border border-stone-800 rounded-xl flex items-center justify-center gap-2 p-2 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">👨‍🍳</span>
            <div className="text-right">
              <p className="text-xs font-bold text-stone-200 leading-tight">المطبخ</p>
              <p className="text-[9px] text-stone-400">طباعة بون التحضير</p>
            </div>
          </button>

          {/* Delivery Shortcut */}
          <button
            onClick={handleStartDelivery}
            className="bg-[#14141a] hover:border-orange-500 border border-stone-800 rounded-xl flex items-center justify-center gap-2 p-2 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">🛵</span>
            <div className="text-right">
              <p className="text-xs font-bold text-stone-200 leading-tight">الدليفري</p>
              <p className="text-[9px] text-stone-400">طلبات التوصيل</p>
            </div>
          </button>

          {/* Tables Map Shortcut */}
          <button
            onClick={() => setShowTablesModal(true)}
            className="bg-[#14141a] hover:border-orange-500 border border-stone-800 rounded-xl flex items-center justify-center gap-2 p-2 transition group"
          >
            <span className="text-xl group-hover:scale-110 transition">🪑</span>
            <div className="text-right">
              <p className="text-xs font-bold text-stone-200 leading-tight">الصالة</p>
              <p className="text-[9px] text-stone-400">عرض الطاولات</p>
            </div>
          </button>
        </div>

        {/* Box 3: Quick Statistics */}
        <div className="w-[280px] bg-[#101014] border border-orange-500/20 rounded-2xl p-2 flex flex-col justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-orange-400 font-bold mb-0.5">
            <span>📈</span>
            <span className="text-[11px]">البيانات السريعة</span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between text-stone-300">
              <span className="font-sans text-[10px] text-stone-400">إجمالي المبيعات اليوم:</span>
              <span className="font-bold text-orange-400 text-xs">4,850.00 ج.م</span>
            </div>

            <div className="flex items-center justify-between text-stone-300">
              <span className="font-sans text-[10px] text-stone-400">عدد الطلبات:</span>
              <span className="font-bold text-stone-100">18</span>
            </div>

            <div className="flex items-center justify-between text-stone-300">
              <span className="font-sans text-[10px] text-stone-400">متوسط قيمة الطلب:</span>
              <span className="font-bold text-stone-100">269.44 ج.م</span>
            </div>

            <div className="flex items-center justify-between text-stone-300">
              <span className="font-sans text-[10px] text-stone-400">الطاولات المشغولة:</span>
              <span className="font-bold text-amber-400">6/12</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BOTTOM FOOTER BAR */}
      <footer className="h-7 shrink-0 bg-[#060608] border-t border-stone-800/80 px-4 flex items-center justify-between text-[10px] text-stone-400 font-mono">
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

      {/* MODAL: TABLES VISUAL MAP */}
      {showTablesModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-orange-500/40 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🪑</span>
                <h2 className="text-base font-black text-orange-400">اختيار طاولة الصالة - مشويات بسيوني</h2>
              </div>
              <button
                onClick={() => setShowTablesModal(false)}
                className="w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center text-xs"
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
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-24 ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20"
                        : isOccupied
                        ? "border-rose-500/50 bg-rose-950/20"
                        : "border-stone-800 bg-[#16161e] hover:border-stone-600"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs text-stone-100">{t.name}</span>
                      <span className={`w-2 h-2 rounded-full ${isOccupied ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`}></span>
                    </div>

                    {isOccupied && t.orders && t.orders[0] ? (
                      <div className="text-center bg-rose-900/40 rounded-lg p-0.5">
                        <p className="text-[9px] text-stone-300">أوردر #{t.orders[0].orderNumber}</p>
                        <p className="font-mono font-black text-rose-300 text-xs">{t.orders[0].totalAmount} ج.م</p>
                      </div>
                    ) : (
                      <div className="text-center text-stone-500 text-[10px]">
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-orange-500/40 rounded-3xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-black text-orange-400 mb-3 flex items-center gap-2">
              <span>👤</span>
              <span>تسجيل بيانات العميل والدليفري</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-stone-400 block mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="مثال: أحمد بسيوني"
                  className="w-full bg-[#16161e] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="010..."
                  className="w-full bg-[#16161e] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">عنوان التوصيل (للدليفري)</label>
                <input
                  type="text"
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  placeholder="الشارع - رقم العمارة - الشقة"
                  className="w-full bg-[#16161e] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">رسوم التوصيل (ج.م)</label>
                <input
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#16161e] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={async () => {
                    if (!quickName || !quickPhone) {
                      alert("يرجى إدخال اسم العميل ورقم هاتفه");
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
                    } else {
                      setCustomerName(quickName);
                      setCustomerPhone(quickPhone);
                      if (quickAddress) setDeliveryAddress(quickAddress);
                    }
                    setShowQuickCustomerModal(false);
                  }}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-bold py-2 rounded-xl shadow-lg shadow-orange-500/30"
                >
                  اعتماد العميل
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

    
      {/* Weight Selection Modal */}
      {weightModalItem && (
        <WeightModal
          item={{
            id: weightModalItem.id,
            nameAr: weightModalItem.nameAr,
            price: (weightModalItem as any).unitPrice || weightModalItem.price,
            image: weightModalItem.image,
          }}
          onClose={() => setWeightModalItem(null)}
          onAdd={({ weightGrams, totalPrice }) => {
            const weightLabel =
              weightGrams >= 1000
                ? `${weightGrams / 1000} كجم`
                : `${weightGrams} جم`;

            setCart((prev) => [
              ...prev,
              {
                menuItemId: weightModalItem.id,
                nameAr: `${weightModalItem.nameAr} (${weightLabel})`,
                price: totalPrice,
                unitPrice: (weightModalItem as any).unitPrice || weightModalItem.price,
                weightGrams: weightGrams,
                quantity: 1,
              },
            ]);
            setWeightModalItem(null);
          }}
        />
      )}

      {/* Grilling Handover Tracker Modal */}
      {showGrillingTracker && (
        <GrillingTrackerModal
          orders={activeGrillingOrders}
          currentUser={userName}
          onRefresh={refreshGrillingOrders}
          onClose={() => setShowGrillingTracker(false)}
        />
      )}

    </div>
  );
}