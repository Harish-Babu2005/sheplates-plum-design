/**
 * Sheplates billing rules in one place: delivery fee, GST, commission and the weekly settlement date.
 * Pure functions (no network, no React) so the cart, the checkout server, the payment server and the tests all agree.
 *
 * Source of the rules: the client's feedback on Proposal v0.1 and the Vendor Partnership Agreement.
 *  - Delivery fee: never below Rs 20; grows with distance; paid in full to the vendor (no commission on it).
 *  - Commission: depends on the vendor's category, can be set per vendor by Operations; Taster (listing only) pays none.
 *  - GST: charged per item. Whether Sheplates or the vendor is liable, and which document the customer gets, depends on the vendor.
 *  - There is no platform fee on the customer's bill.
 *  - Settlement: every Wednesday, for orders of the preceding Monday to Sunday.
 * The default GST rates and commission slabs below are the starting values from the feedback document. Operations can override them
 * per vendor, and the accountant must confirm the GST defaults before launch.
 */

// ---------------------------------------------------------------------------------------------------------------- delivery
export type DeliverySlab = { upToKm: number; fee: number };

/** Guidance slabs: fee for a distance up to and including `upToKm`. */
export const DELIVERY_SLABS: DeliverySlab[] = [
  { upToKm: 2, fee: 20 },
  { upToKm: 3.5, fee: 25 },
  { upToKm: 5, fee: 30 },
  { upToKm: 6.5, fee: 40 },
  { upToKm: 8, fee: 50 },
];
export const MIN_DELIVERY_FEE = 20;
/** Beyond the last slab: this much more for every further started step of this length. */
export const EXTRA_STEP_KM = 1.5;
export const EXTRA_STEP_FEE = 10;
const EPS = 1e-9;

/** Fee for a distance in km (straight line between the vendor's pin and the delivery pin). */
export function deliveryFeeForDistance(km: number): number {
  const d = Math.max(0, Number(km) || 0);
  for (const slab of DELIVERY_SLABS) if (d <= slab.upToKm + EPS) return slab.fee;
  const last = DELIVERY_SLABS[DELIVERY_SLABS.length - 1];
  return last.fee + Math.ceil((d - last.upToKm - EPS) / EXTRA_STEP_KM) * EXTRA_STEP_FEE;
}

/** Great-circle distance in km (the same formula the marketplace uses), not rounded, so slab edges are exact. */
export function haversineDistanceKm(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null): number | null {
  const values = [lat1, lon1, lat2, lon2];
  if (values.some((v) => v === null || v === undefined || (v as unknown) === "" || !Number.isFinite(Number(v)))) return null;
  const [a1, o1, a2, o2] = values.map(Number);
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(a2 - a1); const dLon = rad(o2 - o1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a1)) * Math.cos(rad(a2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type FulfilmentKind = "vendor_delivery" | "self_pickup" | "third_party_vendor" | "third_party_customer";

/** Maps the labels used in the app and in the database to the four fulfilment options. */
export function fulfilmentKind(mode: string): FulfilmentKind {
  const m = String(mode || "vendor_delivery").toLowerCase().replace(/[\s-]+/g, "_");
  if (m.includes("third") && m.includes("vendor")) return "third_party_vendor";
  if (m.includes("third")) return "third_party_customer";
  if (m.includes("pickup")) return "self_pickup";
  return "vendor_delivery";
}

export type DeliveryFeeResult = {
  fee: number;
  distanceKm: number | null;
  distanceKnown: boolean;
  isWithinRadius: boolean;
  isPickup: boolean;
  isThirdParty: boolean;
  serviceRadiusKm: number | null;
  message?: string;
};

export function calculateDeliveryFee(input: {
  mode: string;
  customerCoords?: { latitude?: number | null; longitude?: number | null };
  vendorCoords?: { latitude?: number | null; longitude?: number | null };
  serviceRadiusKm?: number | null;
  /** A flat fee set by Operations for this vendor. It replaces the distance slabs but never goes below the minimum. */
  vendorCustomFee?: number | null;
}): DeliveryFeeResult {
  const kind = fulfilmentKind(input.mode);
  const radius = input.serviceRadiusKm && input.serviceRadiusKm > 0 ? Number(input.serviceRadiusKm) : null;
  if (kind !== "vendor_delivery") {
    return { fee: 0, distanceKm: null, distanceKnown: false, isWithinRadius: true, isPickup: kind === "self_pickup", isThirdParty: kind !== "self_pickup", serviceRadiusKm: radius };
  }
  const distance = haversineDistanceKm(input.customerCoords?.latitude, input.customerCoords?.longitude, input.vendorCoords?.latitude, input.vendorCoords?.longitude);
  const override = input.vendorCustomFee != null && Number(input.vendorCustomFee) >= 0 ? Math.max(MIN_DELIVERY_FEE, Math.round(Number(input.vendorCustomFee) * 100) / 100) : null;
  if (distance === null) {
    // Distance cannot be measured (no pin yet): charge the minimum and say so, rather than guess a higher fee.
    return { fee: override ?? MIN_DELIVERY_FEE, distanceKm: null, distanceKnown: false, isWithinRadius: true, isPickup: false, isThirdParty: false, serviceRadiusKm: radius, message: "Delivery distance could not be measured, so the minimum delivery fee applies." };
  }
  const shown = Math.round(distance * 100) / 100;
  if (radius !== null && distance > radius + EPS) {
    return { fee: 0, distanceKm: shown, distanceKnown: true, isWithinRadius: false, isPickup: false, isThirdParty: false, serviceRadiusKm: radius, message: `This address is ${shown} km away, beyond the vendor's ${radius} km delivery radius.` };
  }
  return { fee: override ?? deliveryFeeForDistance(distance), distanceKm: shown, distanceKnown: true, isWithinRadius: true, isPickup: false, isThirdParty: false, serviceRadiusKm: radius };
}

// ---------------------------------------------------------------------------------------------------------------- commission
/** Commission (%) on the food total, by vendor category. Starting values from the client; Operations can set a different rate per vendor. */
export const COMMISSION_BY_CATEGORY: Record<string, number> = {
  "Home food": 10, "Caterer": 10, "Bakery": 10, "Snacks": 10, "Ready to cook": 10, "Beverages": 10,
  "Vegetables": 5, "Fruits": 5, "Meat & fish": 5, "Milk & dairy": 5, "Eggs": 5,
  "Groceries": 3, "Rice & staples": 3,
  "Other": 10,
};
/** Categories the feedback document did not give a rate for. These use the value above until the client confirms. */
export const COMMISSION_ASSUMED = ["Caterer", "Ready to cook", "Beverages", "Eggs", "Other"];
export const DEFAULT_COMMISSION_PERCENT = 10;

export function commissionPercentFor(category: string | undefined, override?: number | null, plan?: string | null): number {
  if (String(plan || "").toLowerCase() === "taster") return 0; // listing only: no platform commission
  if (override != null && Number.isFinite(Number(override)) && Number(override) >= 0 && Number(override) <= 100) return Number(override);
  return COMMISSION_BY_CATEGORY[String(category || "")] ?? DEFAULT_COMMISSION_PERCENT;
}

// ---------------------------------------------------------------------------------------------------------------- GST
/** Default GST rate (%) for a product category when the product has no rate of its own. Mixed categories need a per-product rate. */
export const CATEGORY_GST_RATES: Record<string, number> = {
  "Home food": 5, "Caterer": 5, "Bakery": 5, "Snacks": 5, "Ready to cook": 5, "Beverages": 5,
  "Vegetables": 0, "Fruits": 0, "Eggs": 0, "Meat & fish": 0, "Milk & dairy": 0, "Rice & staples": 0,
  "Groceries": 5, "Other": 5,
};
export const DEFAULT_GST_RATE = 5;
/** Categories whose products differ in GST rate (dairy, meat, groceries, bakery, snacks): the default is only a starting point. */
export const GST_MIXED_CATEGORIES = ["Milk & dairy", "Meat & fish", "Groceries", "Bakery", "Snacks", "Ready to cook", "Beverages", "Rice & staples", "Other"];

/**
 * none     = the vendor does not charge GST (not registered, or exempt goods): the customer gets a Bill of Supply.
 * vendor   = the vendor is liable and issues a Tax Invoice.
 * platform = Sheplates is liable under Section 9(5) (restaurant-type services such as home chefs).
 */
export type GstMode = "none" | "vendor" | "platform";
export type InvoiceType = "bill_of_supply" | "tax_invoice" | "section_9_5";

/** Used when Operations has not set a GST mode for the vendor. */
export function defaultGstMode(category: string | undefined): GstMode {
  const c = String(category || "");
  if (c === "Home food" || c === "Caterer") return "platform";
  if (["Vegetables", "Fruits", "Eggs", "Rice & staples"].includes(c)) return "none";
  return "vendor";
}

export function normalizeGstMode(value: unknown, category?: string): GstMode {
  return value === "none" || value === "vendor" || value === "platform" ? value : defaultGstMode(category);
}

export function invoiceTypeFor(mode: GstMode, gstAmount: number): InvoiceType {
  if (mode === "platform") return "section_9_5";
  if (mode === "none" || !(gstAmount > 0)) return "bill_of_supply";
  return "tax_invoice";
}

export const INVOICE_LABELS: Record<InvoiceType, string> = {
  bill_of_supply: "Bill of Supply",
  tax_invoice: "Tax Invoice",
  section_9_5: "Invoice (GST paid by Sheplates under Section 9(5))",
};

// ---------------------------------------------------------------------------------------------------------------- bill
export type OrderItemBillingInput = { name: string; price: number; quantity: number; category?: string; gstRate?: number | null };

export type BillingSummary = {
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  gstMode: GstMode;
  invoiceType: InvoiceType;
  deliveryFee: number;
  deliveryDistanceKm: number | null;
  distanceKnown: boolean;
  isWithinRadius: boolean;
  isPickup: boolean;
  isThirdParty: boolean;
  serviceRadiusKm: number | null;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  commissionPercent: number;
  commissionAmount: number;
  /** What the vendor receives for this order: food + delivery fee (+ GST when the vendor is the one liable) minus commission. */
  vendorPayout: number;
  warningMessage?: string;
};

const money2 = (n: number) => Math.round(n * 100) / 100;

export function calculateBillingSummary(input: {
  items: OrderItemBillingInput[];
  mode?: string;
  customerCoords?: { latitude?: number | null; longitude?: number | null };
  vendorCoords?: { latitude?: number | null; longitude?: number | null };
  serviceRadiusKm?: number | null;
  vendorCustomFee?: number | null;
  /** A delivery fee already fixed at checkout (with the distance it was measured at). Payment uses it so the fee cannot change between checkout and payment. */
  fixedDelivery?: { fee: number; distanceKm?: number | null } | null;
  /** Vendor-wide GST rate set by Operations. A product's own rate still wins. */
  vendorGstRate?: number | null;
  gstMode?: GstMode | null;
  vendorCategory?: string;
  vendorPlan?: string | null;
  commissionPercentOverride?: number | null;
  discountAmount?: number;
  currency?: string;
}): BillingSummary {
  const category = input.vendorCategory;
  const gstMode = normalizeGstMode(input.gstMode, category);
  let subtotal = 0; let gst = 0; let weighted = 0;
  for (const item of input.items) {
    const qty = Math.max(0.001, Number(item.quantity || 1));
    const line = money2(Math.max(0, Number(item.price || 0)) * qty);
    subtotal += line;
    let rate = 0;
    if (gstMode !== "none") {
      if (item.gstRate != null && Number.isFinite(Number(item.gstRate))) rate = Math.max(0, Number(item.gstRate));
      else if (input.vendorGstRate != null && Number.isFinite(Number(input.vendorGstRate))) rate = Math.max(0, Number(input.vendorGstRate));
      else rate = CATEGORY_GST_RATES[item.category || category || ""] ?? DEFAULT_GST_RATE;
    }
    gst += money2(line * rate / 100); weighted += line * rate;
  }
  subtotal = money2(subtotal); gst = money2(gst);
  const effectiveRate = subtotal > 0 ? Math.round((weighted / subtotal) * 10) / 10 : 0;
  const kind = fulfilmentKind(input.mode || "vendor_delivery");
  const delivery: DeliveryFeeResult = input.fixedDelivery && kind === "vendor_delivery"
    ? { fee: Math.max(0, Number(input.fixedDelivery.fee) || 0), distanceKm: input.fixedDelivery.distanceKm ?? null, distanceKnown: input.fixedDelivery.distanceKm != null, isWithinRadius: true, isPickup: false, isThirdParty: false, serviceRadiusKm: input.serviceRadiusKm ?? null }
    : calculateDeliveryFee({ mode: input.mode || "vendor_delivery", customerCoords: input.customerCoords, vendorCoords: input.vendorCoords, serviceRadiusKm: input.serviceRadiusKm, vendorCustomFee: input.vendorCustomFee });
  const discount = Math.max(0, Math.min(subtotal + gst + delivery.fee, Number(input.discountAmount || 0)));
  const total = money2(Math.max(0, subtotal + gst + delivery.fee - discount));
  const commissionPercent = commissionPercentFor(category, input.commissionPercentOverride, input.vendorPlan);
  const commissionAmount = money2(subtotal * commissionPercent / 100);
  const vendorPayout = money2(subtotal + delivery.fee + (gstMode === "vendor" ? gst : 0) - commissionAmount);
  return {
    subtotal, gstRate: effectiveRate, gstAmount: gst, gstMode, invoiceType: invoiceTypeFor(gstMode, gst),
    deliveryFee: delivery.fee, deliveryDistanceKm: delivery.distanceKm, distanceKnown: delivery.distanceKnown,
    isWithinRadius: delivery.isWithinRadius, isPickup: delivery.isPickup, isThirdParty: delivery.isThirdParty, serviceRadiusKm: delivery.serviceRadiusKm,
    discountAmount: discount, totalAmount: total, currency: input.currency || "INR",
    commissionPercent, commissionAmount, vendorPayout, warningMessage: delivery.message,
  };
}

// ---------------------------------------------------------------------------------------------------------------- settlement
const dayMs = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Vendors are paid every Wednesday for the Monday to Sunday week before. For an order completed (or paid) on `dateISO`,
 * this returns that week and the Wednesday it is paid out on (the Wednesday after the week's Sunday).
 */
export function settlementFor(dateISO: string): { weekStart: string; weekEnd: string; payoutDate: string } {
  const d = new Date(`${dateISO.slice(0, 10)}T12:00:00Z`);
  const sinceMonday = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  const monday = new Date(d.getTime() - sinceMonday * dayMs);
  const sunday = new Date(monday.getTime() + 6 * dayMs);
  const wednesday = new Date(sunday.getTime() + 3 * dayMs);
  return { weekStart: isoDay(monday), weekEnd: isoDay(sunday), payoutDate: isoDay(wednesday) };
}
