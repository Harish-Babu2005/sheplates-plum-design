/**
 * Pure helpers for automatic product images: safe text for the prompt, one cache key per product type, the prompt itself,
 * and detection of the image format the model returned. No network, no environment, so they are easy to test.
 */

const UNIT_WORDS = new Set([
  "kg", "kgs", "g", "gm", "gms", "gram", "grams", "mg", "l", "ltr", "litre", "litres", "liter", "liters", "ml", "pc", "pcs",
  "piece", "pieces", "pack", "packs", "packet", "packets", "dozen", "unit", "units", "portion", "portions", "plate", "plates",
  "meal", "meals", "bottle", "bottles", "box", "boxes", "bag", "bags", "small", "medium", "large", "fresh",
]);

/** Product name reduced to letters, numbers, spaces and a few harmless marks, at most 60 characters. Empty when unusable. */
export function sanitizeProductName(name: string): string {
  const cleaned = String(name ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s&'()\-.,]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return /[\p{L}]{2,}/u.test(cleaned) ? cleaned : "";
}

/** One key per kind of product, so "Idli Sambar 2 pcs" and "idli sambar" from two vendors share one image. */
export function conceptKey(name: string, category: string): string {
  const words = sanitizeProductName(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word && !/^\d+$/.test(word) && !UNIT_WORDS.has(word));
  if (!words.length) return "";
  const cat = String(category ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "other";
  return `${cat}:${words.join("-")}`.slice(0, 90);
}

/** A file-name safe slug plus a short hash of the key (the key itself may contain non-Latin letters). */
export function storageSlug(key: string): string {
  let hash = 0x811c9dc5;
  for (const char of key) { hash ^= char.codePointAt(0)!; hash = Math.imul(hash, 0x01000193) >>> 0; }
  const ascii = key.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "item";
  return `${ascii}-${hash.toString(16).padStart(8, "0")}`;
}

const CATEGORY_HINTS: Record<string, string> = {
  "milk & dairy": "the dairy product in a clean glass bottle, jar or bowl",
  "home food": "a freshly cooked home-style dish served in a simple bowl or on a thali plate",
  "caterer": "a generously plated freshly cooked dish prepared for sharing",
  "meat & fish": "the fresh cleaned cut, neatly arranged on a board with a little garnish",
  "vegetables": "fresh seasonal produce, washed and neatly arranged",
  "groceries": "the staple in a small bowl or jar with a little spilled on the surface",
  "eggs": "farm eggs in a simple tray or basket",
  "bakery": "freshly baked, golden and cut open to show the inside",
  "snacks": "the crisp snack served in a small bowl",
  "rice & staples": "the grain in a small bowl with a scoop",
};

export function categoryHint(category: string): string {
  return CATEGORY_HINTS[String(category ?? "").toLowerCase()] || "the product presented simply and appetisingly";
}

/** The fixed house style keeps every generated image looking like part of one catalogue. */
export function buildProductImagePrompt(name: string, category: string): string {
  const clean = sanitizeProductName(name);
  return [
    `Premium editorial food photograph of "${clean}", as sold by a home kitchen or local shop in India: ${categoryHint(category)}.`,
    "One hero subject, centred, on a clean white to very light grey seamless backdrop with a soft natural shadow.",
    "Soft daylight from the left, shot from a 45 degree angle, shallow depth of field, realistic colours, fresh and appetising.",
    "One small peacock-teal ceramic or linen accent may appear at the edge. Square 1:1 composition with generous space around the subject.",
    "No text, no logos, no watermark, no packaging brand names, no people, no hands.",
  ].join(" ");
}

/** File type from the first bytes, because the model may return PNG, JPEG or WebP. */
export function detectImageType(bytes: Uint8Array): { mime: string; ext: string } {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return { mime: "image/webp", ext: "webp" };
  return { mime: "image/png", ext: "png" };
}
