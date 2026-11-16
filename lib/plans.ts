// Subscription plans configuration and enforcement rules for SHE Plates
// Defines entitlements, limits, and helper validations for Taster, Crave, Thrive, Crown.

export type PlanCode = "taster" | "crave" | "thrive" | "crown";
export type PlanName = "Taster" | "Crave" | "Thrive" | "Crown";

export interface PlanLimits {
  code: PlanCode;
  name: PlanName;
  monthlyPrice: number; // in INR exclusive of GST
  maxProducts: number;
  maxFoodDrops: number; // 0 for Crave
  maxFoodShortsPerDay: number; // 3 for Crave, resets midnight IST
  maxDeliveryStaff: number; // 3 for Crave
  maxDeliverySlots: number; // 3 for Crave
  maxAiPicturesPerDay: number; // 10 for Crave, resets midnight IST
  maxRadiusKm: number; // 30 km for all
  rfqAccess: boolean; // Crown only
  whatsappLeads: boolean; // Taster only
  ordering: boolean; // true for Crave, Thrive, Crown
  scheduledOrders: boolean; // true for Crave, Thrive, Crown
  foodStories: boolean; // true for Crave, Thrive, Crown
  priorityAlerts: boolean; // Crown only
  defaultCommissionPercent: number; // 10%
}

export const PLAN_LIMITS: Record<PlanCode, PlanLimits> = {
  taster: {
    code: "taster",
    name: "Taster",
    monthlyPrice: 499,
    maxProducts: 25,
    maxFoodDrops: 0,
    maxFoodShortsPerDay: 1,
    maxDeliveryStaff: 0,
    maxDeliverySlots: 0,
    maxAiPicturesPerDay: 3,
    maxRadiusKm: 30,
    rfqAccess: false,
    whatsappLeads: true,
    ordering: false,
    scheduledOrders: false,
    foodStories: false,
    priorityAlerts: false,
    defaultCommissionPercent: 0,
  },
  crave: {
    code: "crave",
    name: "Crave",
    monthlyPrice: 699,
    maxProducts: 100,
    maxFoodDrops: 0,
    maxFoodShortsPerDay: 3,
    maxDeliveryStaff: 3,
    maxDeliverySlots: 3,
    maxAiPicturesPerDay: 10,
    maxRadiusKm: 30,
    rfqAccess: false,
    whatsappLeads: false,
    ordering: true,
    scheduledOrders: true,
    foodStories: true,
    priorityAlerts: false,
    defaultCommissionPercent: 10,
  },
  thrive: {
    code: "thrive",
    name: "Thrive",
    monthlyPrice: 799,
    maxProducts: 250,
    maxFoodDrops: 1,
    maxFoodShortsPerDay: 10,
    maxDeliveryStaff: 10,
    maxDeliverySlots: 10,
    maxAiPicturesPerDay: 25,
    maxRadiusKm: 30,
    rfqAccess: false,
    whatsappLeads: false,
    ordering: true,
    scheduledOrders: true,
    foodStories: true,
    priorityAlerts: false,
    defaultCommissionPercent: 10,
  },
  crown: {
    code: "crown",
    name: "Crown",
    monthlyPrice: 999,
    maxProducts: 1000,
    maxFoodDrops: 5,
    maxFoodShortsPerDay: 30,
    maxDeliveryStaff: 50,
    maxDeliverySlots: 50,
    maxAiPicturesPerDay: 50,
    maxRadiusKm: 30,
    rfqAccess: true,
    whatsappLeads: false,
    ordering: true,
    scheduledOrders: true,
    foodStories: true,
    priorityAlerts: true,
    defaultCommissionPercent: 10,
  },
};

/** Normalizes any plan representation (name or code) into a standard PlanCode */
export function normalizePlanCode(plan?: string | null): PlanCode {
  if (!plan) return "crave";
  const lower = plan.toLowerCase().trim();
  if (lower === "crown" || lower === "premium") return "crown";
  if (lower === "thrive" || lower === "growth") return "thrive";
  if (lower === "taster") return "taster";
  return "crave";
}

/** Helper to extract plan code from Supabase relations which may be object or array */
export function extractPlanCode(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (typeof first === "object" && first !== null && "code" in first) {
      return String((first as { code?: unknown }).code || "");
    }
    return undefined;
  }
  if (typeof raw === "object" && raw !== null && "code" in raw) {
    return String((raw as { code?: unknown }).code || "");
  }
  return undefined;
}

/** Get limits and entitlements for a given plan */
export function getPlanLimits(plan?: string | null): PlanLimits {
  const code = normalizePlanCode(plan);
  return PLAN_LIMITS[code];
}

/**
 * Returns a Date representing 00:00:00 (midnight) in India Standard Time (Asia/Kolkata)
 * for the current date or provided date.
 */
export function getIstMidnightDate(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = formatter.format(date); // YYYY-MM-DD
  return new Date(`${dateStr}T00:00:00+05:30`);
}

/**
 * Returns the current date in YYYY-MM-DD format in India Standard Time (Asia/Kolkata)
 */
export function getIstDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Checks whether a timestamp occurred on the same IST day */
export function isSameIstDay(timestamp: string | number | Date, refDate: Date = new Date()): boolean {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return false;
  return getIstDateKey(d) === getIstDateKey(refDate);
}

/** Helper to get display name of a plan */
export function getPlanDisplayName(plan?: string | null): PlanName {
  return getPlanLimits(plan).name;
}

/** Check if product count is within the plan limit */
export function canAddProduct(plan: string, currentCount: number): { allowed: boolean; limit: number; message?: string; reason?: string } {
  const limits = getPlanLimits(plan);
  if (currentCount >= limits.maxProducts) {
    const nextPlan = limits.code === "crave" ? "Thrive" : "Crown";
    const msg = `${limits.name} allows ${limits.maxProducts} products. You have ${currentCount}. Upgrade to ${nextPlan} to add more.`;
    return {
      allowed: false,
      limit: limits.maxProducts,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxProducts };
}

/** Check if delivery staff count is within the plan limit */
export function canAddDeliveryStaff(plan: string, currentCount: number): { allowed: boolean; limit: number; message?: string; reason?: string } {
  const limits = getPlanLimits(plan);
  if (currentCount >= limits.maxDeliveryStaff) {
    const nextPlan = limits.code === "crave" ? "Thrive" : "Crown";
    const msg = `${limits.name} allows ${limits.maxDeliveryStaff} delivery staff members. You have ${currentCount}. Upgrade to ${nextPlan} to add more.`;
    return {
      allowed: false,
      limit: limits.maxDeliveryStaff,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxDeliveryStaff };
}

/** Check if delivery slot count is within the plan limit */
export function canAddDeliverySlot(plan: string, currentCount: number): { allowed: boolean; limit: number; message?: string; reason?: string } {
  const limits = getPlanLimits(plan);
  if (currentCount >= limits.maxDeliverySlots) {
    const nextPlan = limits.code === "crave" ? "Thrive" : "Crown";
    const msg = `${limits.name} allows ${limits.maxDeliverySlots} delivery slots. You have ${currentCount}. Upgrade to ${nextPlan} to add more.`;
    return {
      allowed: false,
      limit: limits.maxDeliverySlots,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxDeliverySlots };
}

/** Check if Food Drops are available for this plan */
export function canCreateFoodDrop(plan: string): { allowed: boolean; limit: number; message?: string; reason?: string } {
  const limits = getPlanLimits(plan);
  if (limits.maxFoodDrops <= 0) {
    const msg = `Food Drops are not included in the ${limits.name} plan. Upgrade to Thrive to publish daily Food Drops.`;
    return {
      allowed: false,
      limit: 0,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxFoodDrops };
}

/** Check if RFQ (Quotations) access is allowed */
export function canAccessRfq(plan: string): { allowed: boolean; message?: string; reason?: string } {
  const limits = getPlanLimits(plan);
  if (!limits.rfqAccess) {
    const msg = `Quotation requests (RFQ) and AI quotation assistance are exclusive to the Crown plan. Upgrade to Crown to receive customer quotation requests.`;
    return {
      allowed: false,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true };
}

/** Check if Food Short upload count today is within daily limit (resets midnight IST) */
export function canUploadFoodShort(plan: string, countTodayIst: number): { allowed: boolean; limit: number; message?: string; reason?: string } {
  const limits = getPlanLimits(plan);
  if (countTodayIst >= limits.maxFoodShortsPerDay) {
    const nextPlan = limits.code === "crave" ? "Thrive" : "Crown";
    const msg = `Daily limit reached: ${limits.name} allows ${limits.maxFoodShortsPerDay} Food Shorts per day (resets midnight IST). Upgrade to ${nextPlan} for more.`;
    return {
      allowed: false,
      limit: limits.maxFoodShortsPerDay,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxFoodShortsPerDay };
}

/** Check if AI product picture generation count today is within daily limit (resets midnight IST) */
export function canGenerateAiPicture(plan: string, countTodayIst: number): { allowed: boolean; limit: number; message?: string; reason?: string } {
  const limits = getPlanLimits(plan);
  if (countTodayIst >= limits.maxAiPicturesPerDay) {
    const nextPlan = limits.code === "crave" ? "Thrive" : "Crown";
    const msg = `Daily limit reached: ${limits.name} allows ${limits.maxAiPicturesPerDay} AI product images per day (resets midnight IST). Upgrade to ${nextPlan} for more.`;
    return {
      allowed: false,
      limit: limits.maxAiPicturesPerDay,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxAiPicturesPerDay };
}
