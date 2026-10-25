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
  triggerKitchenPrepPrint,
  buildZReportHtml,
  buildThermalReceiptHtml,
  silentPrintHtml,
} from "@/utils/printer/silent-print";
import WeightModal from "@/components/pos/weight-modal";
import CustomerGrillingForm from "@/components/pos/customer-grilling-form";
import GrillingTrackerModal from "@/components/pos/grilling-tracker-modal";
import { getGrillingRates, getActiveGrillingOrders } from "@/actions/grilling-service";
import { GrillingRates } from "@/lib/grilling-calculator";
import { buildGrillingKitchenTicketHtml, buildGrillingHandoverTicketHtml } from "@/utils/printer/silent-print";

// Real-time Database-driven catalog helpers
function getMenuItemImage(nameAr: string, categoryId?: string): string {
  const n = nameAr.toLowerCase();
  if (n.includes("كفتة")) return "/items/kofta.jpg";
  if (n.includes("طرب")) return "/items/tarb.jpg";
  if (n.includes("سجق")) return "/items/sogok.jpg";
  if (n.includes("شيش")) return "/items/shish_tawook.jpg";
  if (n.includes("مشكل") || n.includes("مكس") || n.includes("ميكس")) return "/items/mix_mashweyat.jpg";
  if (n.includes("فرخة") || n.includes("فراخ") || n.includes("دجاج")) return "/items/meal_rob_farkha.jpg";
  if (n.includes("صينية")) return "/items/tray_fahma.jpg";
  if (n.includes("وجبة")) return "/items/meal_shabaan.jpg";
  if (n.includes("سوري")) return "/items/fr_sogok.jpg";
  if (n.includes("فرنساوي")) return "/items/sandwich_fransawi.jpg";
  if (n.includes("ساندوتش")) return "/items/sandwich_fahm.jpg";
  if (n.includes("ممبار")) return "/items/mombar.jpg";
  if (n.includes("حمام")) return "/items/hamam.jpg";
  if (n.includes("كبدة")) return "/items/kebda.jpg";
  if (n.includes("كرشة") || n.includes("فشة") || n.includes("سقط")) return "/items/kawaresh.jpg";
  if (n.includes("بطاطس")) return "/items/roastbeef.jpg";
  if (n.includes("بيبسي") || n.includes("كانز") || n.includes("مياه")) return "/items/pane.jpg";
  return "/items/kofta.jpg";
}

function getCategoryThumbnail(nameAr: string): string {
  const n = nameAr.toLowerCase();
  if (n.includes("مشويات")) return "/items/mix_mashweyat.jpg";
  if (n.includes("سوري")) return "/items/fr_sogok.jpg";
  if (n.includes("فرنساوي")) return "/items/sandwich_fransawi.jpg";
  if (n.includes("ساندوتش") || n.includes("فحم")) return "/items/sandwich_fahm.jpg";
  if (n.includes("فراخ")) return "/items/meal_rob_farkha.jpg";
  if (n.includes("صواني")) return "/items/tray_fahma.jpg";
  if (n.includes("وجبات") || n.includes("عمالة")) return "/items/meal_shabaan.jpg";
  if (n.includes("مشروبات") || n.includes("إضافات")) return "/items/sogok.jpg";
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
  isWeighted?: boolean;
}

interface CartItem {
  menuItemId: string;
  nameAr: string;
  price: number;
  quantity: number;
  notes?: string;
  weightGrams?: number;
  rawWeightGrams?: number;
  pricePerKg?: number;
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
  const [activeFilter, setActiveFilter] = useState<"ALL" | "BEST_SELLER" | "OFFERS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | undefined>(undefined);
  const [orderNotes, setOrderNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  // Payment & Change Calculator State
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "WALLET">("CASH");
  const [amountPaidInput, setAmountPaidInput] = useState<string>("");
  const [lastCompletedReceipt, setLastCompletedReceipt] = useState<any>(null);
  const [draftNotice, setDraftNotice] = useState<boolean>(false);

  // Channels: TAKEAWAY (Default & Priority), DELIVERY, DINE_IN, CUSTOMER_GRILL
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
      (item as any).isWeighted ||
      cat === "cat_grills_01" ||
      item.description?.includes("بالوزن") ||
      (name.includes("مشوي") &&
        !name.includes("ساندوتش") &&
        !name.includes("فرنساوي") &&
        !name.includes("صينية"))
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
        nameAr: item.nameAr,
        price: totalPrice,
        quantity: 1,
        notes: notes ? `${notes} (${weightLabel})` : weightLabel,
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

      await silentPrintHtml(buildGrillingKitchenTicketHtml(basePrintOptions));
      await silentPrintHtml(buildGrillingHandoverTicketHtml(basePrintOptions));
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

  // System Lock State
  const [isSystemLocked, setIsSystemLocked] = useState<boolean>(initialSystemLocked);
  const [systemLockedBy, setSystemLockedBy] = useState<string | null>(initialLockedBy || null);
  const [systemLockedAt, setSystemLockedAt] = useState<string | null>(initialLockedAt || null);

  // Inactivity Auto-Lock
  const [isIdleLocked, setIsIdleLocked] = useState<boolean>(false);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState<string>("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityTimeRef.current = Date.now();
    };
    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("mousedown", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("touchstart", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity);

    const idleCheckInterval = setInterval(() => {
      const elapsedMs = Date.now() - lastActivityTimeRef.current;
      if (elapsedMs >= 5 * 60 * 1000 && !isIdleLocked) {
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
  }, [isIdleLocked]);

  // Draft Order Persistence & Recovery
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
    } catch (e) {}
  }, [cart, orderType, customerName, customerPhone, deliveryAddress, deliveryFee, orderNotes]);

  // Live Clock (Arabic format matching screenshot)
  const [currentDateTime, setCurrentDateTime] = useState({
    dateStr: "السبت 26 أبريل 2025",
    timeStr: "06:42 م",
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("ar-EG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const hours = now.getHours();
      const mins = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "م" : "ص";
      const h12 = hours % 12 || 12;
      const timeStr = `${ampm} ${String(h12).padStart(2, "0")}:${mins}`;
      setCurrentDateTime({ dateStr, timeStr });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Single Source of Truth Menu Items
  const allMenuItems = useMemo(() => {
    return menuItems.map((dbItem) => ({
      id: dbItem.id,
      nameAr: dbItem.nameAr,
      price: dbItem.price,
      categoryId: dbItem.categoryId,
      description: dbItem.description,
      image: (dbItem as any).imageUrl || dbItem.image || getMenuItemImage(dbItem.nameAr, dbItem.categoryId),
      isWeighted: isGrillItem(dbItem),
    }));
  }, [menuItems]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return allMenuItems.filter((item) => {
      const matchCat = selectedCategory === "ALL" || item.categoryId === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.nameAr.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q));

      if (activeFilter === "BEST_SELLER") {
        return matchCat && matchSearch && (item.isWeighted || item.nameAr.includes("كفتة") || item.nameAr.includes("سجق") || item.nameAr.includes("شيش"));
      }
      if (activeFilter === "OFFERS") {
        return matchCat && matchSearch && (item.categoryId === "cat_offers_01" || item.nameAr.includes("عرض") || item.nameAr.includes("وجبة"));
      }

      return matchCat && matchSearch;
    });
  }, [allMenuItems, selectedCategory, searchQuery, activeFilter]);

  // Start Takeaway
  const handleStartTakeaway = () => {
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }
    setOrderType("TAKEAWAY");
    setSelectedTable(null);
  };

  // Start Delivery
  const handleStartDelivery = () => {
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }
    setOrderType("DELIVERY");
    setSelectedTable(null);
    setShowQuickCustomerModal(true);
  };

  // Start Dine-In
  const handleStartDineIn = () => {
    if (isSystemLocked) {
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }
    setOrderType("DINE_IN");
    setShowTablesModal(true);
  };

  // Select Table
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
      alert("النظام مقفول حالياً بواسطة الإدارة");
      return;
    }

    if (item.isWeighted) {
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
      setAmountPaidInput("");
      setDraftNotice(false);
      try {
        localStorage.removeItem("basiony_pos_active_cart");
      } catch (e) {}
    }
  };

  // Unlock Inactivity Idle Screen
  const handleUnlockIdleScreen = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
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

  // Cash Change Calculation
  const parsedAmountPaid = parseFloat(amountPaidInput) || 0;
  const changeDue = paymentMethod === "CASH" && parsedAmountPaid > totalAmount ? parsedAmountPaid - totalAmount : 0;

  // Send Order to Prep (Kitchen Ticket - Zero financial details)
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

      await triggerKitchenPrepPrint({
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
    });
  };

  // Reprint Last Completed Receipt
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

  const cartTotalItemsCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0b0f19] text-stone-100 select-none font-sans relative" dir="rtl">
      
      {/* 1. TOP HEADER (Exact match to reference) */}
      <header className="h-16 shrink-0 bg-[#0c101d] border-b border-[#1c2438] px-4 flex items-center justify-between relative z-30 shadow-2xl">
        
        {/* Right side in RTL: Brand Logo, Slogan, Date/Time, Cashier */}
        <div className="flex items-center gap-4 lg:gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-tr from-amber-600 to-orange-500 shadow-md shadow-orange-600/30 text-2xl">
              🔥
            </div>
            <div>
              <h1 className="text-xl font-black text-amber-500 leading-none tracking-tight">
                مشويات بسيوني
              </h1>
              <p className="text-[9px] font-mono font-bold tracking-wider text-stone-400 uppercase mt-0.5">
                MASHWEYAT BASIONY
              </p>
            </div>
          </div>

          {/* Slogan */}
          <div className="hidden xl:block">
            <span className="text-xs font-bold text-amber-300/80 tracking-wide border-r border-stone-800 pr-4">
              طعم زمان على أصوله
            </span>
          </div>

          {/* Date & Time */}
          <div className="hidden md:flex items-center gap-3 bg-[#111624] border border-[#1e2638] rounded-xl px-3 py-1.5 text-xs text-stone-300 font-mono">
            <div className="flex items-center gap-1.5 text-stone-300 font-bold">
              <span>📅</span>
              <span>{currentDateTime.dateStr}</span>
            </div>
            <div className="w-px h-3 bg-stone-700"></div>
            <div className="flex items-center gap-1.5 text-amber-400 font-black">
              <span>⏰</span>
              <span>{currentDateTime.timeStr}</span>
            </div>
          </div>

          {/* Cashier Badge */}
          <div className="flex items-center gap-2 bg-[#111624] border border-[#1e2638] rounded-xl px-3 py-1 text-xs">
            <span className="text-stone-300 text-sm">👤</span>
            <div className="text-right">
              <p className="font-bold text-stone-100 text-[11px] leading-tight">{userName || "أحمد محمد"}</p>
              <p className="text-[9px] text-stone-400 font-semibold">كاشير</p>
            </div>
          </div>
        </div>

        {/* Left side in RTL: 4 Order Channel Buttons */}
        <div className="flex items-center gap-2">
          {/* 1. CUSTOMER GRILL (Special Golden Filled Button) */}
          <button
            onClick={() => {
              setOrderType("CUSTOMER_GRILL");
              setSelectedTable(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition font-black text-xs shadow-md ${
              orderType === "CUSTOMER_GRILL"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 shadow-orange-500/30 border-2 border-amber-300 scale-105"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30"
            }`}
          >
            <span className="text-base">🔥</span>
            <div className="text-right">
              <p className="leading-tight font-black">شوي للغير</p>
              <p className="text-[9px] opacity-80">خامة العميل</p>
            </div>
          </button>

          {/* 2. DINE-IN (HALL) */}
          <button
            onClick={handleStartDineIn}
            className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition font-bold text-xs border ${
              orderType === "DINE_IN"
                ? "bg-[#182033] border-amber-500 text-amber-400 shadow-md font-black"
                : "bg-[#111624] border-[#1e2638] text-stone-300 hover:border-stone-600 hover:text-white"
            }`}
          >
            <span className="text-base text-sky-400">🪑</span>
            <div className="text-right">
              <p className="leading-tight">الصالة</p>
              <p className="text-[9px] text-stone-400 truncate max-w-[70px]">
                {selectedTable ? selectedTable.name : "طاولة"}
              </p>
            </div>
          </button>

          {/* 3. DELIVERY */}
          <button
            onClick={handleStartDelivery}
            className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition font-bold text-xs border ${
              orderType === "DELIVERY"
                ? "bg-[#182033] border-amber-500 text-amber-400 shadow-md font-black"
                : "bg-[#111624] border-[#1e2638] text-stone-300 hover:border-stone-600 hover:text-white"
            }`}
          >
            <span className="text-base text-teal-400">🛵</span>
            <div className="text-right">
              <p className="leading-tight">دليفري</p>
              <p className="text-[9px] text-stone-400">توصيل</p>
            </div>
          </button>

          {/* 4. TAKEAWAY */}
          <button
            onClick={handleStartTakeaway}
            className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition font-bold text-xs border ${
              orderType === "TAKEAWAY"
                ? "bg-[#182033] border-amber-500 text-amber-400 shadow-md font-black"
                : "bg-[#111624] border-[#1e2638] text-stone-300 hover:border-stone-600 hover:text-white"
            }`}
          >
            <span className="text-base text-amber-400">🛍️</span>
            <div className="text-right">
              <p className="leading-tight">تيك أواي</p>
              <p className="text-[9px] text-stone-400">سفري</p>
            </div>
          </button>

          {/* Logout shortcut */}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 rounded-xl bg-[#111624] border border-[#1e2638] hover:border-rose-500 text-stone-400 hover:text-rose-400 text-xs transition mr-1"
            title="تسجيل الخروج"
          >
            🚪
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE (Left: Cart, Right: Menu & Food Cards) */}
      <div className="flex-1 flex overflow-hidden bg-[#090d16]">
        
        {/* LEFT COLUMN: CURRENT ORDER PANEL ("الطلب الحالي") */}
        <section className="w-[340px] sm:w-[360px] lg:w-[380px] bg-[#0c101c] border-l border-[#1c2438] flex flex-col justify-between shrink-0 p-3 z-20">
          
          {/* Header of Cart */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1c2438]">
            <div className="flex items-center gap-2 text-white font-black text-sm">
              <span className="text-amber-400 text-base">🛒</span>
              <span>الطلب الحالي</span>
            </div>
            <div className="bg-sky-500/20 text-sky-400 border border-sky-500/40 rounded-lg px-2.5 py-0.5 text-xs font-mono font-black">
              #{activeOrderId ? activeOrderId.slice(-4) : "1258"}
            </div>
          </div>

          {/* Draft Notice Banner */}
          {draftNotice && cart.length > 0 && (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl px-2.5 py-1 mt-2 flex items-center justify-between text-[11px] text-amber-300">
              <div className="flex items-center gap-1.5">
                <span>⚡</span>
                <span className="font-bold">مسودة الطلب محفوظة ومسترجعة</span>
              </div>
              <button
                onClick={() => setDraftNotice(false)}
                className="text-stone-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-0.5">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 text-xs py-12">
                <span className="text-4xl mb-2 text-stone-600">🛍️</span>
                <span className="font-bold text-stone-400">لا توجد أصناف في الطلب</span>
                <span className="text-[10px] text-stone-600 mt-1">اضغط على أي صنف لإضافته مباشرة</span>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.menuItemId}
                  className="bg-[#111726] border border-[#1e263d] rounded-xl p-2.5 flex items-center gap-2.5 transition group hover:border-[#2a3654]"
                >
                  {/* Dish Thumbnail */}
                  <img
                    src={getMenuItemImage(item.nameAr)}
                    alt={item.nameAr}
                    className="w-12 h-12 rounded-lg object-cover bg-stone-900 shrink-0 border border-stone-800"
                  />

                  {/* Name and Stepper Controls */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-white truncate leading-tight">
                      {item.nameAr}
                    </p>
                    {item.notes && (
                      <p className="text-[10px] text-stone-400 truncate mt-0.5 font-medium">
                        {item.notes}
                      </p>
                    )}

                    {/* Stepper +/- */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button
                        onClick={() => handleUpdateQuantity(item.menuItemId, -1)}
                        className="w-5 h-5 rounded bg-stone-800 hover:bg-amber-500 hover:text-black text-stone-300 text-xs flex items-center justify-center font-bold transition"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-mono font-bold text-xs text-stone-100">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.menuItemId, 1)}
                        className="w-5 h-5 rounded bg-stone-800 hover:bg-amber-500 hover:text-black text-stone-300 text-xs flex items-center justify-center font-bold transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Price & Delete */}
                  <div className="flex flex-col items-end justify-between h-12 shrink-0">
                    <span className="font-mono font-black text-xs text-amber-400">
                      {(item.price * item.quantity).toFixed(2)} ج.م
                    </span>
                    <button
                      onClick={() => handleRemoveItem(item.menuItemId)}
                      className="text-stone-500 hover:text-rose-400 text-xs p-0.5 transition"
                      title="حذف الصنف"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Financial Totals Block */}
          <div className="pt-2 border-t border-[#1c2438] space-y-1">
            <div className="flex justify-between items-center text-xs text-stone-400 font-bold">
              <span>إجمالي الأصناف ({cartTotalItemsCount})</span>
              <span className="font-mono text-stone-300">{subtotal.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between items-center text-sm font-black text-stone-100">
              <span>إجمالي الطلب</span>
              <span className="font-mono text-lg text-amber-400">{totalAmount.toFixed(2)} ج.م</span>
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div className="mt-2.5 pt-2 border-t border-[#1c2438]">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`py-2 px-1 rounded-xl text-center font-bold text-xs transition flex flex-col items-center justify-center gap-1 border ${
                  paymentMethod === "CASH"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300 font-black shadow-md shadow-amber-500/20"
                    : "bg-[#111624] border-[#1e2638] text-stone-300 hover:border-stone-700"
                }`}
              >
                <span className="text-sm">💵</span>
                <span>نقدي</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("CARD")}
                className={`py-2 px-1 rounded-xl text-center font-bold text-xs transition flex flex-col items-center justify-center gap-1 border ${
                  paymentMethod === "CARD"
                    ? "bg-sky-500/20 border-sky-500 text-sky-300 font-black shadow-md shadow-sky-500/20"
                    : "bg-[#111624] border-[#1e2638] text-stone-300 hover:border-stone-700"
                }`}
              >
                <span className="text-sm">💳</span>
                <span>بطاقة</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("WALLET")}
                className={`py-2 px-1 rounded-xl text-center font-bold text-xs transition flex flex-col items-center justify-center gap-1 border ${
                  paymentMethod === "WALLET"
                    ? "bg-purple-500/20 border-purple-500 text-purple-300 font-black shadow-md shadow-purple-500/20"
                    : "bg-[#111624] border-[#1e2638] text-stone-300 hover:border-stone-700"
                }`}
              >
                <span className="text-sm">📱</span>
                <span>دفع إلكتروني</span>
              </button>
            </div>

            {/* Cash Input & Change */}
            {paymentMethod === "CASH" && (
              <div className="mt-2 bg-[#111624] border border-[#1e2638] rounded-xl p-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-stone-400 font-bold shrink-0">
                    <span>🧮</span>
                    <span>المبلغ المدفوع</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    placeholder={totalAmount > 0 ? String(totalAmount) : "0"}
                    className="w-24 bg-[#182033] border border-amber-500/50 focus:border-amber-400 text-amber-300 text-left font-mono font-black text-sm rounded-lg px-2 py-1 outline-none"
                  />
                </div>

                {/* Quick cash increments */}
                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setAmountPaidInput(totalAmount.toString())}
                    className="bg-[#182033] hover:bg-amber-600/30 text-stone-300 text-[10px] font-bold py-0.5 rounded border border-stone-800 transition"
                  >
                    بالضبط
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = Math.ceil(totalAmount / 50) * 50;
                      setAmountPaidInput((base === totalAmount ? base + 50 : base).toString());
                    }}
                    className="bg-[#182033] hover:bg-amber-600/30 text-stone-300 text-[10px] font-bold py-0.5 rounded border border-stone-800 transition"
                  >
                    +50
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = Math.ceil(totalAmount / 100) * 100;
                      setAmountPaidInput((base === totalAmount ? base + 100 : base).toString());
                    }}
                    className="bg-[#182033] hover:bg-amber-600/30 text-stone-300 text-[10px] font-bold py-0.5 rounded border border-stone-800 transition"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = Math.ceil(totalAmount / 200) * 200;
                      setAmountPaidInput((base === totalAmount ? base + 200 : base).toString());
                    }}
                    className="bg-[#182033] hover:bg-amber-600/30 text-stone-300 text-[10px] font-bold py-0.5 rounded border border-stone-800 transition"
                  >
                    +200
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-stone-800">
                  <span className="text-stone-300 font-bold">الباقي:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {changeDue.toFixed(2)} ج.م
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons Row: Cancel + Print Check */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={handleClearOrder}
              className="bg-rose-950/50 hover:bg-rose-900/80 border border-rose-600/50 text-rose-300 font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow"
            >
              <span>🗑️</span>
              <span>إلغاء الطلب</span>
            </button>

            <button
              onClick={handlePrintCustomerCheck}
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow shadow-sky-600/20"
            >
              <span>🖨️</span>
              <span>طباعة الفاتورة</span>
            </button>
          </div>

          {/* Big Green Checkout Button */}
          <button
            onClick={handleCollectPayment}
            disabled={isPending}
            className="w-full mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-[0.99]"
          >
            <span className="text-base font-black">✓</span>
            <span>إتمام الطلب</span>
          </button>

          {/* Reprint Last Receipt Button */}
          <button
            type="button"
            onClick={handleReprintLastReceipt}
            disabled={!lastCompletedReceipt}
            className={`w-full mt-1.5 py-1 text-[11px] font-bold flex items-center justify-center gap-1 transition rounded-lg border ${
              lastCompletedReceipt
                ? "text-amber-400/90 hover:text-amber-300 border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5"
                : "text-stone-600 border-stone-800/40 cursor-not-allowed"
            }`}
            title="إعادة طباعة آخر فاتورة تم إتمامها كنسخة طبق الأصل"
          >
            <span>🔄</span>
            <span>إعادة طباعة آخر فاتورة</span>
          </button>
        </section>

        {/* RIGHT AREA: MENU CATEGORIES, SEARCH, FOOD GRID, BOTTOM BAR */}
        <section className="flex-1 flex flex-col overflow-hidden p-3 bg-[#090d16]">
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
              {/* 1. Horizontal Categories Bar */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none shrink-0">
                <button
                  onClick={() => setSelectedCategory("ALL")}
                  className={`min-w-[90px] h-[76px] flex flex-col items-center justify-center p-2 rounded-2xl border transition-all shrink-0 ${
                    selectedCategory === "ALL"
                      ? "bg-[#182033] border-2 border-amber-500 shadow-lg shadow-amber-500/20 text-white font-black scale-102"
                      : "bg-[#111624] border-[#1e2638] text-stone-300 hover:border-stone-600 hover:text-white"
                  }`}
                >
                  <span className="text-2xl mb-1">🍽️</span>
                  <span className="text-[11px] font-bold">الكل ({allMenuItems.length})</span>
                </button>

                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const icon = getCategoryIcon(cat.nameAr);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`min-w-[105px] h-[76px] flex flex-col items-center justify-center p-1.5 rounded-2xl border transition-all shrink-0 ${
                        isSelected
                          ? "bg-[#182033] border-2 border-amber-500 shadow-lg shadow-amber-500/20 text-white font-black scale-102"
                          : "bg-[#111624] border-[#1e2638] text-stone-300 hover:border-stone-600 hover:text-white"
                      }`}
                    >
                      <span className="text-2xl mb-1">{icon}</span>
                      <span className="text-[11px] font-bold text-center truncate max-w-[95px] leading-tight">
                        {cat.nameAr}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 2. Search & Filter Bar */}
              <div className="flex items-center gap-2.5 my-2 shrink-0">
                <div className="relative flex-1 bg-[#111624] border border-[#1e2638] focus-within:border-amber-500 rounded-xl px-3 py-2 flex items-center gap-2 transition">
                  <span className="text-stone-400 text-sm">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن صنف..."
                    className="bg-transparent text-xs text-white placeholder-stone-500 outline-none w-full font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-stone-500 hover:text-white text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter 1: Best Seller */}
                <button
                  onClick={() => setActiveFilter(activeFilter === "BEST_SELLER" ? "ALL" : "BEST_SELLER")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                    activeFilter === "BEST_SELLER"
                      ? "border-amber-500 bg-amber-500/20 text-amber-300 font-black shadow-md shadow-amber-500/20"
                      : "border-[#1e2638] bg-[#111624] text-stone-300 hover:border-amber-500/50"
                  }`}
                >
                  <span className="text-amber-400">⭐</span>
                  <span>الأكثر مبيعاً</span>
                </button>

                {/* Filter 2: Offers */}
                <button
                  onClick={() => setActiveFilter(activeFilter === "OFFERS" ? "ALL" : "OFFERS")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                    activeFilter === "OFFERS"
                      ? "border-orange-500 bg-orange-500/20 text-orange-300 font-black shadow-md shadow-orange-500/20"
                      : "border-[#1e2638] bg-[#111624] text-stone-300 hover:border-orange-500/50"
                  }`}
                >
                  <span className="text-orange-400">🔥</span>
                  <span>عروض خاصة</span>
                </button>
              </div>

              {/* 3. High Quality 5-Column Food Grid (Exact to Reference Picture) */}
              <div className="flex-1 overflow-y-auto pr-0.5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleAddToCart(item)}
                      className="bg-[#111624] border border-[#1e2638] hover:border-amber-500 rounded-2xl overflow-hidden cursor-pointer group transition-all duration-150 flex flex-col shadow-md relative hover:shadow-amber-500/10"
                    >
                      {/* Dish Image */}
                      <div className="h-28 sm:h-32 w-full bg-stone-900 overflow-hidden relative">
                        <img
                          src={item.image}
                          alt={item.nameAr}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Weighted Badge */}
                        {item.isWeighted && (
                          <div className="absolute top-2 right-2 bg-amber-500 text-stone-950 font-black text-[10px] px-2 py-0.5 rounded shadow">
                            بالوزن
                          </div>
                        )}
                      </div>

                      {/* Details: Name & Price */}
                      <div className="p-2 text-center flex flex-col justify-between flex-1">
                        <h3 className="font-bold text-xs text-stone-100 truncate group-hover:text-amber-400 transition leading-snug">
                          {item.nameAr}
                        </h3>
                        <p className="font-mono font-black text-xs text-amber-400 mt-1">
                          {item.isWeighted ? `${item.price} ج.م / كيلو` : `${item.price} ج.م`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Bottom Action Bar (Recall, Tracking, Refresh, Help) */}
              <div className="h-11 shrink-0 border-t border-[#1c2438] mt-2 pt-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTablesModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#111624] border border-[#1e2638] hover:border-stone-600 text-stone-300 font-bold flex items-center gap-1.5 transition"
                  >
                    <span>🔔</span>
                    <span>إستدعاء الطلب</span>
                  </button>

                  <button
                    onClick={() => setShowGrillingTracker(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#111624] border border-[#1e2638] hover:border-stone-600 text-stone-300 font-bold flex items-center gap-1.5 transition"
                  >
                    <span>📋</span>
                    <span>متابعة الطلبات</span>
                    {activeGrillingOrders.length > 0 && (
                      <span className="bg-amber-500 text-stone-950 px-1.5 py-0.2 rounded-full font-black text-[10px]">
                        {activeGrillingOrders.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 rounded-xl bg-[#111624] border border-[#1e2638] hover:border-stone-600 text-stone-300 font-bold flex items-center gap-1.5 transition"
                  >
                    <span>🔄</span>
                    <span>تحديث المنيو</span>
                  </button>
                </div>

                <div className="text-[11px] text-stone-500 hidden sm:flex items-center gap-1 font-medium">
                  <span>ℹ️</span>
                  <span>لأي استفسار أو مساعدة تواصل مع المدير</span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

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
              تم تعليق جميع عمليات البيع مؤقتاً بأمر الإدارة.
            </p>
          </div>
        </div>
      )}

      {/* INACTIVITY IDLE SCREEN LOCK OVERLAY */}
      {isIdleLocked && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-lg z-40 flex items-center justify-center p-6 text-center">
          <div className="bg-[#121217] border border-amber-500/40 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-amber-950/40 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-3xl shadow">
              ⏳
            </div>
            <h2 className="text-xl font-black text-amber-400">
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
                className="w-full bg-[#181822] border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-stone-100 text-center text-sm outline-none font-mono"
                autoFocus
              />

              {unlockError && (
                <p className="text-rose-400 text-xs font-bold">{unlockError}</p>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-black py-2.5 rounded-xl text-sm transition shadow-lg shadow-amber-500/20"
              >
                إلغاء القفل والمتابعة
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TABLES VISUAL MAP */}
      {showTablesModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111116] border border-amber-500/40 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🪑</span>
                <h2 className="text-base font-black text-amber-400">اختيار طاولة الصالة - مشويات بسيوني</h2>
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
                        ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20"
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
          <div className="bg-[#111116] border border-amber-500/40 rounded-3xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-black text-amber-400 mb-3 flex items-center gap-2">
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
                  className="w-full bg-[#16161e] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="010..."
                  className="w-full bg-[#16161e] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">عنوان التوصيل (للدليفري)</label>
                <input
                  type="text"
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  placeholder="الشارع - رقم العمارة - الشقة"
                  className="w-full bg-[#16161e] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-stone-400 block mb-1">رسوم التوصيل (ج.م)</label>
                <input
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#16161e] border border-stone-800 rounded-xl px-3 py-2 text-stone-100 outline-none focus:border-amber-500 font-mono"
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
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold py-2 rounded-xl shadow-lg shadow-amber-500/30"
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

      {/* MODAL: WEIGHT SELECTION */}
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
            handleAddWeightedItem({
              item: weightModalItem,
              weightGrams,
              totalPrice,
            });
            setWeightModalItem(null);
          }}
        />
      )}

      {/* MODAL: GRILLING HANDOVER TRACKER */}
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
