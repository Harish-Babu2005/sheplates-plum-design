/**
 * ShePlates – GST and Dynamic Delivery Fee Integration
 * Reusable billing, tax, and delivery fee calculations for checkout, orders, and payment.
 */

export type DeliveryTier = {
  minKm: number;
  maxKm: number;
  fee: number;
};

export type DeliveryPricingConfig = {
  tiers: DeliveryTier[];
  defaultRadiusKm: number;
  fallbackDistanceKm: number;
  perAdditionalKmFee?: number;
};

// Initial configurable delivery pricing tiers inspired by food delivery apps:
// 0–2 km: ₹20
// Above 2 km and up to 5 km: ₹35
// Above 5 km and up to 8 km: ₹50
// Beyond vendor service radius: delivery unavailable
export const DEFAULT_DELIVERY_PRICING: DeliveryPricingConfig = {
  tiers: [
    { minKm: 0, maxKm: 2, fee: 20 },
    { minKm: 2, maxKm: 5, fee: 35 },
    { minKm: 5, maxKm: 8, fee: 50 },
  ],
  defaultRadiusKm: 8,
  fallbackDistanceKm: 1.5,
  perAdditionalKmFee: 10,
};

// Configurable GST rates by category (Indian GST on food / grocery services)
// Home food / restaurant food / snacks / bakery: 5% GST
// Fresh produce / unbranded groceries / eggs: 0% GST (nil rated)
// Pantry / packaged goods: 5% GST
export const CATEGORY_GST_RATES: Record<string, number> = {
  "Home food": 5,
  "Meals": 5,
  "Snacks": 5,
  "Bakery": 5,
  "Desserts": 5,
  "Breakfast": 5,
  "Beverages": 5,
  "Groceries": 0,
  "Rice & staples": 0,
  "Fresh produce": 0,
  "Eggs": 0,
  "Meat & fish": 0,
  "Pantry": 5,
  "Default": 5,
};

export const DEFAULT_GST_RATE = 5;

/**
 * Standard Haversine formula to compute great-circle distance between two GPS coordinates in kilometers.
 */
export function haversineDistanceKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null
): number | null {
  if (
    lat1 == null || lon1 == null || lat2 == null || lon2 == null ||
    !Number.isFinite(Number(lat1)) || !Number.isFinite(Number(lon1)) ||
    !Number.isFinite(Number(lat2)) || !Number.isFinite(Number(lon2))
  ) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = 6371 * c;
  return Math.round(km * 10) / 10;
}

export type DeliveryFeeResult = {
  fee: number;
  distanceKm: number | null;
  isWithinRadius: boolean;
  isPickup: boolean;
  isThirdParty: boolean;
  serviceRadiusKm: number;
  message?: string;
};

export function calculateDeliveryFee({
  mode,
  customerCoords,
  vendorCoords,
  serviceRadiusKm,
  vendorCustomFee,
  pricing = DEFAULT_DELIVERY_PRICING,
}: {
  mode: string;
  customerCoords?: { latitude?: number | null; longitude?: number | null };
  vendorCoords?: { latitude?: number | null; longitude?: number | null };
  serviceRadiusKm?: number | null;
  vendorCustomFee?: number | null;
  pricing?: DeliveryPricingConfig;
}): DeliveryFeeResult {
  const normalizedMode = String(mode || "Vendor delivery").toLowerCase();
  const isPickup = normalizedMode === "self pickup" || normalizedMode === "self_pickup" || normalizedMode === "pickup";
  const isThirdParty = normalizedMode === "third-party delivery" || normalizedMode === "third_party_delivery";
  const radius = serviceRadiusKm && serviceRadiusKm > 0 ? serviceRadiusKm : pricing.defaultRadiusKm;

  // 1. Pickup orders: Zero delivery fee
  if (isPickup) {
    return {
      fee: 0,
      distanceKm: null,
      isWithinRadius: true,
      isPickup: true,
      isThirdParty: false,
      serviceRadiusKm: radius,
    };
  }

  // 2. Third-party delivery orders: Customer coordinates & pays their courier directly
  if (isThirdParty) {
    return {
      fee: 0,
      distanceKm: null,
      isWithinRadius: true,
      isPickup: false,
      isThirdParty: true,
      serviceRadiusKm: radius,
    };
  }

  // 3. Vendor delivery: Compute distance
  const distance = haversineDistanceKm(
    customerCoords?.latitude,
    customerCoords?.longitude,
    vendorCoords?.latitude,
    vendorCoords?.longitude
  );

  // If distance could be calculated from coordinates
  if (distance !== null) {
    if (distance > radius) {
      return {
        fee: 0,
        distanceKm: distance,
        isWithinRadius: false,
        isPickup: false,
        isThirdParty: false,
        serviceRadiusKm: radius,
        message: `Delivery address is ${distance} km away, which exceeds the vendor's ${radius} km service radius.`,
      };
    }

    // Within service radius
    if (vendorCustomFee != null && vendorCustomFee >= 0) {
      return {
        fee: Math.round(vendorCustomFee * 100) / 100,
        distanceKm: distance,
        isWithinRadius: true,
        isPickup: false,
        isThirdParty: false,
        serviceRadiusKm: radius,
      };
    }

    // Match tier
    for (const tier of pricing.tiers) {
      if (distance >= tier.minKm && distance <= tier.maxKm) {
        return {
          fee: tier.fee,
          distanceKm: distance,
          isWithinRadius: true,
          isPickup: false,
          isThirdParty: false,
          serviceRadiusKm: radius,
        };
      }
    }

    // If beyond highest tier but within radius
    const highestTier = pricing.tiers[pricing.tiers.length - 1];
    const extraKm = Math.ceil(distance - highestTier.maxKm);
    const fee = highestTier.fee + (extraKm > 0 ? extraKm * (pricing.perAdditionalKmFee || 10) : 0);
    return {
      fee,
      distanceKm: distance,
      isWithinRadius: true,
      isPickup: false,
      isThirdParty: false,
      serviceRadiusKm: radius,
    };
  }

  // Missing or invalid coordinates fallback: safe default tier within radius
  const fallbackDistance = pricing.fallbackDistanceKm || 1.5;
  const fallbackFee = vendorCustomFee != null && vendorCustomFee >= 0 ? vendorCustomFee : (pricing.tiers[0]?.fee ?? 20);
  return {
    fee: fallbackFee,
    distanceKm: fallbackDistance,
    isWithinRadius: true,
    isPickup: false,
    isThirdParty: false,
    serviceRadiusKm: radius,
  };
}

export type OrderItemBillingInput = {
  name: string;
  price: number;
  quantity: number;
  category?: string;
  gstRate?: number;
};

export type BillingSummary = {
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  deliveryFee: number;
  deliveryDistanceKm: number | null;
  isWithinRadius: boolean;
  isPickup: boolean;
  isThirdParty: boolean;
  serviceRadiusKm: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  warningMessage?: string;
};

export function calculateBillingSummary({
  items,
  mode = "Vendor delivery",
  customerCoords,
  vendorCoords,
  serviceRadiusKm,
  vendorCustomFee,
  vendorGstRate,
  discountAmount = 0,
  currency = "INR",
}: {
  items: OrderItemBillingInput[];
  mode?: string;
  customerCoords?: { latitude?: number | null; longitude?: number | null };
  vendorCoords?: { latitude?: number | null; longitude?: number | null };
  serviceRadiusKm?: number | null;
  vendorCustomFee?: number | null;
  vendorGstRate?: number | null;
  discountAmount?: number;
  currency?: string;
}): BillingSummary {
  // 1. Calculate item subtotal and GST
  let subtotal = 0;
  let totalGstAmount = 0;
  let totalWeightedRateNumerator = 0;

  for (const item of items) {
    const qty = Math.max(0.001, Number(item.quantity || 1));
    const price = Math.max(0, Number(item.price || 0));
    const lineTotal = Math.round(price * qty * 100) / 100;
    subtotal += lineTotal;

    // Rate resolution: item-specific -> vendor-specific -> category -> default
    let rate = DEFAULT_GST_RATE;
    if (item.gstRate != null && Number.isFinite(item.gstRate)) {
      rate = Math.max(0, Number(item.gstRate));
    } else if (vendorGstRate != null && Number.isFinite(vendorGstRate)) {
      rate = Math.max(0, Number(vendorGstRate));
    } else if (item.category && CATEGORY_GST_RATES[item.category] !== undefined) {
      rate = CATEGORY_GST_RATES[item.category];
    } else {
      rate = CATEGORY_GST_RATES.Default ?? DEFAULT_GST_RATE;
    }

    const itemGst = Math.round(lineTotal * (rate / 100) * 100) / 100;
    totalGstAmount += itemGst;
    totalWeightedRateNumerator += lineTotal * rate;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  totalGstAmount = Math.round(totalGstAmount * 100) / 100;
  const effectiveGstRate = subtotal > 0
    ? Math.round((totalWeightedRateNumerator / subtotal) * 10) / 10
    : DEFAULT_GST_RATE;

  // 2. Calculate Delivery Fee
  const delivery = calculateDeliveryFee({
    mode,
    customerCoords,
    vendorCoords,
    serviceRadiusKm,
    vendorCustomFee,
  });

  // 3. Discount
  const discount = Math.max(0, Math.min(subtotal + totalGstAmount + delivery.fee, Number(discountAmount || 0)));

  // 4. Total Amount
  const totalAmount = Math.round(Math.max(0, subtotal + totalGstAmount + delivery.fee - discount) * 100) / 100;

  return {
    subtotal,
    gstRate: effectiveGstRate,
    gstAmount: totalGstAmount,
    deliveryFee: delivery.fee,
    deliveryDistanceKm: delivery.distanceKm,
    isWithinRadius: delivery.isWithinRadius,
    isPickup: delivery.isPickup,
    isThirdParty: delivery.isThirdParty,
    serviceRadiusKm: delivery.serviceRadiusKm,
    discountAmount: discount,
    totalAmount,
    currency,
    warningMessage: delivery.message,
  };
}

