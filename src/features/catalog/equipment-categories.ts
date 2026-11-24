/** Canonical Yard Catalog categories (RR Feedback 2). */
export const EQUIPMENT_CATEGORIES = [
  "Hoisting",
  "Winching",
  "Lifting Equipment",
  "Man Cages & Rescue Cages",
  "Slings",
  "Spreader & Lifting Beams",
  "Load Skates & Jacks",
  "Load Cells",
  "Water Bags",
  "Portable Gantry Cranes",
  "Stand/Stools",
  "Test Weights",
  "Rigging Loft",
] as const;

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
