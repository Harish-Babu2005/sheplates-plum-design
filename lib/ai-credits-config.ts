// Central configuration for the SHE Plates AI Credits system.
// All values (plan credits, pack sizes, prices, action costs) are managed here.

export type PlanCode = "taster" | "crave" | "thrive" | "crown";

export type AiAction =
  | "product_image_generate"
  | "image_enhance"
  | "catalogue_import"
  | "nutrition_estimate"
  | "she_agent_chat"
  | "business_insights"
  | "quotation_assistant"
  | "food_attributes"
  | "general_ai";

/**
 * 1. Credits included in each plan per billing cycle.
 * Taster has 0 (no AI features).
 */
export const PLAN_INCLUDED_CREDITS: Record<PlanCode, number> = {
  taster: 0,
  crave: 200,
  thrive: 400,
  crown: 800,
};

/**
 * 2. Extra credit packs (one-time purchase, any plan except Taster).
 * Prices in INR exclusive of GST. Standard 18% GST is added at checkout.
 */
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number; // in INR exclusive of GST
  gstPercent: number; // 18% GST
  description: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack_200",
    name: "Starter Boost",
    credits: 200,
    price: 99,
    gstPercent: 18,
    description: "200 extra AI credits for catalogue images, nutrition and She Agent.",
  },
  {
    id: "pack_400",
    name: "Growth Pack",
    credits: 400,
    price: 299,
    gstPercent: 18,
    description: "400 extra AI credits for growing kitchens with active product listings.",
  },
  {
    id: "pack_600",
    name: "Pro Volume Pack",
    credits: 600,
    price: 399,
    gstPercent: 18,
    description: "600 extra AI credits for high-volume kitchen operations.",
  },
];

/**
 * Helper to calculate price, GST, and total payable in rupees and paise.
 */
export function calculateCreditPackBilling(packOrId: CreditPack | string) {
  const pack = typeof packOrId === "string" ? CREDIT_PACKS.find((p) => p.id === packOrId) : packOrId;
  if (!pack) throw new Error(`Unknown credit pack: ${String(packOrId)}`);
  const basePrice = pack.price;
  const gstAmount = Math.round(basePrice * (pack.gstPercent / 100) * 100) / 100;
  const totalAmount = Math.round((basePrice + gstAmount) * 100) / 100;
  const totalPaise = Math.round(totalAmount * 100);
  return {
    packId: pack.id,
    credits: pack.credits,
    basePrice,
    gstPercent: pack.gstPercent,
    gstAmount,
    totalAmount,
    totalPaise,
  };
}

/**
 * 3. Cost in credits for each AI action.
 * Currently set to placeholder 1 credit per action as requested.
 * Easily adjusted here when updated pricing is decided.
 */
export const AI_ACTION_COSTS: Record<AiAction, number> = {
  product_image_generate: 1, // AI picture creation via URUV image generation
  image_enhance: 1,          // AI product image enhancement & styling
  catalogue_import: 1,       // Smart bulk product/grocery list reading
  nutrition_estimate: 1,     // AI nutrition calculation per selling pack
  she_agent_chat: 1,         // She Agent conversational assistance & commerce reasoning
  business_insights: 1,      // Grounded store intelligence & operational recommendations
  quotation_assistant: 1,    // AI quotation assistance for Crown RFQs
  food_attributes: 1,        // AI food taste classification & attribute tagging
  general_ai: 1,             // General AI fallback
};

export function getActionCreditCost(action: AiAction): number {
  return AI_ACTION_COSTS[action] ?? 1;
}

export const AI_ACTION_LABELS: Record<AiAction, string> = {
  product_image_generate: "AI product image generation",
  image_enhance: "AI image enhancement",
  catalogue_import: "AI catalogue smart import",
  nutrition_estimate: "AI nutrition estimate",
  she_agent_chat: "She Agent conversation",
  business_insights: "AI store intelligence analysis",
  quotation_assistant: "AI quotation assistance",
  food_attributes: "AI food attribute tagging",
  general_ai: "AI assistance",
};

/**
 * 4. Low credit threshold (20% of plan allowance).
 */
export const LOW_CREDIT_THRESHOLD_PERCENT = 20;

export function isLowCreditBalance(a: PlanCode | number, b: PlanCode | number): boolean {
  const planCode = (typeof a === "string" ? a : b) as PlanCode;
  const totalBalance = typeof a === "number" ? a : (b as number);
  const allowance = PLAN_INCLUDED_CREDITS[planCode] || 0;
  if (allowance <= 0) return totalBalance === 0;
  return totalBalance < Math.ceil((allowance * LOW_CREDIT_THRESHOLD_PERCENT) / 100);
}
