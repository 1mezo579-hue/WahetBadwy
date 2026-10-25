"use client";

import { useState } from "react";

interface WeightModalProps {
  item: {
    id: string;
    nameAr: string;
    price: number; // Base price per 1 kg (1000g)
    image?: string;
  };
  onClose: () => void;
  onAdd: (params: {
    item: { id: string; nameAr: string; price: number };
    weightGrams: number;
    totalPrice: number;
    notes?: string;
  }) => void;
}

const PRESET_WEIGHTS = [
  { label: "125 جم (ثمن)", grams: 125, fraction: "1/8" },
  { label: "250 جم (ربع)", grams: 250, fraction: "1/4" },
  { label: "375 جم (3/8)", grams: 375, fraction: "3/8" },
  { label: "500 جم (نصف)", grams: 500, fraction: "1/2" },
  { label: "625 جم (5/8)", grams: 625, fraction: "5/8" },
  { label: "750 جم (إلا ربع)", grams: 750, fraction: "3/4" },
  { label: "875 جم (7/8)", grams: 875, fraction: "7/8" },
  { label: "1000 جم (كيلو)", grams: 1000, fraction: "1" },
];

export default function WeightModal({ item, onClose, onAdd }: WeightModalProps) {
  const [selectedGrams, setSelectedGrams] = useState<number>(500);
  const [customGramsInput, setCustomGramsInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const activeGrams = customGramsInput && Number(customGramsInput) > 0
    ? Number(customGramsInput)
    : selectedGrams;

  // Formula: (weightInGrams / 1000) * pricePerKg
  const calculatedPrice = Math.round(((activeGrams / 1000) * item.price) * 100) / 100;

  const handleSelectPreset = (grams: number) => {
    setSelectedGrams(grams);
    setCustomGramsInput("");
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomGramsInput(val);
  };

  const handleConfirm = () => {
    if (!activeGrams || activeGrams <= 0) {
      alert("يرجى تحديد وزن صالح بالجرام");
      return;
    }
    onAdd({
      item,
      weightGrams: activeGrams,
      totalPrice: calculatedPrice,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#121217] border border-orange-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-orange-950/60 to-stone-900 border-b border-orange-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚖️</span>
            <div>
              <h2 className="text-base font-black text-white">{item.nameAr}</h2>
              <p className="text-xs text-orange-400 font-bold font-mono">
                سعر الكيلو الأساسي: {item.price} ج.م / كجم
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Presets Grid */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-2">
              اختر الوزن المطلوب (بالجرام):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_WEIGHTS.map((p) => {
                const isSelected = !customGramsInput && selectedGrams === p.grams;
                return (
                  <button
                    key={p.grams}
                    type="button"
                    onClick={() => handleSelectPreset(p.grams)}
                    className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-black border-orange-400 shadow-md shadow-orange-500/20"
                        : "bg-stone-900/90 text-stone-200 border-stone-800 hover:border-orange-500/50 font-bold"
                    }`}
                  >
                    <span className="text-xs">{p.label}</span>
                    <span className="text-[10px] font-mono opacity-80">{p.grams} جم</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Weight Input */}
          <div className="bg-stone-900/80 p-3 rounded-2xl border border-stone-800 space-y-1.5">
            <label className="block text-xs font-bold text-stone-300">
              أو أدخل وزناً مخصصاً بالجرام (Custom Weight):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="10"
                step="10"
                placeholder="مثلاً: 350، 420، 1250..."
                value={customGramsInput}
                onChange={handleCustomChange}
                className="flex-1 bg-stone-950 border border-orange-500/40 focus:border-orange-500 text-white font-mono font-bold text-sm px-3 py-2 rounded-xl outline-none"
              />
              <span className="text-xs text-stone-400 font-bold">جرام</span>
            </div>
          </div>

          {/* Live Price Calculation Box */}
          <div className="bg-gradient-to-r from-stone-950 to-orange-950/40 p-3.5 rounded-2xl border border-orange-500/40 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-stone-400 font-bold">الوزن المعتمد: {activeGrams} جم ({(activeGrams / 1000).toFixed(3)} كجم)</p>
              <p className="text-[10px] text-stone-500 font-mono">
                ({activeGrams} ÷ 1000) × {item.price} ج.م
              </p>
            </div>
            <div className="text-left font-mono">
              <span className="text-xl font-black text-amber-400">{calculatedPrice}</span>
              <span className="text-xs text-orange-400 font-bold mr-1">ج.م</span>
            </div>
          </div>

          {/* Special Notes */}
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1">
              ملاحظات تجهيز أو تسوية (اختياري):
            </label>
            <input
              type="text"
              placeholder="مثال: تسوية زيادة، بدون شطة، بهارات خفيفة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 text-stone-200 text-xs px-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-stone-950 border-t border-stone-800 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-300 font-bold rounded-xl text-xs transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-[2] py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-stone-950 font-black rounded-xl text-xs transition shadow-lg shadow-orange-500/20 flex items-center justify-center gap-1.5"
          >
            <span>+ إضافة للطلب ({calculatedPrice} ج.م)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
