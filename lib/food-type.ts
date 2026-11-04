/** Veg / Non-veg / Egg labelling. It is always chosen by the vendor, never guessed from the category. */
export type FoodType = "veg" | "non_veg" | "egg";

export const FOOD_TYPES: Array<{ value: FoodType; label: string }> = [
  { value: "veg", label: "Vegetarian" },
  { value: "non_veg", label: "Non-vegetarian" },
  { value: "egg", label: "Contains egg" },
];

export function normalizeFoodType(value: unknown): FoodType | undefined {
  return value === "veg" || value === "non_veg" || value === "egg" ? value : undefined;
}

export function foodTypeLabel(type: FoodType | undefined): string {
  return FOOD_TYPES.find((item) => item.value === type)?.label ?? "Food type not set";
}
