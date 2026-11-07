import type { SupabaseClient } from "@supabase/supabase-js";
import { MEAL_LABEL, WEEKDAYS, parsePlanName, weekdayOfDate, withMarkup, type Diet, type Meal, type Weekday } from "./weekly-menu.ts";

/**
 * Server-side pricing of home-food plans. Every plan day has its own price, so a subscription is priced date by date from the
 * chef's weekly menu, never from what the browser sends. Days the chef is not cooking are never sold or scheduled.
 */
export type PlanCell = { weekday: Weekday; price: number | null; dishes: string[]; open: boolean };
export type PlanContext = { meal: Meal; diet: Diet; cells: PlanCell[]; fallbackBase: number };
export type PricedDay = { date: string; weekday: Weekday; baseUnit: number; customerUnit: number; dishes: string[]; label: string };

export const dayLabel = (name: string, weekday: Weekday, dishes: string[]) => `${name} · ${weekday}: ${dishes.join(", ")}`.slice(0, 220);

export function priceDeliveries(dates: string[], ctx: PlanContext, name: string, markupPercent: number): { days: PricedDay[]; skipped: string[] } {
  const days: PricedDay[] = [], skipped: string[] = [];
  for (const date of dates) {
    const weekday = weekdayOfDate(date);
    const cell = ctx.cells.find((c) => c.weekday === weekday);
    if (!cell || !cell.open || cell.dishes.length === 0) { skipped.push(date); continue; }
    const baseUnit = cell.price != null ? Number(cell.price) : ctx.fallbackBase;
    days.push({ date, weekday, baseUnit, customerUnit: withMarkup(baseUnit, markupPercent), dishes: cell.dishes, label: dayLabel(name, weekday, cell.dishes) });
  }
  return { days, skipped };
}

type Row = { weekday: string; dishes: string[] | null; is_open: boolean | null; price?: number | string | null };
export async function loadPlanContext(admin: SupabaseClient, vendorId: string, productName: string, fallbackBase: number): Promise<PlanContext | null> {
  const parsed = parsePlanName(productName);
  if (!parsed) return null;
  const query = (columns: string) => admin.from("home_menu_days").select(columns).eq("vendor_id", vendorId).eq("meal", parsed.meal).eq("diet", parsed.diet);
  let result = await query("weekday,dishes,is_open,price");
  if (result.error && /price/i.test(result.error.message || "")) result = await query("weekday,dishes,is_open"); // V9_26 not applied yet: flat price
  if (result.error || !result.data?.length) return null; // table missing or no menu: sold as an ordinary flat-price product
  const cells = (result.data as unknown as Row[]).filter((r) => (WEEKDAYS as readonly string[]).includes(r.weekday)).map((r) => ({ weekday: r.weekday as Weekday, price: r.price == null ? null : Number(r.price), dishes: r.dishes || [], open: r.is_open !== false }));
  return { ...parsed, cells, fallbackBase };
}

export type SchedulePricing = { name: string; markupPercent: number; quantity: number; days: (PricedDay & { baseTotal: number; customerTotal: number })[]; skipped: string[]; total: number };

/** Prices the given delivery dates of a plan product. Returns null when the product is not a plan with a weekly menu. */
export async function planPricing(admin: SupabaseClient, input: { menuItemId: string; vendorId: string; name: string; basePrice: number; quantity: number; dates: string[] }): Promise<SchedulePricing | null> {
  const ctx = await loadPlanContext(admin, input.vendorId, input.name, input.basePrice);
  if (!ctx) return null;
  const markup = await admin.from("vendor_item_markups").select("markup_percent").eq("menu_item_id", input.menuItemId).maybeSingle();
  const markupPercent = Math.max(0, Number((markup.data as { markup_percent?: number } | null)?.markup_percent || 0));
  const { days, skipped } = priceDeliveries(input.dates, ctx, input.name, markupPercent);
  const quantity = Math.max(0.001, input.quantity);
  const lines = days.map((d) => ({ ...d, baseTotal: Math.round(d.baseUnit * quantity * 100) / 100, customerTotal: Math.round(d.customerUnit * quantity * 100) / 100 }));
  return { name: input.name, markupPercent, quantity, days: lines, skipped, total: Math.round(lines.reduce((sum, d) => sum + d.customerTotal, 0) * 100) / 100 };
}

/** Same, for a schedule that already exists. */
export async function planPricingForSchedule(admin: SupabaseClient, scheduleId: string, dates: string[]): Promise<SchedulePricing | null> {
  const schedule = await admin.from("product_schedules").select("menu_item_id,quantity").eq("id", scheduleId).maybeSingle();
  const s = schedule.data as { menu_item_id?: string; quantity?: number } | null;
  if (!s?.menu_item_id) return null;
  const item = await admin.from("vendor_menu_items").select("id,vendor_id,name,vendor_base_price").eq("id", s.menu_item_id).maybeSingle();
  const m = item.data as { id: string; vendor_id: string; name: string; vendor_base_price: number } | null;
  if (!m) return null;
  return planPricing(admin, { menuItemId: m.id, vendorId: m.vendor_id, name: m.name, basePrice: Number(m.vendor_base_price), quantity: Number(s.quantity || 1), dates });
}
export const MEAL_NAMES = MEAL_LABEL;
