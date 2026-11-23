/**
 * Shared food-name validation utilities.
 * Used by the backend API routes and (via the /api/validate-food-name endpoint) by the frontend.
 *
 * Strategy:
 *  1. Fast keyword deny-list – runs synchronously, zero API cost.
 *  2. LLM classification – called only when the deny-list doesn't match, using the existing AI key.
 *
 * Both layers return { isFood: boolean, confidence: number, reason?: string }.
 */

// ---------------------------------------------------------------------------
// 1. Fast keyword deny-list
// ---------------------------------------------------------------------------

/** Words that definitively identify a non-food product regardless of category. */
const NON_FOOD_KEYWORDS: string[] = [
  // Electronics
  "phone", "mobile", "smartphone", "tablet", "laptop", "computer", "pc", "desktop",
  "headphone", "headset", "earphone", "earbud", "earpod", "airpod", "speaker",
  "keyboard", "mouse", "charger", "cable", "wire", "adapter", "battery", "powerbank",
  "power bank", "usb", "hdmi", "monitor", "tv", "television", "camera", "lens",
  "projector", "printer", "scanner", "router", "modem", "wifi", "bluetooth",
  "smartwatch", "watch", "clock",
  // Clothing / fashion
  "shirt", "tshirt", "t-shirt", "blouse", "top", "trouser", "pant", "jeans", "shorts",
  "skirt", "dress", "saree", "kurta", "kurti", "lehenga", "suit", "blazer", "jacket",
  "coat", "sweater", "hoodie", "sweatshirt", "underwear", "bra", "sock", "shoe",
  "sandal", "slipper", "boot", "chappal", "belt", "tie", "scarf", "cap", "hat",
  "helmet", "glove", "wallet", "purse", "handbag", "bag", "backpack", "luggage",
  // Furniture / home
  "sofa", "chair", "table", "desk", "bed", "mattress", "pillow", "blanket", "curtain",
  "carpet", "rug", "shelf", "rack", "wardrobe", "cupboard", "almirah", "fan", "ac",
  "air conditioner", "refrigerator", "fridge", "washing machine", "microwave",
  "iron", "vacuum",
  // Stationery / office
  "pen", "pencil", "eraser", "ruler", "notebook", "book", "paper", "file", "folder",
  "stapler", "scissor", "glue", "tape", "envelope", "stamp",
  // Toys / games
  "toy", "doll", "puzzle", "game", "lego", "board game",
  // Vehicles / accessories
  "car", "bike", "bicycle", "scooter", "helmet", "tyre", "tire",
  // Personal care (non-food)
  "shampoo", "conditioner", "soap bar", "detergent", "toothbrush", "toothpaste",
  "deodorant", "perfume", "cologne", "lotion", "cream", "moisturizer", "sunscreen",
  "lipstick", "makeup", "cosmetic", "mascara", "foundation", "powder",
  // Medical / pharmacy
  "medicine", "tablet", "capsule", "syrup", "injection", "bandage",
  // Misc
  "earring", "necklace", "ring", "bracelet", "jewellery", "jewelry",
  "flower", "plant", "pot", "fertilizer", "seed",
  "paint", "brush", "canvas",
  "rope", "nail", "screw", "bolt", "tool", "hammer", "drill",
  "lock", "key",
];

/** Minimum meaningful name length. */
export const MIN_NAME_LENGTH = 2;

export interface FoodValidationResult {
  isFood: boolean;
  confidence: number;   // 0–1
  reason?: string;
}

/**
 * Instant, synchronous keyword deny-list check.
 * Returns { isFood: false } when a non-food keyword is found.
 * Returns null when the name passes (needs LLM to confirm).
 */
export function quickDenyCheck(name: string): FoodValidationResult | null {
  const lower = name.toLowerCase().trim();
  if (!lower || lower.length < MIN_NAME_LENGTH) {
    return { isFood: false, confidence: 1, reason: "Name is too short or empty." };
  }
  for (const kw of NON_FOOD_KEYWORDS) {
    // whole-word match including optional plural 's' or 'es'
    const pattern = new RegExp(`(^|\\s|\\W)${kw}(?:s|es)?(\\s|\\W|$)`, "i");
    if (pattern.test(lower)) {
      return { isFood: false, confidence: 0.95, reason: `"${name}" appears to be a non-food product.` };
    }
  }
  // Names that are purely numeric / special characters
  if (/^[\d\s\-_.!@#$%^&*()+={}[\]|\\<>?/;:'"`,~]+$/.test(lower)) {
    return { isFood: false, confidence: 0.95, reason: "Name contains only numbers or special characters." };
  }
  // Obvious keyboard mash / gibberish: e.g. "asdf", "qwer", "zxcv", words >= 3 characters with 0 vowels
  const words = lower.split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (word.length >= 3 && !/[aeiouy]/i.test(word)) {
      return { isFood: false, confidence: 0.9, reason: `"${name}" does not appear to be a genuine product name.` };
    }
  }
  if (lower === "asdf" || lower === "asdfg" || lower === "qwerty" || lower === "zxcv") {
    return { isFood: false, confidence: 0.95, reason: `"${name}" is not a valid product name.` };
  }
  return null; // inconclusive – let LLM decide
}

// ---------------------------------------------------------------------------
// 2. LLM classification (server-only)
// ---------------------------------------------------------------------------

const apiBase = () =>
  (process.env.AI_API_BASE || process.env.URUV_API_BASE || "https://api.uruv.ai/v1").replace(/\/$/, "");

const apiKey = () =>
  process.env.URUV_API_KEY ||
  process.env.URV_API_KEY ||
  process.env.AI_API_KEY ||
  
  "";

const FOOD_CLASSIFY_SYSTEM = `You are a food product validator for Sheplates, an Indian food delivery marketplace. 
Your task: decide whether a given product name is a genuine food or beverage item that could be sold on a food marketplace.

Rules:
- Food/beverage items → isFood: true  (e.g., "Idli", "Fresh Cow Milk 500ml", "Murukku", "Mango Lassi")
- Non-food items → isFood: false (e.g., "Earpods", "iPhone", "Shirt", "asdf", "123")
- Ambiguous food-adjacent items like spices, sauces, pickle → isFood: true
- Supplements like protein powder → isFood: true
- Completely random gibberish → isFood: false

Always reply ONLY with valid JSON:
{"isFood": true/false, "confidence": 0.0–1.0, "reason": "one sentence"}`;

/**
 * LLM-based food classification. Server-side only (uses API key env vars).
 * Falls back to { isFood: true } on network/API errors to avoid blocking vendors.
 */
export async function classifyFoodNameWithAI(
  name: string,
  category: string
): Promise<FoodValidationResult> {
  const key = apiKey();
  if (!key) {
    // No AI key → fail open
    return { isFood: true, confidence: 0.5, reason: "AI validation unavailable; allowed by default." };
  }
  try {
    const response = await fetch(`${apiBase()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.AI_CHAT_MODEL || process.env.URUV_CHAT_MODEL || "uruv-chat",
        messages: [
          { role: "system", content: FOOD_CLASSIFY_SYSTEM },
          { role: "user", content: `Product name: "${name}"\nCategory on platform: "${category}"` },
        ],
        max_tokens: 80,
        temperature: 0,
      }),
    });
    if (!response.ok) return { isFood: true, confidence: 0.5, reason: "AI validation failed; allowed by default." };
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim() || "";
    // Extract JSON from the response (may be wrapped in ```json ... ```)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { isFood: true, confidence: 0.5, reason: "AI response unparseable; allowed by default." };
    const parsed = JSON.parse(jsonMatch[0]) as { isFood?: boolean; confidence?: number; reason?: string };
    return {
      isFood: !!parsed.isFood,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
      reason: parsed.reason,
    };
  } catch {
    // Network error or parse failure → fail open
    return { isFood: true, confidence: 0.5, reason: "AI validation error; allowed by default." };
  }
}

/**
 * Full validation: deny-list first, then LLM if inconclusive.
 * Safe to call from API routes.
 */
export async function validateFoodName(
  name: string,
  category: string
): Promise<FoodValidationResult> {
  const trimmed = name.trim();
  const quick = quickDenyCheck(trimmed);
  if (quick !== null) return quick; // deny-list matched (or empty name)
  return classifyFoodNameWithAI(trimmed, category);
}
