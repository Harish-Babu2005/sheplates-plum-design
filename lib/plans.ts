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
    maxProducts: 300,
    maxFoodDrops: 3,
    maxFoodShortsPerDay: 5,
    maxDeliveryStaff: 10,
    maxDeliverySlots: 6,
    maxAiPicturesPerDay: 15,
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
    maxProducts: Infinity,
    maxFoodDrops: 10,
    maxFoodShortsPerDay: 10,
    maxDeliveryStaff: Infinity,
    maxDeliverySlots: 12,
    maxAiPicturesPerDay: 25,
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
  if (limits.maxProducts !== Infinity && currentCount >= limits.maxProducts) {
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
  if (limits.maxDeliveryStaff !== Infinity && currentCount >= limits.maxDeliveryStaff) {
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
    const msg = limits.code === "crown"
      ? `Crown allows ${limits.maxDeliverySlots} delivery slots. You have ${currentCount}.`
      : `${limits.name} allows ${limits.maxDeliverySlots} delivery slots. You have ${currentCount}. Upgrade to ${nextPlan} to add more.`;
    return {
      allowed: false,
      limit: limits.maxDeliverySlots,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxDeliverySlots };
}

/**
 * Returns the 1st of next month in IST formatted as YYYY-MM-01
 */
export function getNextMonthFirstIst(refDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(refDate);

  const yearPart = parts.find((p) => p.type === "year")?.value || "2026";
  const monthPart = parts.find((p) => p.type === "month")?.value || "11";

  let year = parseInt(yearPart, 10);
  let month = parseInt(monthPart, 10);

  if (month === 12) {
    year += 1;
    month = 1;
  } else {
    month += 1;
  }

  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-01`;
}

/**
 * Formats an IST effective date (e.g. "2026-12-01") into human readable "1 December"
 */
export function formatIstEffectiveDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const monthName = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    return `${day} ${monthName}`;
  } catch {
    return dateStr;
  }
}

/**
 * Checks if the effective date for a scheduled downgrade has arrived or passed in IST
 */
export function isScheduledDowngradeDue(effectiveDateStr: string, refDate: Date = new Date()): boolean {
  const todayIst = getIstDateKey(refDate);
  return todayIst >= effectiveDateStr;
}

/** Check if Food Drops are available for this plan and within daily creation limits (resets midnight IST) */
export function canCreateFoodDrop(plan: string, countTodayIst: number = 0): { allowed: boolean; limit: number; message?: string; reason?: string } {
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
  if (countTodayIst >= limits.maxFoodDrops) {
    const msg = limits.code === "crown"
      ? `Daily limit reached: Crown allows ${limits.maxFoodDrops} Food Drops per day (resets midnight IST).`
      : `Daily limit reached: ${limits.name} allows ${limits.maxFoodDrops} Food Drops per day (resets midnight IST). Upgrade to Crown for more.`;
    return {
      allowed: false,
      limit: limits.maxFoodDrops,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxFoodDrops };
}

/**
 * Automatically applies a scheduled plan downgrade when effective date is reached.
 * Deactivates products, staff, and slots exceeding the new plan limit (newest first, setting active: false, never deleting).
 */
export function applyScheduledPlanDowngrade<
  TProduct extends { id: string; vendorId: string; active: boolean; createdAt?: string } = any,
  TStaff extends { id: string; vendorId?: string; active?: boolean; createdAt?: string } = any,
  TSlot extends { id: string; vendorId?: string; active?: boolean; isActive?: boolean; createdAt?: string } = any,
>(
  vendor: { id: string; businessName: string; plan: string; scheduledPlanChange?: { nextPlan: string; effectiveDate: string; requestedAt: string } },
  products: TProduct[],
  staffOrRefDate?: TStaff[] | Date,
  slots?: TSlot[],
  refDateParam?: Date
): {
  applied: boolean;
  newPlan?: string;
  deactivatedProductIds: string[];
  deactivatedStaffIds: string[];
  deactivatedSlotIds: string[];
  auditDetail?: string;
} {
  const refDate = staffOrRefDate instanceof Date ? staffOrRefDate : (refDateParam || new Date());
  const staff = Array.isArray(staffOrRefDate) ? staffOrRefDate : [];
  const safeSlots = Array.isArray(slots) ? slots : [];

  if (!vendor.scheduledPlanChange) {
    return { applied: false, deactivatedProductIds: [], deactivatedStaffIds: [], deactivatedSlotIds: [] };
  }
  if (!isScheduledDowngradeDue(vendor.scheduledPlanChange.effectiveDate, refDate)) {
    return { applied: false, deactivatedProductIds: [], deactivatedStaffIds: [], deactivatedSlotIds: [] };
  }

  const nextPlan = vendor.scheduledPlanChange.nextPlan;
  const newLimits = getPlanLimits(nextPlan);
  const vendorProducts = products.filter((p) => p.vendorId === vendor.id && p.active);

  // If excess products exist, sort by createdAt descending (newest first) and deactivate
  const deactivatedProductIds: string[] = [];
  if (newLimits.maxProducts !== Infinity && vendorProducts.length > newLimits.maxProducts) {
    const sorted = [...vendorProducts].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    const excess = sorted.slice(0, vendorProducts.length - newLimits.maxProducts);
    for (const item of excess) {
      deactivatedProductIds.push(item.id);
    }
  }

  // Deactivate excess staff (newest first)
  const deactivatedStaffIds: string[] = [];
  const vendorStaff = staff.filter((s) => s.vendorId === vendor.id && s.active !== false);
  if (newLimits.maxDeliveryStaff !== Infinity && vendorStaff.length > newLimits.maxDeliveryStaff) {
    const sortedStaff = [...vendorStaff].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    const excessStaff = sortedStaff.slice(0, vendorStaff.length - newLimits.maxDeliveryStaff);
    for (const item of excessStaff) {
      deactivatedStaffIds.push(item.id);
    }
  }

  // Deactivate excess slots (newest first)
  const deactivatedSlotIds: string[] = [];
  const vendorSlots = safeSlots.filter((s) => s.vendorId === vendor.id && (s.isActive ?? s.active ?? true));
  if (newLimits.maxDeliverySlots !== Infinity && vendorSlots.length > newLimits.maxDeliverySlots) {
    const sortedSlots = [...vendorSlots].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    const excessSlots = sortedSlots.slice(0, vendorSlots.length - newLimits.maxDeliverySlots);
    for (const item of excessSlots) {
      deactivatedSlotIds.push(item.id);
    }
  }

  const parts = [`${deactivatedProductIds.length} excess product(s)`];
  if (deactivatedStaffIds.length) parts.push(`${deactivatedStaffIds.length} excess staff`);
  if (deactivatedSlotIds.length) parts.push(`${deactivatedSlotIds.length} excess slot(s)`);

  const auditDetail = `Scheduled downgrade applied: ${vendor.businessName} moved from ${vendor.plan} to ${nextPlan}. ${parts.join(", ")} deactivated (newest first).`;

  return {
    applied: true,
    newPlan: nextPlan,
    deactivatedProductIds,
    deactivatedStaffIds,
    deactivatedSlotIds,
    auditDetail,
  };
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

/** Check if WhatsApp lead tracking / contact button is accessible for this plan (Taster only) */
export function canAccessWhatsAppLeads(plan?: string | null): { allowed: boolean; message?: string; reason?: string } {
  const limits = getPlanLimits(plan);
  if (!limits.whatsappLeads) {
    const msg = `WhatsApp contact buttons and lead tracking are exclusive to the Taster plan. Selling plans (Crave, Thrive, Crown) use the integrated cart and checkout.`;
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
    const msg = limits.code === "crown"
      ? `Daily limit reached: Crown allows ${limits.maxFoodShortsPerDay} Food Shorts per day (resets midnight IST).`
      : `Daily limit reached: ${limits.name} allows ${limits.maxFoodShortsPerDay} Food Shorts per day (resets midnight IST). Upgrade to ${nextPlan} for more.`;
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
    const msg = limits.code === "crown"
      ? `Daily limit reached: Crown allows ${limits.maxAiPicturesPerDay} AI product images per day (resets midnight IST).`
      : `Daily limit reached: ${limits.name} allows ${limits.maxAiPicturesPerDay} AI product images per day (resets midnight IST). Upgrade to ${nextPlan} for more.`;
    return {
      allowed: false,
      limit: limits.maxAiPicturesPerDay,
      message: msg,
      reason: msg,
    };
  }
  return { allowed: true, limit: limits.maxAiPicturesPerDay };
}
