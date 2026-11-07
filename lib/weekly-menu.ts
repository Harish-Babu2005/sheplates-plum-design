/**
 * Home-food weekly menu. A home chef cooks a different menu each weekday, in up to three meals, as separate veg and non-veg plans.
 * - The PRICE belongs to a plan: one product per meal and diet (for example "Veg Lunch plan"), the same flat price every day.
 *   That product is what the customer buys, so checkout, payment, GST and settlement work exactly as for any other product.
 * - The DISHES belong to a weekday: what the chef cooks in that plan on that day. Customers see them before they order.
 * A customer can order one day, subscribe to chosen weekdays, or subscribe to the whole week, always starting tomorrow or later.
 */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_NAMES: Record<Weekday, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export const DIETS = ["veg", "non_veg"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type Meal = (typeof MEALS)[number];
export type Diet = (typeof DIETS)[number];
export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
export const DIET_LABEL: Record<Diet, string> = { veg: "Veg", non_veg: "Non-veg" };
export const MAX_DISHES = 12, MAX_DISH_LENGTH = 60;

/** `price` is what the chef earns for that day's plan (before Sheplates adds its markup). */
export type MenuCell = { id?: string; vendorId: string; weekday: Weekday; meal: Meal; diet: Diet; dishes: string[]; open: boolean; price?: number | null };

/** The catalogue name of the plan product. It is how the plan is found again, so it is always built from this one function. */
export const planName = (meal: Meal, diet: Diet) => `${DIET_LABEL[diet]} ${MEAL_LABEL[meal].toLowerCase()} plan`;
export function parsePlanName(name: string): { meal: Meal; diet: Diet } | null {
  for (const meal of MEALS) for (const diet of DIETS) if (planName(meal, diet).toLowerCase() === String(name || "").trim().toLowerCase()) return { meal, diet };
  return null;
}

/** One dish per line (or comma separated). Blank lines and repeats are dropped; very long lines are cut. */
export function normalizeDishes(input: string | string[]): string[] {
  const parts = (Array.isArray(input) ? input : String(input || "").split(/[\n,]+/)).map((d) => d.replace(/\s+/g, " ").trim().slice(0, MAX_DISH_LENGTH)).filter(Boolean);
  const seen = new Set<string>();
  return parts.filter((d) => (seen.has(d.toLowerCase()) ? false : (seen.add(d.toLowerCase()), true))).slice(0, MAX_DISHES);
}

export function cellFor(menus: MenuCell[], vendorId: string, weekday: Weekday, meal: Meal, diet: Diet): MenuCell | undefined {
  return menus.find((c) => c.vendorId === vendorId && c.weekday === weekday && c.meal === meal && c.diet === diet);
}
/** A day can be ordered only when the chef opened it and listed at least one dish. */
export const isOrderable = (cell?: MenuCell) => Boolean(cell && cell.open && cell.dishes.length > 0);
export function orderableDays(menus: MenuCell[], vendorId: string, meal: Meal, diet: Diet): Weekday[] {
  return WEEKDAYS.filter((day) => isOrderable(cellFor(menus, vendorId, day, meal, diet)));
}
export function plansOffered(menus: MenuCell[], vendorId: string): { meal: Meal; diet: Diet }[] {
  return MEALS.flatMap((meal) => DIETS.map((diet) => ({ meal, diet }))).filter((p) => orderableDays(menus, vendorId, p.meal, p.diet).length > 0);
}

export const weekdayOfDate = (dateISO: string): Weekday => (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[new Date(`${dateISO}T12:00:00Z`).getUTCDay()];
export function addDays(dateISO: string, days: number) { const d = new Date(`${dateISO}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
/** The first date on or after `fromISO` that falls on `weekday`. Pass tomorrow as `fromISO`: nothing is ever ordered for today. */
export function nextDateForWeekday(weekday: Weekday, fromISO: string): string {
  for (let i = 0; i < 7; i++) { const date = addDays(fromISO, i); if (weekdayOfDate(date) === weekday) return date; }
  return fromISO;
}

export type PlanChoice = { startDate: string; recurrence: "Once" | "Weekly" | "Custom"; weekdays: Weekday[] };
/** What the customer chose, turned into the schedule the existing order dialog already understands. */
export function planChoice(kind: "single_day" | "weekly_day" | "whole_week", weekday: Weekday, openDays: Weekday[], tomorrowISO: string): PlanChoice {
  if (kind === "whole_week") { const days = openDays.length ? openDays : [weekday]; const start = days.map((d) => nextDateForWeekday(d, tomorrowISO)).sort()[0]; return { startDate: start, recurrence: "Custom", weekdays: days }; }
  const start = nextDateForWeekday(weekday, tomorrowISO);
  return kind === "single_day" ? { startDate: start, recurrence: "Once", weekdays: [] } : { startDate: start, recurrence: "Weekly", weekdays: [weekday] };
}

/** The dishes of one day for the order, so the kitchen and the customer both read what was promised. */
export function describeOrderDishes(cell?: MenuCell): string { return cell?.dishes.length ? cell.dishes.join(", ") : ""; }

export function validateCell(input: { dishes: string[]; open: boolean }): string | null {
  if (input.open && input.dishes.length === 0) return "Add at least one dish, or switch the day off.";
  return null;
}
export function validatePlanPrice(price: number): string | null {
  return !Number.isFinite(price) || price < 10 || price > 5000 ? "The plan price must be between ₹10 and ₹5,000." : null;
}

/** Each day has its own price. A day that is cooking needs a valid one. */
export function validateDayPrice(price: number): string | null {
  return !Number.isFinite(price) || price < 10 || price > 5000 ? "enter a price between ₹10 and ₹5,000" : null;
}
/** The price a day is sold at: its own price, or the plan's lowest price when the chef has not set one. */
export function dayPrice(cell: MenuCell | undefined, fallback: number): number { return cell?.price != null && Number.isFinite(Number(cell.price)) ? Number(cell.price) : fallback; }
export const withMarkup = (base: number, markupPercent: number) => Math.round(base * (1 + Math.max(0, markupPercent) / 100) * 100) / 100;

const PLAN_ORDER_LABEL = /^(Veg|Non-veg) (breakfast|lunch|dinner) plan · (Mon|Tue|Wed|Thu|Fri|Sat|Sun): /i;
/** What to print for an order's item: a home-food plan order carries that day's dishes, everything else keeps the product name. */
export function orderItemLabel(productName: string | undefined, description: string | undefined): string {
  if (description && PLAN_ORDER_LABEL.test(description)) return description;
  return productName || description || "Item";
}
