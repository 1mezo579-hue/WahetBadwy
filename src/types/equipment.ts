export const EquipmentType = {
  KITCHEN: "KITCHEN",
  BALADI_COFFEE: "BALADI_COFFEE",
  BARISTA: "BARISTA",
  SHISHA: "SHISHA",
  HALL: "HALL",
  BATHROOM: "BATHROOM",
} as const;

export type EquipmentType = (typeof EquipmentType)[keyof typeof EquipmentType];
