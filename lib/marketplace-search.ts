// Shared search service for Sheplates customer marketplace
// Used by both the top search bar (dropdown) and the full results page (/ ?view=Search).

import type { Product, Vendor } from "@/components/sheplates-v3";

export interface CustomerLocationProfile {
  latitude?: number;
  longitude?: number;
  address?: string;
  allergies?: string[];
}

export interface MatchedCategory {
  name: string;
  emoji: string;
  color: string;
  count: number;
}

export interface MarketplaceSearchResults {
  query: string;
  products: Product[];
  vendors: Vendor[];
  categories: MatchedCategory[];
  totalCount: number;
}

export interface MarketplaceSearchOptions {
  category?: string;
  maxPrice?: number;
  maxCalories?: number;
  minProtein?: number;
  dietary?: string;
  vendorFilter?: string;
  sortBy?: "Recommended" | "Price low" | "Protein high" | "Calories low" | "Nearest";
  markups?: Record<string, number>;
  /** Optional delay simulation in ms for testing slow requests */
  simulateDelayMs?: number;
  /** Optional flag to simulate network or server failure */
  simulateFailure?: boolean;
}

export const MARKETPLACE_CATEGORIES = [
  { name: "Milk & dairy", emoji: "🥛", color: "#E9F2F8" },
  { name: "Home food", emoji: "🍱", color: "#EAF4F2" },
  { name: "Caterer", emoji: "🍽️", color: "#EAF4F2" },
  { name: "Meat & fish", emoji: "🍗", color: "#EEEFF1" },
  { name: "Vegetables", emoji: "🥬", color: "#E4F3EA" },
  { name: "Groceries", emoji: "🛍️", color: "#ECEEF4" },
  { name: "Eggs", emoji: "🥚", color: "#EAF5E4" },
  { name: "Bakery", emoji: "🥖", color: "#EDF1F1" },
  { name: "Snacks", emoji: "🍿", color: "#E6F4EE" },
  { name: "Rice & staples", emoji: "🍚", color: "#EEF0EF" },
  { name: "Other", emoji: "📦", color: "#EAF4F2" },
];

export function distanceKm(aLat?: number, aLng?: number, bLat?: number, bLng?: number): number | null {
  if (!Number.isFinite(aLat) || !Number.isFinite(aLng) || !Number.isFinite(bLat) || !Number.isFinite(bLng)) return null;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat! - aLat!);
  const dLng = toRad(bLng! - aLng!);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat!)) * Math.cos(toRad(bLat!)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compute customer final price for a product */
export function calculateFinalPrice(product: Product, markups: Record<string, number> = {}): number {
  const markupPercent = markups[product.id] ?? 0;
  return Math.round(product.vendorPrice * (1 + markupPercent / 100) * 100) / 100;
}

/** Check if customer location is confirmed with valid coordinates */
export function isLocationConfirmed(profile?: CustomerLocationProfile | null): boolean {
  if (!profile) return false;
  return Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude);
}

/** Check if a product is serviceable based on marketplace rules */
export function isServiceableProduct(
  product: Product,
  vendor: Vendor | undefined,
  profile?: CustomerLocationProfile | null
): boolean {
  if (!isLocationConfirmed(profile) || !vendor) return false;
  if (!product.active || product.stock <= 0) return false;
  if (vendor.verification !== "Verified" || vendor.operational !== "Active" || !vendor.openToday) {
    return false;
  }

  const distance = product.liveDistanceKm ?? distanceKm(profile!.latitude, profile!.longitude, vendor.latitude, vendor.longitude);
  if (distance === null || distance > vendor.radiusKm) {
    return false;
  }

  if (profile?.allergies && profile.allergies.length > 0) {
    const allergyText = `${product.name} ${product.dietaryTags.join(" ")}`.toLowerCase();
    const hasConflict = profile.allergies.some((allergy) => allergy && allergyText.includes(allergy.toLowerCase()));
    if (hasConflict) return false;
  }

  return true;
}

/** Check if a vendor is serviceable based on marketplace rules */
export function isServiceableVendor(
  vendor: Vendor,
  profile?: CustomerLocationProfile | null
): boolean {
  if (!isLocationConfirmed(profile)) return false;
  const distance = distanceKm(profile!.latitude, profile!.longitude, vendor.latitude, vendor.longitude);
  return (
    vendor.verification === "Verified" &&
    vendor.operational === "Active" &&
    vendor.openToday &&
    distance !== null &&
    distance <= vendor.radiusKm
  );
}

/** Filter products to only verified, open and serviceable ones near the customer */
export function getServiceableProducts(
  products: Product[],
  vendors: Vendor[],
  profile?: CustomerLocationProfile | null
): Product[] {
  if (!isLocationConfirmed(profile)) return [];
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  return products.filter((product) => {
    const vendor = vendorMap.get(product.vendorId);
    return isServiceableProduct(product, vendor, profile);
  });
}

/** Filter vendors to only verified, open and serviceable ones near the customer */
export function getServiceableVendors(
  vendors: Vendor[],
  serviceableProducts: Product[],
  profile?: CustomerLocationProfile | null
): Vendor[] {
  if (!isLocationConfirmed(profile)) return [];
  const activeVendorIds = new Set(serviceableProducts.map((p) => p.vendorId));

  return vendors
    .filter((vendor) => {
      const distance = distanceKm(profile!.latitude, profile!.longitude, vendor.latitude, vendor.longitude);
      const isEligible =
        vendor.verification === "Verified" &&
        vendor.operational === "Active" &&
        vendor.openToday &&
        distance !== null &&
        distance <= vendor.radiusKm;
      return isEligible && activeVendorIds.has(vendor.id);
    })
    .sort((a, b) => {
      const distA = distanceKm(profile!.latitude, profile!.longitude, a.latitude, a.longitude) ?? 999;
      const distB = distanceKm(profile!.latitude, profile!.longitude, b.latitude, b.longitude) ?? 999;
      return distA - distB;
    });
}

/** Normalize query string for Unicode and case-insensitive matching */
function normalizeText(text: string): string {
  return text.normalize("NFC").toLowerCase().trim();
}

/**
 * Shared search function used by both the Top Search Bar and the full Search page.
 * Returns matching products (first), kitchens/vendors (second), and categories (third).
 */
export async function searchMarketplace(
  rawQuery: string,
  products: Product[],
  vendors: Vendor[],
  profile?: CustomerLocationProfile | null,
  options: MarketplaceSearchOptions = {}
): Promise<MarketplaceSearchResults> {
  if (options.simulateFailure) {
    if (options.simulateDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.simulateDelayMs));
    }
    throw new Error("Search service temporarily unavailable");
  }

  if (options.simulateDelayMs && options.simulateDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, options.simulateDelayMs));
  }

  const query = normalizeText(rawQuery);
  const serviceableProducts = getServiceableProducts(products, vendors, profile);
  const serviceableVendors = getServiceableVendors(vendors, serviceableProducts, profile);
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  // 1. MATCH PRODUCTS
  const matchedProducts = serviceableProducts.filter((product) => {
    const vendor = vendorMap.get(product.vendorId);
    const vendorName = vendor?.businessName || "";
    const description = product.description || "";
    const dietaryText = product.dietaryTags.join(" ");

    // Match query against: product name, description, category, kitchen/vendor name, dietary tag
    if (query) {
      const matchName = normalizeText(product.name).includes(query);
      const matchDesc = normalizeText(description).includes(query);
      const matchCategory = normalizeText(product.category).includes(query);
      const matchVendor = normalizeText(vendorName).includes(query);
      const matchDietary = product.dietaryTags.some((tag) => normalizeText(tag).includes(query)) || normalizeText(dietaryText).includes(query);

      if (!matchName && !matchDesc && !matchCategory && !matchVendor && !matchDietary) {
        return false;
      }
    }

    // Secondary filters (used by results page if specified)
    if (options.category && options.category !== "All" && normalizeText(product.category) !== normalizeText(options.category)) {
      return false;
    }
    if (options.vendorFilter && product.vendorId !== options.vendorFilter) {
      return false;
    }
    if (options.maxPrice && options.maxPrice > 0) {
      const price = calculateFinalPrice(product, options.markups);
      if (price > options.maxPrice) return false;
    }
    if (options.maxCalories && options.maxCalories > 0 && product.calories > options.maxCalories) {
      return false;
    }
    if (options.minProtein && options.minProtein > 0 && product.protein < options.minProtein) {
      return false;
    }
    if (options.dietary && options.dietary !== "All") {
      const target = normalizeText(options.dietary);
      const hasTag = product.dietaryTags.some((t) => normalizeText(t) === target);
      const matchesFoodType = product.foodType && normalizeText(product.foodType) === target;
      if (!hasTag && !matchesFoodType) return false;
    }

    return true;
  });

  // Sort products
  if (options.sortBy === "Price low") {
    matchedProducts.sort((a, b) => calculateFinalPrice(a, options.markups) - calculateFinalPrice(b, options.markups));
  } else if (options.sortBy === "Protein high") {
    matchedProducts.sort((a, b) => b.protein - a.protein);
  } else if (options.sortBy === "Calories low") {
    matchedProducts.sort((a, b) => a.calories - b.calories);
  } else if (options.sortBy === "Nearest") {
    matchedProducts.sort((a, b) => (a.liveDistanceKm || 999) - (b.liveDistanceKm || 999));
  }

  // 2. MATCH KITCHENS / VENDORS
  const matchedVendors = serviceableVendors.filter((vendor) => {
    if (!query) return true;
    const matchName = normalizeText(vendor.businessName).includes(query);
    const matchCategory = normalizeText(vendor.category).includes(query);
    const matchBio = vendor.bio ? normalizeText(vendor.bio).includes(query) : false;
    // Also include vendor if they offer a matching product
    const offersMatchingProduct = serviceableProducts.some(
      (p) => p.vendorId === vendor.id && (
        normalizeText(p.name).includes(query) ||
        (p.description && normalizeText(p.description).includes(query)) ||
        p.dietaryTags.some((t) => normalizeText(t).includes(query))
      )
    );
    return matchName || matchCategory || matchBio || offersMatchingProduct;
  });

  // 3. MATCH CATEGORIES
  const matchedCategories: MatchedCategory[] = [];
  if (query) {
    for (const cat of MARKETPLACE_CATEGORIES) {
      const catNameNorm = normalizeText(cat.name);
      const catMatches = catNameNorm.includes(query);
      const count = serviceableProducts.filter((p) => normalizeText(p.category) === catNameNorm).length;

      if (catMatches || (count > 0 && query.length >= 2 && catNameNorm.startsWith(query))) {
        matchedCategories.push({
          name: cat.name,
          emoji: cat.emoji,
          color: cat.color,
          count,
        });
      }
    }
  }

  return {
    query: rawQuery,
    products: matchedProducts,
    vendors: matchedVendors,
    categories: matchedCategories,
    totalCount: matchedProducts.length + matchedVendors.length + matchedCategories.length,
  };
}
