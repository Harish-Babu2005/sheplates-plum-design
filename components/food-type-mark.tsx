import { foodTypeLabel, type FoodType } from "@/lib/food-type";

const GREEN = "#247343";
const BROWN = "#8A3B12";

/**
 * The Indian food mark: a green dot in a green square for vegetarian, a brown triangle in a brown square for
 * non-vegetarian and egg. The shape and the spoken label carry the meaning too, not the colour alone.
 */
export function FoodTypeMark({ type, className = "" }: { type?: FoodType; className?: string }) {
  if (!type) return null;
  const colour = type === "veg" ? GREEN : BROWN;
  return <svg role="img" aria-label={foodTypeLabel(type)} viewBox="0 0 16 16" className={`inline-block size-4 shrink-0 align-[-2px] ${className}`}>
    <title>{foodTypeLabel(type)}</title>
    <rect x="1" y="1" width="14" height="14" rx="2" fill="#FFFFFF" stroke={colour} strokeWidth="1.5" />
    {type === "veg" ? <circle cx="8" cy="8" r="3.6" fill={colour} /> : <path d="M8 4 12.2 11.5H3.8Z" fill={colour} />}
  </svg>;
}
