// Food Drops — vendor-created, time-limited offers on an existing product.
// Pure, deterministic helpers only: no AI, no randomness. The actual
// overselling guard lives in the database (see
// supabase/V9_12_PLANS_AND_DAILY_FOOD_DROPS.sql's claim_food_drop()), called
// during checkout after an item has been added to the normal customer cart.
// This module only formats and derives display state from server data.

export type FoodDrop = {
  id: string;
  vendorId: string;
  productId: string;
  title: string;
  description?: string;
  dropPrice: number;
  originalPrice: number;
  totalQuantity: number;
  remainingQuantity: number;
  startsAt: string;
  endsAt: string;
  status: "active" | "cancelled";
};

export type FoodDropClaim = {
  id: string;
  dropId: string;
  customerEmail: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  claimedAt: string;
};

export type DropDisplayStatus = "scheduled" | "live" | "sold_out" | "ended" | "cancelled";

const FOOD_DROP_TIME_ZONE_OFFSET_MS = 330 * 60_000;
const FOOD_DROP_OPEN_HOUR = 12;
const FOOD_DROP_CLOSE_HOUR = 18;
const FOOD_DROP_WINDOW_MS = 6 * 60 * 60_000;

function istClock(now: Date) {
  return new Date(now.getTime() + FOOD_DROP_TIME_ZONE_OFFSET_MS);
}

function istOpeningFor(now: Date) {
  const local = istClock(now);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), FOOD_DROP_OPEN_HOUR) - FOOD_DROP_TIME_ZONE_OFFSET_MS);
}

export function isFoodDropPurchaseWindow(now: Date = new Date()): boolean {
  const hour = istClock(now).getUTCHours();
  return hour >= FOOD_DROP_OPEN_HOUR && hour < FOOD_DROP_CLOSE_HOUR;
}

export function nextFoodDropWindow(now: Date = new Date()): { startsAt: Date; endsAt: Date } {
  const startsAt = istOpeningFor(now);
  const endsAt = new Date(startsAt.getTime() + FOOD_DROP_WINDOW_MS);
  if (isFoodDropPurchaseWindow(now)) startsAt.setTime(now.getTime());
  return { startsAt, endsAt };
}

/** A drop is claimable from 12 PM until 6 PM IST. Legacy DB records with 8 PM trigger are normalized. */
export function normalizeDropWindow(drop: FoodDrop): { startsAt: Date; endsAt: Date } {
  const start = new Date(drop.startsAt);
  const end = new Date(drop.endsAt);
  const istStart = istClock(start);
  if (istStart.getUTCHours() >= 18) {
    const correctedStart = new Date(Date.UTC(istStart.getUTCFullYear(), istStart.getUTCMonth(), istStart.getUTCDate(), FOOD_DROP_OPEN_HOUR) - FOOD_DROP_TIME_ZONE_OFFSET_MS);
    const correctedEnd = new Date(correctedStart.getTime() + FOOD_DROP_WINDOW_MS);
    return { startsAt: correctedStart, endsAt: correctedEnd };
  }
  return { startsAt: start, endsAt: end };
}

export function foodDropSchedule(drop: FoodDrop): { startsAt: Date; endsAt: Date } {
  return normalizeDropWindow(drop);
}

export function dropDisplayStatus(drop: FoodDrop, now: Date = new Date()): DropDisplayStatus {
  if (drop.status === "cancelled") return "cancelled";
  if (drop.remainingQuantity <= 0) return "sold_out";
  const { startsAt, endsAt } = normalizeDropWindow(drop);
  const t = now.getTime();
  if (t < startsAt.getTime()) return "scheduled";
  if (t >= endsAt.getTime()) return "ended";
  return "live";
}

export function discountPercent(drop: Pick<FoodDrop, "dropPrice" | "originalPrice">): number {
  if (drop.originalPrice <= 0) return 0;
  return Math.round((1 - drop.dropPrice / drop.originalPrice) * 100);
}

export function claimedPercent(drop: Pick<FoodDrop, "totalQuantity" | "remainingQuantity">): number {
  if (drop.totalQuantity <= 0) return 0;
  return Math.round(((drop.totalQuantity - drop.remainingQuantity) / drop.totalQuantity) * 100);
}

/** Displays every second so the daily closing countdown stays live. */
export function formatCountdown(targetIso: string, now: Date = new Date()): string {
  const ms = new Date(targetIso).getTime() - now.getTime();
  if (ms <= 0) return "Ended";
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  if (days > 0) return `${days}d ${clock}`;
  if (hours > 0) return clock;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
