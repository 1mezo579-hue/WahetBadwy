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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm font-sans" dir="rtl">
      <div className="bg-[#FFFFFF] border border-[#D9E0E7] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="p-4 bg-[#243B53] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚖️</span>
            <div>
              <h2 className="text-base font-black text-white">{item.nameAr}</h2>
              <p className="text-xs text-[#FDE68A] font-bold font-mono">
                سعر الكيلو الأساسي: {item.price} ج.م / كجم
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1A2C3F] text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto bg-[#F4F6F8]">
          
          {/* Presets Grid */}
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-2">
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
                        ? "bg-[#243B53] text-white font-black border-[#243B53] shadow-md"
                        : "bg-[#FFFFFF] text-[#1F2937] border-[#D9E0E7] hover:border-[#3B82A0] font-bold"
                    }`}
                  >
                    <span className="text-xs">{p.label}</span>
                    <span className={`text-[10px] font-mono ${isSelected ? "text-[#D9E2EC]" : "text-[#5B6472]"}`}>{p.grams} جم</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Weight Input */}
          <div className="bg-[#FFFFFF] p-3 rounded-2xl border border-[#D9E0E7] space-y-1.5 shadow-sm">
            <label className="block text-xs font-bold text-[#1F2937]">
              أو أدخل وزناً مخصصاً بالجرام (وزن يدوي):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="10"
                step="10"
                placeholder="مثلاً: 350، 420، 1250..."
                value={customGramsInput}
                onChange={handleCustomChange}
                className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] focus:border-[#243B53] text-[#1F2937] font-mono font-bold text-sm px-3 py-2 rounded-xl outline-none"
              />
              <span className="text-xs text-[#5B6472] font-bold">جرام</span>
            </div>
          </div>

          {/* Live Price Calculation Box */}
          <div className="bg-[#EBF7F0] p-3.5 rounded-2xl border border-[#A7F3D0] flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] text-[#237A57] font-bold">الوزن المعتمد: {activeGrams} جم ({(activeGrams / 1000).toFixed(3)} كجم)</p>
              <p className="text-[10px] text-[#5B6472] font-mono">
                ({activeGrams} ÷ 1000) × {item.price} ج.م
              </p>
            </div>
            <div className="text-left font-mono">
              <span className="text-2xl font-black text-[#237A57]">{calculatedPrice}</span>
              <span className="text-xs text-[#237A57] font-bold mr-1">ج.م</span>
            </div>
          </div>

          {/* Special Notes */}
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">
              ملاحظات تجهيز أو تسوية (اختياري):
            </label>
            <input
              type="text"
              placeholder="مثال: تسوية زيادة، بدون شطة، بهارات خفيفة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#D9E0E7] focus:border-[#243B53] text-[#1F2937] text-xs px-3 py-2 rounded-xl outline-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#FFFFFF] border-t border-[#D9E0E7] flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#5B6472] font-bold rounded-xl text-xs transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-[2] py-2.5 bg-[#237A57] hover:bg-[#1D6447] text-white font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
          >
            <span>+ إضافة للطلب ({calculatedPrice} ج.م)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
