"use client";
// Operations / Super Admin: the commercial terms of one vendor (commission, GST mode, delivery fee). The vendor never sees or edits these.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";
import { getAccessToken } from "@/lib/supabase";
import { COMMISSION_ASSUMED, MIN_DELIVERY_FEE, commissionPercentFor, defaultGstMode, type GstMode } from "@/lib/billing";

type Terms = { commissionPercent?: number; gstMode?: GstMode; deliveryFeeOverride?: number };
type Props = { vendor: { id: string; category: string; plan?: string } & Terms; live: boolean; onSaved: (terms: Terms) => void };

const GST_LABELS: Record<GstMode, string> = { none: "No GST (Bill of Supply)", vendor: "Vendor issues a Tax Invoice", platform: "Sheplates pays GST under Section 9(5)" };
const input = "h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#155F65] focus:ring-2 focus:ring-[#155F65]/10";

export function CommercialTermsPanel({ vendor, live, onSaved }: Props) {
  const [commission, setCommission] = useState(vendor.commissionPercent != null ? String(vendor.commissionPercent) : "");
  const [gst, setGst] = useState<string>(vendor.gstMode ?? "");
  const [fee, setFee] = useState(vendor.deliveryFeeOverride != null ? String(vendor.deliveryFeeOverride) : "");
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the form re-syncs when another vendor is picked
  useEffect(() => { setCommission(vendor.commissionPercent != null ? String(vendor.commissionPercent) : ""); setGst(vendor.gstMode ?? ""); setFee(vendor.deliveryFeeOverride != null ? String(vendor.deliveryFeeOverride) : ""); }, [vendor.id, vendor.commissionPercent, vendor.gstMode, vendor.deliveryFeeOverride]);

  const defaultPercent = commissionPercentFor(vendor.category, null, vendor.plan);
  const taster = String(vendor.plan || "").toLowerCase() === "taster";

  async function save() {
    const c = commission.trim() === "" ? null : Number(commission), f = fee.trim() === "" ? null : Number(fee);
    if (c !== null && (!Number.isFinite(c) || c < 0 || c > 100)) return void toast.error("Commission must be between 0 and 100 percent.");
    if (f !== null && (!Number.isFinite(f) || f < MIN_DELIVERY_FEE || f > 1000)) return void toast.error(`The delivery fee must be between ₹${MIN_DELIVERY_FEE} and ₹1000, or left empty to use the distance slabs.`);
    setBusy(true);
    try {
      if (live) {
        const token = await getAccessToken();
        const response = await fetch("/api/vendor/commercial", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ vendorId: vendor.id, commissionPercent: c, gstMode: gst || null, deliveryFeeOverride: f }) });
        const json = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(json.error || "The terms could not be saved.");
      }
      onSaved({ commissionPercent: c ?? undefined, gstMode: (gst || undefined) as GstMode | undefined, deliveryFeeOverride: f ?? undefined });
      toast.success("Commercial terms saved");
    } catch (error) { toast.error(errorMessage(error, "The terms could not be saved.")); }
    finally { setBusy(false); }
  }

  return <section aria-label="Commercial terms" data-testid="commercial-terms" className="space-y-3 rounded-2xl bg-white p-4">
    <div><h4 className="text-sm font-black text-[#202827]">Commercial terms <span className="font-semibold text-stone-500">(set by Operations, not by the vendor)</span></h4>
      <p className="text-xs text-stone-500">Leave a field empty to use the default for this vendor&apos;s category.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-xs font-black uppercase tracking-wider text-stone-500">Commission %
        <input aria-label="Commission percent" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder={taster ? "0 (Taster has none)" : `Default ${defaultPercent}%`} className={`${input} mt-1.5 normal-case tracking-normal`} />
        {!taster && COMMISSION_ASSUMED.includes(vendor.category) && <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-amber-700">No rate was given for {vendor.category}; {defaultPercent}% is assumed.</span>}
      </label>
      <label className="block text-xs font-black uppercase tracking-wider text-stone-500">GST
        <select aria-label="GST mode" value={gst} onChange={(e) => setGst(e.target.value)} className={`${input} mt-1.5 normal-case tracking-normal`}>
          <option value="">Default: {GST_LABELS[defaultGstMode(vendor.category)]}</option>
          {(Object.keys(GST_LABELS) as GstMode[]).map((mode) => <option key={mode} value={mode}>{GST_LABELS[mode]}</option>)}
        </select>
      </label>
      <label className="block text-xs font-black uppercase tracking-wider text-stone-500">Delivery fee (₹, flat)
        <input aria-label="Delivery fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Distance slabs (min ₹20)" className={`${input} mt-1.5 normal-case tracking-normal`} />
      </label>
    </div>
    <Button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl bg-[#155F65] hover:bg-[#0F4A4F]">{busy ? "Saving…" : "Save commercial terms"}</Button>
  </section>;
}
