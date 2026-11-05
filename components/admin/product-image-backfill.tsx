"use client";
import { useEffect, useState } from "react";
import { ImageUp } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";
import { isLiveSupabaseMode, loadProductImageGap, runProductImageBackfill } from "@/lib/supabase";

/** Super Admin card: draws sample pictures for products that have no photo, a few product types at a time. */
export function ProductImageBackfill() {
  const [gap, setGap] = useState<{ products: number; kinds: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isLiveSupabaseMode()) return;
    let cancelled = false;
    loadProductImageGap().then((value) => { if (!cancelled) setGap(value); }).catch(() => { if (!cancelled) setGap(null); });
    return () => { cancelled = true; };
  }, []);

  async function run() {
    setBusy(true); setNote("");
    try {
      for (let round = 0; round < 80; round += 1) {
        const result = await runProductImageBackfill(2);
        setGap({ products: result.remainingProducts, kinds: result.remainingKinds });
        if (result.message) { setNote(result.message); break; }
        if (result.remainingKinds === 0) { setNote("Every product now has a picture."); break; }
        if (result.generated + result.reused === 0) { setNote("Some products could not be illustrated. Check their names."); break; }
      }
    } catch (error) { setNote(errorMessage(error, "The images could not be created.")); }
    finally { setBusy(false); }
  }

  if (!gap) return null;
  return <section aria-label="Product pictures" className="surface-card flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5">
    <div className="flex min-w-0 items-start gap-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#EAF4F2] text-[#155F65]"><ImageUp /></div>
      <div className="min-w-0"><h3 className="font-black">Product pictures</h3>
        <p className="text-sm text-[#55656A]">{gap.products === 0 ? "Every product has a picture." : `${gap.products} product${gap.products === 1 ? " has" : "s have"} no photo (${gap.kinds} kind${gap.kinds === 1 ? "" : "s"} of item). Sample images are drawn once per kind and shared.`}</p>
        {note && <p role="status" className="mt-1 text-sm font-semibold text-[#202827]">{note}</p>}</div>
    </div>
    {gap.products > 0 && <Button onClick={() => void run()} disabled={busy}>{busy ? "Creating pictures…" : "Create sample pictures"}</Button>}
  </section>;
}
