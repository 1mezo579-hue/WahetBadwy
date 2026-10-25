export interface GrillingRates {
  meatPricePerKg: number;
  chickenPricePerKg: number;
  chickenPricePerPiece: number;
  fixedServiceFee: number;
}

export const DEFAULT_RATES: GrillingRates = {
  meatPricePerKg: 60,
  chickenPricePerKg: 50,
  chickenPricePerPiece: 25,
  fixedServiceFee: 30,
};

export function calculateGrillingFee(params: {
  meatType: string;
  rawWeightGrams: number;
  pieceCount?: number;
  pricingMode: "PER_KG" | "PER_PIECE" | "FIXED";
  customRate?: number;
  rates: GrillingRates;
}): number {
  const { meatType, rawWeightGrams, pieceCount = 0, pricingMode, customRate, rates } = params;

  if (pricingMode === "FIXED") {
    return customRate && customRate > 0 ? customRate : rates.fixedServiceFee;
  }

  if (pricingMode === "PER_PIECE") {
    const rate = customRate && customRate > 0 ? customRate : rates.chickenPricePerPiece;
    return Math.max(1, pieceCount) * rate;
  }

  // Default: PER_KG
  let ratePerKg = rates.meatPricePerKg;
  const isChicken = meatType.includes("فراخ") || meatType.includes("دجاج") || meatType.includes("شيش");
  if (isChicken) {
    ratePerKg = rates.chickenPricePerKg;
  }
  if (customRate && customRate > 0) {
    ratePerKg = customRate;
  }

  const weightInKg = (rawWeightGrams || 0) / 1000;
  return Math.round(weightInKg * ratePerKg * 100) / 100;
}
