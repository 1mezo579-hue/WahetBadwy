"use client";

import { useState } from "react";
import { GrillingRates } from "@/lib/grilling-calculator";

interface AddonItem {
  id: string;
  nameAr: string;
  price: number;
  quantity: number;
}

const DEFAULT_ADDONS: AddonItem[] = [
  { id: "addon_tahina", nameAr: "طحينة سمسم بلدي مخصوص", price: 10, quantity: 0 },
  { id: "addon_salad", nameAr: "سلطة بلدي خضراء طازة", price: 10, quantity: 0 },
  { id: "addon_bread", nameAr: "خبز بلدي طازج (5 أرغفة)", price: 10, quantity: 0 },
  { id: "addon_rice", nameAr: "طبق أرز بسمتي بالخلطة", price: 35, quantity: 0 },
  { id: "addon_pepsi", nameAr: "مشروب كانز بارد", price: 15, quantity: 0 },
  { id: "addon_packing", nameAr: "خدمة تغليف وسرفيس حراري فاخر", price: 15, quantity: 0 },
];

const MEAT_TYPES = [
  "لحم بلدي كندوز",
  "لحم ضاني / ريش بلدي",
  "كفتة مجهزة من العميل",
  "فراخ بيضاء كاملة",
  "شيش طاووق ووراك",
  "بط / حمام بلدي",
  "سجق بلدي مجهز",
  "صنف آخر",
];

interface CustomerGrillingFormProps {
  rates: GrillingRates;
  cashierName: string;
  onSubmit: (params: {
    customerName: string;
    customerPhone: string;
    meatType: string;
    rawWeightGrams: number;
    pieceCount?: number;
    pricingMode: "PER_KG" | "PER_PIECE" | "FIXED";
    customRate?: number;
    grillingFee: number;
    expectedPickupTime: string;
    notes: string;
    addons: AddonItem[];
    actionType: "PREP" | "PAY";
  }) => void;
  isSubmitting?: boolean;
  onOpenTracker: () => void;
}

export default function CustomerGrillingForm({
  rates,
  cashierName,
  onSubmit,
  isSubmitting = false,
  onOpenTracker,
}: CustomerGrillingFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [meatType, setMeatType] = useState(MEAT_TYPES[0]);
  const [customMeatType, setCustomMeatType] = useState("");
  const [rawWeightGrams, setRawWeightGrams] = useState<number>(1000);
  const [pieceCount, setPieceCount] = useState<number>(0);
  const [pricingMode, setPricingMode] = useState<"PER_KG" | "PER_PIECE" | "FIXED">("PER_KG");
  const [customRate, setCustomRate] = useState<string>("");
  const [expectedPickupTime, setExpectedPickupTime] = useState("");
  const [notes, setNotes] = useState("");
  const [addons, setAddons] = useState<AddonItem[]>(DEFAULT_ADDONS);

  // Compute Active Meat Name
  const activeMeatName = meatType === "صنف آخر" && customMeatType.trim() ? customMeatType.trim() : meatType;

  // Compute Grilling Fee
  let calculatedGrillingFee = 0;
  const isChicken = activeMeatName.includes("فراخ") || activeMeatName.includes("دجاج") || activeMeatName.includes("شيش");

  if (pricingMode === "FIXED") {
    calculatedGrillingFee = customRate && Number(customRate) > 0 ? Number(customRate) : rates.fixedServiceFee;
  } else if (pricingMode === "PER_PIECE") {
    const ratePerPc = customRate && Number(customRate) > 0 ? Number(customRate) : rates.chickenPricePerPiece;
    calculatedGrillingFee = Math.max(1, pieceCount) * ratePerPc;
  } else {
    // PER_KG
    const defaultRate = isChicken ? rates.chickenPricePerKg : rates.meatPricePerKg;
    const ratePerKg = customRate && Number(customRate) > 0 ? Number(customRate) : defaultRate;
    calculatedGrillingFee = Math.round(((rawWeightGrams / 1000) * ratePerKg) * 100) / 100;
  }

  // Compute Addons Total
  const selectedAddons = addons.filter((a) => a.quantity > 0);
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price * a.quantity, 0);

  // Bill Total (Customer Meat is strictly 0.00!)
  const billTotal = calculatedGrillingFee + addonsTotal;

  const handleQuickAddWeight = (deltaGrams: number) => {
    setRawWeightGrams((prev) => Math.max(100, (prev || 0) + deltaGrams));
  };

  const handleUpdateAddonQty = (id: string, delta: number) => {
    setAddons((prev) =>
      prev.map((a) => (a.id === id ? { ...a, quantity: Math.max(0, a.quantity + delta) } : a))
    );
  };

  const handleFormSubmit = (actionType: "PREP" | "PAY") => {
    if (!customerName.trim()) {
      alert("يرجى إدخال اسم العميل");
      return;
    }
    if (!customerPhone.trim()) {
      alert("يرجى إدخال رقم هاتف العميل للتواصل والاستلام");
      return;
    }
    if (rawWeightGrams <= 0 && pricingMode !== "PER_PIECE") {
      alert("يرجى إدخال وزن صالح بالجرام");
      return;
    }

    onSubmit({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      meatType: activeMeatName,
      rawWeightGrams,
      pieceCount: pieceCount > 0 ? pieceCount : undefined,
      pricingMode,
      customRate: customRate && Number(customRate) > 0 ? Number(customRate) : undefined,
      grillingFee: calculatedGrillingFee,
      expectedPickupTime: expectedPickupTime.trim() || "خلال 60 دقيقة",
      notes: notes.trim(),
      addons: selectedAddons,
      actionType,
    });
  };

  return (
    <div className="flex-1 bg-[#09090b] flex flex-col overflow-y-auto p-3 space-y-4" dir="rtl">
      
      {/* Top Banner & Tracker Shortcut */}
      <div className="bg-gradient-to-r from-orange-950/80 via-stone-900 to-amber-950/60 p-4 rounded-3xl border border-orange-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-stone-950 flex items-center justify-center text-2xl font-black shadow-md shadow-orange-500/30">
            🔥
          </div>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              خدمة شوي للغير — خامات العميل
              <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-full font-mono">
                عزل مخزني ومالي تام
              </span>
            </h2>
            <p className="text-xs text-stone-300">
              تسجيل واستلام لحوم وفراخ الزبائن للشوي على فحم مشويات بسيوني بالأصول
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenTracker}
          className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-orange-400 border border-orange-500/40 font-bold text-xs flex items-center gap-2 transition"
        >
          <span>📋</span>
          <span>لوحة متابعة الشوي والتسليم</span>
        </button>
      </div>

      {/* Strict Anti-Fraud Notice */}
      <div className="bg-amber-950/30 border border-amber-500/40 p-3 rounded-2xl text-xs text-amber-200 flex items-center gap-2.5">
        <span className="text-xl">⚠️</span>
        <div>
          <strong className="text-amber-400">قاعدة النظام الحديدية:</strong> خامات العميل (اللحوم والفراخ) ملك للعميل ولا تُخصم إطلاقاً من مخزون المطعم ولا تُحتسب في قيمة مبيعات اللحوم. الفاتورة تشمل فقط <strong>رسوم خدمة الشوي والإضافات المختارة</strong>.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Section 1: Customer & Raw Meat Details */}
        <div className="bg-[#121217] border border-orange-500/25 p-4 rounded-2xl space-y-3.5">
          <h3 className="text-xs font-black text-orange-400 border-b border-stone-800 pb-2 flex items-center gap-1.5">
            <span>👤</span>
            <span>1. بيانات العميل والاستلام:</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-300 mb-1">اسم العميل *</label>
              <input
                type="text"
                placeholder="أ/ محمد، الحاج إبراهيم..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 text-white font-bold text-xs px-3 py-2 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-300 mb-1">رقم الهاتف *</label>
              <input
                type="tel"
                placeholder="01012345678"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 text-white font-mono font-bold text-xs px-3 py-2 rounded-xl outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-300 mb-1.5">نوع الخامة المستلمة من العميل:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {MEAT_TYPES.map((type) => {
                const isSelected = meatType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMeatType(type)}
                    className={`p-2 rounded-xl border text-[11px] font-bold text-center transition ${
                      isSelected
                        ? "bg-orange-500 text-stone-950 border-orange-400 font-black shadow-sm"
                        : "bg-stone-950 text-stone-300 border-stone-800 hover:border-orange-500/40"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            {meatType === "صنف آخر" && (
              <input
                type="text"
                placeholder="اكتب نوع الصنف هنا (مثلاً: أرانب، كوارع، ريش بتلو...)"
                value={customMeatType}
                onChange={(e) => setCustomMeatType(e.target.value)}
                className="w-full mt-2 bg-stone-950 border border-orange-500/40 text-white text-xs px-3 py-2 rounded-xl outline-none"
              />
            )}
          </div>

          {/* Raw Received Weight */}
          <div className="bg-stone-950 p-3 rounded-2xl border border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-stone-200">الوزن النيء المستلم (بالجرام):</label>
              <span className="text-xs font-mono font-black text-amber-400">
                {rawWeightGrams} جم ({(rawWeightGrams / 1000).toFixed(2)} كجم)
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="100"
                step="50"
                value={rawWeightGrams || ""}
                onChange={(e) => setRawWeightGrams(Number(e.target.value) || 0)}
                className="flex-1 bg-[#121217] border border-orange-500/40 text-white font-mono font-bold text-sm px-3 py-2 rounded-xl outline-none"
              />
              <span className="text-xs text-stone-400 font-bold">جرام</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-stone-500 font-bold ml-1">إضافة سريعة:</span>
              {[250, 500, 1000, 2000, 3000].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => handleQuickAddWeight(delta)}
                  className="px-2 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 text-[10px] font-mono font-bold rounded-lg transition"
                >
                  +{delta} جم
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRawWeightGrams(1000)}
                className="px-2 py-1 bg-orange-950/40 border border-orange-500/30 text-orange-400 text-[10px] font-bold rounded-lg"
              >
                1 كجم
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-300 mb-1">عدد القطع (اختياري - مثلاً عدد الفراخ):</label>
              <input
                type="number"
                min="0"
                placeholder="مثلاً: 2 فرخة"
                value={pieceCount || ""}
                onChange={(e) => setPieceCount(Number(e.target.value) || 0)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 text-white font-mono text-xs px-3 py-2 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-300 mb-1">موعد التسليم المتوقع للعميل:</label>
              <input
                type="text"
                placeholder="مثلاً: 04:30 م أو بعد ساعة"
                value={expectedPickupTime}
                onChange={(e) => setExpectedPickupTime(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 text-white text-xs px-3 py-2 rounded-xl outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-300 mb-1">تعليمات الشوي والتتبيل الخاصة بالزبون:</label>
            <input
              type="text"
              placeholder="مثال: تسوية وسط، بهارات خفيفة، بدون بصل، تقسيم الفرخة 4 أرباع..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 text-white text-xs px-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        {/* Section 2: Pricing, Add-ons & Bill Summary */}
        <div className="bg-[#121217] border border-orange-500/25 p-4 rounded-2xl space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3.5">
            <h3 className="text-xs font-black text-orange-400 border-b border-stone-800 pb-2 flex items-center gap-1.5">
              <span>💰</span>
              <span>2. طريقة تسعير الشوي والإضافات:</span>
            </h3>

            {/* Pricing Mode Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPricingMode("PER_KG")}
                className={`p-2 rounded-xl border text-center transition ${
                  pricingMode === "PER_KG"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black border-orange-400"
                    : "bg-stone-950 text-stone-300 border-stone-800"
                }`}
              >
                <div className="text-xs">بالوزن النيء</div>
                <div className="text-[10px] font-mono opacity-80">
                  {isChicken ? rates.chickenPricePerKg : rates.meatPricePerKg} ج.م / كجم
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPricingMode("PER_PIECE")}
                className={`p-2 rounded-xl border text-center transition ${
                  pricingMode === "PER_PIECE"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black border-orange-400"
                    : "bg-stone-950 text-stone-300 border-stone-800"
                }`}
              >
                <div className="text-xs">بالقطعة (فرخة)</div>
                <div className="text-[10px] font-mono opacity-80">{rates.chickenPricePerPiece} ج.م / قطعة</div>
              </button>

              <button
                type="button"
                onClick={() => setPricingMode("FIXED")}
                className={`p-2 rounded-xl border text-center transition ${
                  pricingMode === "FIXED"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black border-orange-400"
                    : "bg-stone-950 text-stone-300 border-stone-800"
                }`}
              >
                <div className="text-xs">مبلغ مقطوع</div>
                <div className="text-[10px] font-mono opacity-80">{rates.fixedServiceFee} ج.م ثابت</div>
              </button>
            </div>

            {/* Custom Rate Input */}
            <div className="flex items-center gap-2 bg-stone-950 p-2.5 rounded-xl border border-stone-800">
              <span className="text-[11px] text-stone-400 font-bold whitespace-nowrap">تعديل سعر الخدمة (اختياري):</span>
              <input
                type="number"
                min="0"
                placeholder={
                  pricingMode === "PER_KG"
                    ? `افتراضي: ${isChicken ? rates.chickenPricePerKg : rates.meatPricePerKg}`
                    : pricingMode === "PER_PIECE"
                    ? `افتراضي: ${rates.chickenPricePerPiece}`
                    : `افتراضي: ${rates.fixedServiceFee}`
                }
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="w-full bg-[#121217] border border-stone-700 text-white font-mono font-bold text-xs px-2.5 py-1.5 rounded-lg outline-none"
              />
              <span className="text-xs text-stone-400">ج.م</span>
            </div>

            {/* Add-ons from Restaurant */}
            <div>
              <label className="block text-[11px] font-black text-stone-200 mb-1.5">
                إضافات من المطعم (طحينة، سلطة، عيش، مشروبات):
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {addons.map((addon) => (
                  <div
                    key={addon.id}
                    className="flex items-center justify-between p-2 bg-stone-950 rounded-xl border border-stone-850"
                  >
                    <div>
                      <span className="text-xs font-bold text-stone-200">{addon.nameAr}</span>
                      <span className="text-[10px] font-mono text-orange-400 mr-2">{addon.price} ج.م</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <button
                        type="button"
                        onClick={() => handleUpdateAddonQty(addon.id, -1)}
                        className="w-6 h-6 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-white w-4 text-center">{addon.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateAddonQty(addon.id, 1)}
                        className="w-6 h-6 rounded-lg bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-stone-950 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bill Calculation Summary Card */}
          <div className="bg-gradient-to-r from-stone-950 via-orange-950/40 to-stone-950 p-4 rounded-2xl border border-orange-500/40 space-y-2">
            <div className="flex justify-between text-xs text-stone-300">
              <span>قيمة خامات اللحوم (العميل):</span>
              <span className="font-mono font-bold text-emerald-400">0.00 ج.م (خامات العميل)</span>
            </div>
            <div className="flex justify-between text-xs text-stone-300">
              <span>رسوم خدمة الشوي:</span>
              <span className="font-mono font-bold text-orange-400">{calculatedGrillingFee.toFixed(2)} ج.م</span>
            </div>
            {addonsTotal > 0 && (
              <div className="flex justify-between text-xs text-stone-300">
                <span>إجمالي الإضافات من المطعم:</span>
                <span className="font-mono font-bold text-amber-400">{addonsTotal.toFixed(2)} ج.م</span>
              </div>
            )}
            <div className="border-t border-stone-800 pt-2 flex justify-between items-center">
              <div>
                <span className="text-xs font-black text-white">إجمالي الفاتورة المطلوب سداده:</span>
                <p className="text-[10px] text-stone-400 font-mono">خدمة الشوي + الإضافات فقط</p>
              </div>
              <div className="text-left font-mono">
                <span className="text-2xl font-black text-amber-400">{billTotal.toFixed(2)}</span>
                <span className="text-xs text-orange-400 font-bold mr-1">ج.م</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFormSubmit("PREP")}
              className="py-3 bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 text-white font-black rounded-2xl text-xs border border-orange-500/40 shadow transition flex items-center justify-center gap-1.5"
            >
              <span>🔥</span>
              <span>حفظ وتوجيه للشواية</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFormSubmit("PAY")}
              className="py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 text-stone-950 font-black rounded-2xl text-xs shadow-lg shadow-orange-500/30 transition flex items-center justify-center gap-1.5"
            >
              <span>💵</span>
              <span>تحصيل نقدي وتسليم</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
