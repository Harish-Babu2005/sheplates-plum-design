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

export const MEAL_NAMES = MEAL_LABEL;
