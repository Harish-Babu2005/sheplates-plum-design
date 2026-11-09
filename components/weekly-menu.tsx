"use client";
// Home-food weekly menu. Vendor side: price each plan once, then write what is cooked on each weekday.
// Customer side (WeeklyMenuTab): see the week, then order one day, subscribe to a weekday, or subscribe to the whole week.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FoodTypeMark } from "@/components/food-type-mark";
import { errorMessage } from "@/lib/error-message";
import { isLiveSupabaseMode, saveLiveVendorProduct, saveLiveWeeklyMenuCells, updateLivePlanProduct } from "@/lib/supabase";
import { DIETS, DIET_LABEL, MAX_DISHES, MEALS, MEAL_LABEL, WEEKDAYS, WEEKDAY_NAMES, cellFor, isOrderable, dayPrice, normalizeDishes, orderableDays, planChoice, planName, plansOffered, validateDayPrice, withMarkup, type Diet, type Meal, type MenuCell, type PlanChoice, type Weekday } from "@/lib/weekly-menu";
import type { Product, V3State, Vendor } from "@/components/sheplates-v3";

type SetState = React.Dispatch<React.SetStateAction<V3State>>;
const chip = (on: boolean) => `h-10 rounded-full px-4 text-sm font-bold transition ${on ? "bg-[#155F65] text-white" : "bg-white text-[#202827] ring-1 ring-stone-200 hover:bg-stone-50"}`;
const field = "w-full rounded-2xl border border-stone-200 bg-white p-3 text-sm outline-none focus:border-[#155F65] focus:ring-2 focus:ring-[#155F65]/10";
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export function planProductOf(products: Product[], vendorId: string, meal: Meal, diet: Diet) {
  const name = planName(meal, diet).toLowerCase();
  return products.find((p) => p.vendorId === vendorId && p.name.trim().toLowerCase() === name);
}

/* ---------------------------------------- Vendor ---------------------------------------- */
export function WeeklyMenuManager({ vendor, state, setState }: { vendor: Vendor; state: V3State; setState: SetState }) {
  const [meal, setMeal] = useState<Meal>("lunch"), [diet, setDiet] = useState<Diet>("veg");
  if (vendor.category !== "Home food") return <div className="rounded-3xl bg-white p-8 text-center"><h2 className="text-lg font-black">Weekly menu is for home-food kitchens</h2><p className="mt-2 text-sm text-[#55656A]">Your store is listed under {vendor.category}. Use the Catalog to add your items.</p></div>;
  // Re-keyed by meal and diet so each plan starts from its own saved values.
  return <div className="space-y-5">
    <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#155F65]">HOME FOOD</p><h1 className="text-2xl font-black text-[#202827]">Weekly menu</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[#55656A]">Set a price for each plan, then write what you cook on each day. Customers see the whole week and can order one day, a weekday every week, or the full week, starting from tomorrow.</p></div>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Meal">{MEALS.map((m) => <button key={m} type="button" aria-pressed={meal === m} onClick={() => setMeal(m)} className={chip(meal === m)}>{MEAL_LABEL[m]}</button>)}<span className="mx-1 h-6 w-px bg-stone-300" />{DIETS.map((d) => <button key={d} type="button" aria-pressed={diet === d} onClick={() => setDiet(d)} className={chip(diet === d)}>{DIET_LABEL[d]}</button>)}</div>
    <PlanEditor key={`${meal}-${diet}`} vendor={vendor} state={state} setState={setState} meal={meal} diet={diet} />
  </div>;
}

function PlanEditor({ vendor, state, setState, meal, diet }: { vendor: Vendor; state: V3State; setState: SetState; meal: Meal; diet: Diet }) {
  const menus = state.weeklyMenus || [];
  const product = planProductOf(state.products, vendor.id, meal, diet);
  type Draft = { open: boolean; text: string; price: string };
  const [draft, setDraft] = useState<Record<Weekday, Draft>>(() => Object.fromEntries(WEEKDAYS.map((d) => { const c = cellFor(menus, vendor.id, d, meal, diet); return [d, { open: c ? c.open : true, text: (c?.dishes || []).join("\n"), price: c?.price != null ? String(c.price) : product && c ? String(product.vendorPrice) : "" }]; })) as Record<Weekday, Draft>);
  const [sameFor, setSameFor] = useState("");
  const [busy, setBusy] = useState(false);
  const isCooking = (d: Weekday) => draft[d].open && normalizeDishes(draft[d].text).length > 0;
  const filledDays = WEEKDAYS.filter(isCooking).length;
  const set = (day: Weekday, patch: Partial<Draft>) => setDraft((cur) => ({ ...cur, [day]: { ...cur[day], ...patch } }));
  const copyToAll = (from: Weekday) => { setDraft((cur) => Object.fromEntries(WEEKDAYS.map((d) => [d, d === from ? cur[d] : { ...cur[d], text: cur[from].text, open: cur[from].open }])) as typeof cur); toast.success(`${WEEKDAY_NAMES[from]}'s dishes copied to every day. Prices stay as they are. Change any day you like, then save.`); };
  const applyPrice = () => { const error = validateDayPrice(Number(sameFor)); if (error) return void toast.error(`Price: ${error}.`); setDraft((cur) => Object.fromEntries(WEEKDAYS.map((d) => [d, { ...cur[d], price: sameFor }])) as typeof cur); toast.success(`₹${sameFor} set for every day. You can still change any day.`); };

  async function save() {
    for (const d of WEEKDAYS) if (isCooking(d)) { const error = validateDayPrice(Number(draft[d].price)); if (error) return void toast.error(`${WEEKDAY_NAMES[d]}: ${error}.`); }
    const prices = WEEKDAYS.filter(isCooking).map((d) => Number(draft[d].price));
    setBusy(true);
    try {
      const live = isLiveSupabaseMode();
      const on = vendor.verification === "Verified" && filledDays > 0;
      // The catalogue product carries the plan's lowest day price (shown as "from") and is the fallback for a day without its own price.
      const lowest = prices.length ? Math.min(...prices) : product?.vendorPrice ?? 0;
      let plan = product;
      if (plan) { if (live) await updateLivePlanProduct(plan.id, { price: lowest || plan.vendorPrice, active: on }); plan = { ...plan, vendorPrice: lowest || plan.vendorPrice, active: on }; }
      else if (filledDays > 0) {
        const productId = live ? await saveLiveVendorProduct({ vendorId: vendor.id, name: planName(meal, diet), category: "Home food", unit: "meal", price: lowest, stock: 999, active: on, calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, dietaryTags: [], packAmount: 1, packMeasure: "meal", foodType: diet === "veg" ? "veg" : "non_veg", nutritionStatus: "pending_review" }) : newId("PRD");
        plan = { id: productId, vendorId: vendor.id, name: planName(meal, diet), category: "Home food", emoji: "🍱", baseUnit: "meal", quantityStep: 1, vendorPrice: lowest, stock: 999, active: on, calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, dietaryTags: [], nutritionStatus: "Pending review", foodType: diet === "veg" ? "veg" : "non_veg" };
      }
      const cells: MenuCell[] = WEEKDAYS.map((d) => ({ vendorId: vendor.id, weekday: d, meal, diet, dishes: normalizeDishes(draft[d].text), open: isCooking(d), price: Number.isFinite(Number(draft[d].price)) && draft[d].price !== "" ? Number(draft[d].price) : null }));
      if (live) await saveLiveWeeklyMenuCells(cells);
      setState((s) => ({ ...s, products: plan ? (s.products.some((x) => x.id === plan!.id) ? s.products.map((x) => x.id === plan!.id ? plan! : x) : [plan!, ...s.products]) : s.products, weeklyMenus: [...(s.weeklyMenus || []).filter((c) => !(c.vendorId === vendor.id && c.meal === meal && c.diet === diet)), ...cells] }));
      toast.success(`${planName(meal, diet)} saved: ${filledDays} day${filledDays === 1 ? "" : "s"} on the menu.${vendor.verification === "Verified" ? "" : " It goes on sale once Operations verifies your store."}`);
    } catch (error) { toast.error(errorMessage(error, "The weekly menu could not be saved")); } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <section className="flex flex-wrap items-end gap-4 rounded-3xl bg-white p-5"><div><h2 className="flex items-center gap-2 text-lg font-black"><FoodTypeMark type={diet === "veg" ? "veg" : "non_veg"} />{planName(meal, diet).replace(/^./, (c) => c.toUpperCase())}</h2><p className="mt-1 text-xs text-[#55656A]">Each day has its own price. Customers pay the price of the day they order.</p></div>
      <label className="text-sm font-semibold">Same price for all days (₹)<span className="mt-1 flex gap-2"><input aria-label="Same price for all days" inputMode="decimal" value={sameFor} onChange={(e) => setSameFor(e.target.value.replace(/[^\d.]/g, ""))} className={`${field} h-11 w-32 p-0 px-3`} /><Button type="button" variant="outline" onClick={applyPrice} className="h-11 rounded-xl">Apply</Button></span></label>
      <p className="text-sm font-semibold text-[#155F65]">{filledDays} of 7 days on the menu</p></section>
    <div className="grid gap-3 md:grid-cols-2">{WEEKDAYS.map((d) => <section key={d} aria-label={WEEKDAY_NAMES[d]} className={`rounded-3xl p-4 ${draft[d].open ? "bg-white" : "bg-stone-100"}`}>
      <div className="flex items-center justify-between gap-2"><h3 className="font-black">{WEEKDAY_NAMES[d]}</h3>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft[d].open} onChange={(e) => set(d, { open: e.target.checked })} className="size-4 accent-[#155F65]" />{draft[d].open ? "Cooking" : "Off"}</label></div>
      <textarea aria-label={`${WEEKDAY_NAMES[d]} dishes`} disabled={!draft[d].open} value={draft[d].text} onChange={(e) => set(d, { text: e.target.value })} rows={4} placeholder={"One dish per line\nRice\nSambar\nCurd"} className={`${field} mt-2 disabled:opacity-50`} />
      <div className="mt-2 flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-xs font-bold text-[#2F3C3F]">Price ₹<input aria-label={`${WEEKDAY_NAMES[d]} price`} inputMode="decimal" disabled={!draft[d].open} value={draft[d].price} onChange={(e) => set(d, { price: e.target.value.replace(/[^\d.]/g, "") })} className={`${field} h-9 w-24 p-0 px-2.5 disabled:opacity-50`} /></label>
        <button type="button" onClick={() => copyToAll(d)} disabled={!draft[d].open} className="text-[11px] font-bold text-[#155F65] underline disabled:opacity-40">Copy dishes to all days</button></div>
      <div className="mt-1 text-[11px] text-[#55656A]">{normalizeDishes(draft[d].text).length} / {MAX_DISHES} dishes</div></section>)}</div>
    <div className="sticky bottom-3 flex justify-start"><Button onClick={() => void save()} disabled={busy} className="h-12 rounded-2xl bg-[#155F65] px-8 shadow-lg">{busy ? "Saving…" : `Save ${planName(meal, diet)}`}</Button></div>
  </div>;
}

/* ---------------------------------------- Customer ---------------------------------------- */
export type PlanPreset = PlanChoice & { quantity?: number };
export function WeeklyMenuTab({ vendor, state, tomorrow, onPlan }: { vendor: Vendor; state: V3State; tomorrow: string; onPlan: (product: Product, preset: PlanPreset) => void }) {
  const menus = useMemo(() => state.weeklyMenus || [], [state.weeklyMenus]);
  const offered = useMemo(() => plansOffered(menus, vendor.id), [menus, vendor.id]);
  const [meal, setMeal] = useState<Meal | null>(null), [diet, setDiet] = useState<Diet | null>(null);
  if (!offered.length) return <div className="rounded-2xl bg-stone-50 p-6 text-center text-sm text-stone-500">This kitchen has not published a weekly menu yet.</div>;
  const mealsOffered = MEALS.filter((m) => offered.some((o) => o.meal === m));
  const m = meal && mealsOffered.includes(meal) ? meal : mealsOffered[0];
  const dietsOffered = DIETS.filter((d) => offered.some((o) => o.meal === m && o.diet === d));
  const dt = diet && dietsOffered.includes(diet) ? diet : dietsOffered[0];
  const plan = planProductOf(state.products, vendor.id, m, dt);
  const open = orderableDays(menus, vendor.id, m, dt);
  const markup = plan ? state.markups?.[plan.id] || 0 : 0;
  const unitOn = (d: Weekday) => plan ? withMarkup(dayPrice(cellFor(menus, vendor.id, d, m, dt), plan.vendorPrice), markup) : 0;
  const weekTotal = open.reduce((sum, d) => sum + unitOn(d), 0);
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Meal">{mealsOffered.map((x) => <button key={x} type="button" aria-pressed={m === x} onClick={() => setMeal(x)} className={chip(m === x)}>{MEAL_LABEL[x]}</button>)}<span className="mx-1 h-6 w-px bg-stone-300" />{dietsOffered.map((x) => <button key={x} type="button" aria-pressed={dt === x} onClick={() => setDiet(x)} className={chip(dt === x)}>{DIET_LABEL[x]}</button>)}</div>
    <p className="text-xs font-bold text-stone-500">Same price every day. Each day has its own price. Orders and subscriptions start from tomorrow.</p>
    {!plan || !plan.active ? <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">This plan is not on sale right now.</div> : <>
      <button type="button" onClick={() => onPlan(plan, planChoice("whole_week", open[0], open, tomorrow))} className="w-full rounded-2xl bg-[#155F65] px-4 py-3 text-sm font-black text-white">Subscribe to the whole week ({open.length} day{open.length === 1 ? "" : "s"}) · ₹{Math.round(weekTotal)} a week</button>
      <ul className="space-y-2">{WEEKDAYS.map((d) => { const cell = cellFor(menus, vendor.id, d, m, dt); const ok = isOrderable(cell); return <li key={d} className={`rounded-2xl p-3 ${ok ? "bg-white shadow-sm ring-1 ring-stone-200/70" : "bg-stone-100 text-stone-400"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><b>{WEEKDAY_NAMES[d]}{ok && <span className="ml-2 text-sm font-black text-[#155F65]">₹{Math.round(unitOn(d))}</span>}</b>{ok ? <span className="flex gap-1.5"><button type="button" onClick={() => onPlan(plan, planChoice("single_day", d, open, tomorrow))} className="h-9 rounded-full bg-[#155F65] px-4 text-xs font-bold text-white">Order this day</button><button type="button" onClick={() => onPlan(plan, planChoice("weekly_day", d, open, tomorrow))} className="h-9 rounded-full bg-white px-4 text-xs font-bold ring-1 ring-stone-300">Every {d}</button></span> : <span className="text-xs font-bold">Not cooking</span>}</div>
        {ok && <p className="mt-1.5 text-sm leading-6 text-stone-600">{cell!.dishes.join(" · ")}</p>}</li>; })}</ul></>}
  </div>;
}
