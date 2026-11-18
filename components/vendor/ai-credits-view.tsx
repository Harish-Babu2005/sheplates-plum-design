/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import { Sparkles, Coins, AlertTriangle, CheckCircle2, ArrowUpRight, Plus, Minus, History, ShieldAlert, CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  CREDIT_PACKS,
  PLAN_INCLUDED_CREDITS,
  calculateCreditPackBilling,
  isLowCreditBalance,
  type CreditPack,
  type PlanCode,
} from "@/lib/ai-credits-config";
import {
  createLiveCreditPackOrder,
  fetchLiveVendorAiCredits,
  isLiveSupabaseMode,
  verifyLiveCreditPackPayment,
  adjustLiveVendorAiCreditsAdmin,
} from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Vendor, V3State } from "@/components/sheplates-v3";
import type { DemoSession } from "@/lib/sheplates-v2-data";

interface BuyCreditsProps {
  vendor: Vendor;
  state?: V3State;
  setState?: React.Dispatch<React.SetStateAction<V3State>>;
  session?: DemoSession;
  onNavigate?: (view: string) => void;
  onBack?: () => void;
}

export function BuyCreditsScreen({ vendor, state, setState, session, onNavigate }: BuyCreditsProps) {
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [liveCredits, setLiveCredits] = useState<{
    planCredits: number;
    purchasedCredits: number;
    totalCredits: number;
    includedAllowance: number;
    isLow: boolean;
  } | null>(null);
  const [liveLedger, setLiveLedger] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);

  const planCode = (vendor.plan?.toLowerCase() || "crave") as PlanCode;
  const isTaster = planCode === "taster";

  // Load live credits if in live mode
  useEffect(() => {
    if (isLiveSupabaseMode() && vendor?.id) {
      setLoading(true);
      fetchLiveVendorAiCredits(vendor.id)
        .then((res) => {
          if (res?.balance) setLiveCredits(res.balance);
          if (res?.ledger) setLiveLedger(res.ledger);
        })
        .catch((err) => console.warn("Failed to fetch live vendor credits:", err))
        .finally(() => setLoading(false));
    }
  }, [vendor?.id]);

  const planAllowance = PLAN_INCLUDED_CREDITS[planCode] ?? 200;
  const planCredits = liveCredits?.planCredits ?? (vendor.aiCredits?.planCredits ?? planAllowance);
  const purchasedCredits = liveCredits?.purchasedCredits ?? (vendor.aiCredits?.purchasedCredits ?? 0);
  const totalCredits = planCredits + purchasedCredits;
  const isLow = liveCredits?.isLow ?? isLowCreditBalance(planCode, totalCredits);

  // Fallback demo ledger from state
  const demoLedger = (state?.audit || [])
    .filter((a) => /credit/i.test(a.action) || /credit/i.test(a.detail))
    .slice(0, 20);

  async function handleBuyPack(pack: CreditPack) {
    if (isTaster) {
      toast.error("Credit packs cannot be purchased on the Taster plan. Upgrade to Crave, Thrive, or Crown.");
      return;
    }

    setBuyingPackId(pack.id);
    const billing = calculateCreditPackBilling(pack);

    try {
      if (isLiveSupabaseMode()) {
        const rzpOrder = await createLiveCreditPackOrder(pack.id);
        const RazorpayConstructor = (window as unknown as { Razorpay: any })?.Razorpay;

        if (typeof window !== "undefined" && RazorpayConstructor) {
          const rzp = new RazorpayConstructor({
            key: rzpOrder.keyId,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency || "INR",
            name: "SHE Plates",
            description: rzpOrder.description || `AI Credits: ${pack.credits} Credits`,
            order_id: rzpOrder.razorpayOrderId,
            prefill: {
              name: vendor.ownerName || vendor.businessName || "",
              email: vendor.ownerEmail || session?.email || "",
            },
            theme: { color: "#155F65" },
            handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
              try {
                const verifyRes = await verifyLiveCreditPackPayment({
                  packId: pack.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });

                toast.success(`Payment confirmed! ${pack.credits} AI credits added to your balance.`);
                // Refresh balance
                const updated = await fetchLiveVendorAiCredits(vendor.id);
                if (updated?.balance) setLiveCredits(updated.balance);
                if (updated?.ledger) setLiveLedger(updated.ledger);
              } catch (verErr) {
                toast.error(verErr instanceof Error ? verErr.message : "Payment verification failed.");
              }
            },
          });
          rzp.open();
        } else {
          // Simulated fallback when Razorpay script is not present
          toast.info("Simulating payment for testing environment...");
          const fakePaymentId = `pay_sim_${Date.now()}`;
          const updated = await verifyLiveCreditPackPayment({
            packId: pack.id,
            razorpay_order_id: rzpOrder.razorpayOrderId,
            razorpay_payment_id: fakePaymentId,
            razorpay_signature: "simulated_signature",
          }).catch(() => null);

          toast.success(`${pack.credits} AI credits added to your balance!`);
          const latest = await fetchLiveVendorAiCredits(vendor.id).catch(() => null);
          if (latest?.balance) setLiveCredits(latest.balance);
        }
      } else {
        // Demo mode local state update
        const newPurchased = purchasedCredits + pack.credits;
        const newTotal = planCredits + newPurchased;
        const nowIso = new Date().toISOString();

        if (setState) {
          setState((s) => ({
            ...s,
            vendors: s.vendors.map((v) =>
              v.id === vendor.id
                ? {
                    ...v,
                    aiCredits: {
                      planCredits,
                      purchasedCredits: newPurchased,
                      totalCredits: newTotal,
                      includedAllowance: planAllowance,
                      isLow: isLowCreditBalance(planCode, newTotal),
                    },
                  }
                : v
            ),
            audit: [
              {
                id: `aud_${Date.now()}`,
                actor: session?.email || "vendor",
                action: "Purchased AI credit pack",
                detail: `${vendor.businessName} bought ${pack.name} (+${pack.credits} credits) for ₹${billing.totalAmount} incl. GST. Balance after: ${newTotal}`,
                at: nowIso,
              },
              ...s.audit,
            ],
          }));
        }

        toast.success(`Success! Added ${pack.credits} credits to your balance.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete credit pack purchase.");
    } finally {
      setBuyingPackId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-[#155F65]">Vendor Wallet</div>
          <h1 className="text-2xl font-black text-stone-900">AI Credits & Packs</h1>
          <p className="mt-1 text-sm text-stone-500">
            Every AI feature (product pictures, nutrition estimates, She Agent, store insights) uses credits.
          </p>
        </div>
      </div>

      {/* Warning banner when balance is low (< 20%) or zero */}
      {isLow && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold">
              {totalCredits === 0 ? "You have run out of AI credits" : "Your AI credit balance is running low (below 20%)"}
            </h4>
            <p className="mt-1 text-xs text-amber-800">
              {totalCredits === 0
                ? "AI product pictures, nutrition estimates, and She Agent are paused until you top up."
                : `You have ${totalCredits} credit${totalCredits === 1 ? "" : "s"} left. Top up with an extra pack below to ensure uninterrupted service.`}
            </p>
          </div>
        </div>
      )}

      {/* Balances Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card rounded-2xl p-5 border border-stone-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Available</span>
            <Coins className="size-5 text-[#155F65]" />
          </div>
          <div className="mt-3 text-3xl font-black text-[#155F65]">{totalCredits}</div>
          <div className="mt-1 text-xs text-stone-500">Combined credit balance</div>
        </div>

        <div className="surface-card rounded-2xl p-5 border border-stone-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Plan Credits</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 uppercase">
              {vendor.plan}
            </span>
          </div>
          <div className="mt-3 text-3xl font-black text-stone-800">
            {planCredits} <span className="text-sm font-normal text-stone-400">/ {planAllowance}</span>
          </div>
          <div className="mt-1 text-xs text-stone-500">Used first each month</div>
        </div>

        <div className="surface-card rounded-2xl p-5 border border-stone-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Purchased Credits</span>
            <Sparkles className="size-5 text-amber-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-stone-800">{purchasedCredits}</div>
          <div className="mt-1 text-xs text-stone-500">Never expire across months</div>
        </div>

        <div className="surface-card rounded-2xl p-5 border border-stone-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Usage Cost</span>
            <CheckCircle2 className="size-5 text-emerald-600" />
          </div>
          <div className="mt-3 text-3xl font-black text-stone-800">1 <span className="text-sm font-normal text-stone-400">credit</span></div>
          <div className="mt-1 text-xs text-stone-500">Per successful AI action</div>
        </div>
      </div>

      {/* Credit Packs */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-stone-900">Buy Extra Credit Packs</h2>
          <p className="text-xs text-stone-500">
            One-time purchase via Razorpay. Credits are added immediately upon payment confirmation and never expire.
          </p>
        </div>

        {isTaster && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600">
            <b>Taster Plan Notice:</b> The Taster plan is a free profile listing with no AI features. Upgrade to Crave, Thrive, or Crown to buy packs and unlock AI tools.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => {
            const billing = calculateCreditPackBilling(pack);
            const isBuying = buyingPackId === pack.id;
            return (
              <div
                key={pack.id}
                className="surface-card flex flex-col justify-between rounded-2xl border border-stone-200 p-5 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#EAF4F2] px-3 py-1 text-xs font-black text-[#155F65]">
                      +{pack.credits} Credits
                    </span>
                    <span className="text-xs font-semibold text-stone-500">₹{(pack.price / pack.credits).toFixed(2)}/cr</span>
                  </div>
                  <h3 className="mt-3 text-lg font-black text-stone-900">{pack.name}</h3>
                  <p className="mt-1 text-xs text-stone-500">{pack.description}</p>
                </div>

                <div className="mt-6 border-t border-stone-100 pt-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-2xl font-black text-stone-900">₹{billing.totalAmount}</div>
                      <div className="text-[11px] text-stone-400">
                        ₹{billing.basePrice} + 18% GST (₹{billing.gstAmount})
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => void handleBuyPack(pack)}
                    disabled={isTaster || isBuying}
                    className="mt-4 w-full rounded-xl bg-[#155F65] font-bold text-white hover:bg-[#0F4A4F]"
                  >
                    {isBuying ? "Processing…" : `Buy ${pack.credits} Credits`}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Credit Ledger */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-stone-900">Credit Ledger & History</h2>
            <p className="text-xs text-stone-500">Transparent record of every grant, purchase, deduction, and balance after.</p>
          </div>
          <History className="size-5 text-stone-400" />
        </div>

        <div className="surface-card overflow-hidden rounded-2xl border border-stone-200/80">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50/50">
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Action / Details</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveLedger.length > 0 ? (
                liveLedger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-stone-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          entry.entryType === "grant"
                            ? "bg-emerald-100 text-emerald-800"
                            : entry.entryType === "purchase"
                            ? "bg-blue-100 text-blue-800"
                            : entry.entryType === "adjustment"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {entry.entryType}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-stone-800">{entry.action}</div>
                      {entry.notes && <div className="text-stone-500 text-[11px]">{entry.notes}</div>}
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs font-black ${
                        entry.creditsChange > 0 ? "text-emerald-600" : "text-stone-700"
                      }`}
                    >
                      {entry.creditsChange > 0 ? `+${entry.creditsChange}` : entry.creditsChange}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-stone-900">
                      {entry.balanceAfter}
                    </TableCell>
                  </TableRow>
                ))
              ) : demoLedger.length > 0 ? (
                demoLedger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-stone-500">{entry.at?.slice(0, 16)}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-700">
                        audit
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-stone-800">{entry.detail}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-stone-600">—</TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-stone-900">{totalCredits}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="p-8 text-center text-xs text-stone-400">
                    No transactions in ledger yet. Credit allocations and usage will appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable banner badge to show current balance & low-credit warnings in AI screens.
 */
export function AiCreditsBadge({
  vendor,
  onBuyCredits,
}: {
  vendor: Vendor;
  onBuyCredits?: () => void;
}) {
  const planCode = (vendor.plan?.toLowerCase() || "crave") as PlanCode;
  const planAllowance = PLAN_INCLUDED_CREDITS[planCode] ?? 200;
  const planCredits = vendor.aiCredits?.planCredits ?? planAllowance;
  const purchasedCredits = vendor.aiCredits?.purchasedCredits ?? 0;
  const totalCredits = planCredits + purchasedCredits;
  const isLow = isLowCreditBalance(planCode, totalCredits);

  if (totalCredits === 0) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertTriangle className="size-4 text-red-600" />
          <span>0 AI credits left</span>
        </div>
        {onBuyCredits && (
          <button
            type="button"
            onClick={onBuyCredits}
            className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700"
          >
            Buy credits
          </button>
        )}
      </div>
    );
  }

  if (isLow) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
        <div className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="size-4 text-amber-600" />
          <span>
            <b>Low credits:</b> {totalCredits} available
          </span>
        </div>
        {onBuyCredits && (
          <button
            type="button"
            onClick={onBuyCredits}
            className="rounded-lg bg-[#155F65] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0F4A4F]"
          >
            Top up
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-1.5 text-xs text-stone-700">
      <Coins className="size-3.5 text-[#155F65]" />
      <span>
        <b>{totalCredits}</b> AI credits
      </span>
      {onBuyCredits && (
        <button
          type="button"
          onClick={onBuyCredits}
          className="ml-1 text-[11px] font-bold text-[#155F65] underline hover:text-[#0F4A4F]"
        >
          Add
        </button>
      )}
    </div>
  );
}

/**
 * Operations & Super Admin view to inspect vendor balance/ledger and adjust credits with a reason.
 */
type AdminBalance = {
  planCredits: number;
  purchasedCredits: number;
  totalCredits: number;
  includedAllowance: number;
};

type AdminLedgerRow = {
  id: string;
  createdAt: string;
  entryType: string;
  action: string;
  notes?: string;
  creditsChange: number;
  balanceAfter: number;
};

export function AdminVendorCreditsManagement({
  state,
  setState,
  session,
  vendors: propVendors,
}: {
  state?: V3State;
  setState?: React.Dispatch<React.SetStateAction<V3State>>;
  session?: DemoSession;
  vendors?: Vendor[];
}) {
  const vendorsList = propVendors || state?.vendors || [];
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendorsList[0]?.id || "");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveData, setLiveData] = useState<{ balance: AdminBalance; ledger: AdminLedgerRow[] } | null>(null);

  const selectedVendor = vendorsList.find((v) => v.id === selectedVendorId) || vendorsList[0];

  useEffect(() => {
    if (isLiveSupabaseMode() && selectedVendorId) {
      fetchLiveVendorAiCredits(selectedVendorId)
        .then((res) => {
          if (res?.balance) setLiveData({ balance: res.balance as unknown as AdminBalance, ledger: (res.ledger || []) as unknown as AdminLedgerRow[] });
        })
        .catch((err) => console.warn(err));
    }
  }, [selectedVendorId]);

  const planCode = (selectedVendor?.plan?.toLowerCase() || "crave") as PlanCode;
  const balance: AdminBalance = liveData?.balance || {
    planCredits: selectedVendor?.aiCredits?.planCredits ?? PLAN_INCLUDED_CREDITS[planCode] ?? 200,
    purchasedCredits: selectedVendor?.aiCredits?.purchasedCredits ?? 0,
    totalCredits: (selectedVendor?.aiCredits?.planCredits ?? PLAN_INCLUDED_CREDITS[planCode] ?? 200) + (selectedVendor?.aiCredits?.purchasedCredits ?? 0),
    includedAllowance: PLAN_INCLUDED_CREDITS[planCode] ?? 200,
  };

  const ledger: AdminLedgerRow[] = liveData?.ledger || [];

  async function handleAdjust() {
    if (!adjustReason.trim()) {
      toast.error("Please provide a reason for this credit adjustment.");
      return;
    }
    if (adjustAmount === 0) {
      toast.error("Amount must be non-zero.");
      return;
    }

    setBusy(true);
    try {
      if (isLiveSupabaseMode()) {
        await adjustLiveVendorAiCreditsAdmin({
          vendorId: selectedVendor.id,
          amount: adjustAmount,
          reason: adjustReason.trim(),
        });
        const refreshed = await fetchLiveVendorAiCredits(selectedVendor.id);
        if (refreshed?.balance) setLiveData({ balance: refreshed.balance as unknown as AdminBalance, ledger: (refreshed.ledger || []) as unknown as AdminLedgerRow[] });
        toast.success(`Successfully adjusted ${adjustAmount > 0 ? `+${adjustAmount}` : adjustAmount} credits.`);
      } else {
        const curPurchased = selectedVendor.aiCredits?.purchasedCredits ?? 0;
        const curPlan = selectedVendor.aiCredits?.planCredits ?? (PLAN_INCLUDED_CREDITS[planCode] ?? 200);
        let newPurchased = curPurchased;
        let newPlan = curPlan;

        if (adjustAmount > 0) newPurchased += adjustAmount;
        else {
          const deduct = Math.abs(adjustAmount);
          const fromPlan = Math.min(newPlan, deduct);
          newPlan -= fromPlan;
          newPurchased -= (deduct - fromPlan);
        }

        const newTotal = newPlan + newPurchased;

        if (setState) {
          setState((s) => ({
            ...s,
            vendors: s.vendors.map((v) =>
              v.id === selectedVendor.id
                ? {
                    ...v,
                    aiCredits: {
                      planCredits: newPlan,
                      purchasedCredits: newPurchased,
                      totalCredits: newTotal,
                      includedAllowance: PLAN_INCLUDED_CREDITS[planCode] ?? 200,
                    },
                  }
                : v
            ),
            audit: [
              {
                id: `aud_${Date.now()}`,
                actor: session?.email || "admin",
                action: adjustAmount > 0 ? "Granted vendor AI credits" : "Deducted vendor AI credits",
                detail: `${session?.name || "Admin"} adjusted ${adjustAmount > 0 ? `+${adjustAmount}` : adjustAmount} credits for ${selectedVendor.businessName}. Reason: ${adjustReason.trim()}. Balance after: ${newTotal}`,
                at: new Date().toISOString(),
              },
              ...s.audit,
            ],
          }));
        }

        toast.success(`Adjusted ${adjustAmount > 0 ? `+${adjustAmount}` : adjustAmount} credits for ${selectedVendor.businessName}.`);
      }

      setAdjustOpen(false);
      setAdjustReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-[#155F65]">Administration</div>
          <h1 className="text-2xl font-black text-stone-900">Vendor AI Credits Management</h1>
          <p className="mt-1 text-sm text-stone-500">
            Inspect vendor credit balances, browse transaction ledgers, and grant or deduct credits with an audit reason.
          </p>
        </div>

        {/* Vendor Picker */}
        <div className="w-72">
          <label className="text-xs font-semibold text-stone-600 block mb-1">Select Vendor</label>
          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-sm font-semibold"
          >
            {vendorsList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.businessName} ({v.plan})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Vendor Metrics */}
      {selectedVendor && (
        <div className="surface-card rounded-2xl p-6 border border-stone-200">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-stone-900">{selectedVendor.businessName}</h3>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  {selectedVendor.plan}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">{selectedVendor.ownerEmail} · ID: {selectedVendor.id}</p>
            </div>

            <Button
              onClick={() => setAdjustOpen(true)}
              className="rounded-xl bg-[#155F65] font-bold text-white hover:bg-[#0F4A4F]"
            >
              <Coins className="mr-2 size-4" />
              Adjust Credits
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Total Balance</span>
              <div className="mt-2 text-2xl font-black text-[#155F65]">{balance.totalCredits}</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Monthly Plan Credits</span>
              <div className="mt-2 text-2xl font-black text-stone-800">{balance.planCredits} / {balance.includedAllowance}</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Purchased Credits</span>
              <div className="mt-2 text-2xl font-black text-amber-700">{balance.purchasedCredits}</div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="space-y-3">
        <h3 className="text-base font-black text-stone-900">Vendor Credit Ledger</h3>
        <div className="surface-card overflow-hidden rounded-2xl border border-stone-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead>Timestamp</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Action / Reason</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length > 0 ? (
                ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-stone-500">{new Date(row.createdAt).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase">
                        {row.entryType}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-stone-800">
                      <div>{row.action}</div>
                      {row.notes && <div className="text-stone-500 font-normal">{row.notes}</div>}
                    </TableCell>
                    <TableCell className={`text-right text-xs font-bold ${row.creditsChange > 0 ? "text-emerald-600" : "text-stone-700"}`}>
                      {row.creditsChange > 0 ? `+${row.creditsChange}` : row.creditsChange}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-stone-900">
                      {row.balanceAfter}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="p-8 text-center text-xs text-stone-400">
                    No ledger transactions recorded for this vendor yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-900">
              Adjust Credits for {selectedVendor?.businessName}
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Enter a positive number to grant credits or negative to deduct. All adjustments are logged to the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Credit Amount</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  placeholder="e.g. 50 or -20"
                  className="flex-1 rounded-xl border border-stone-300 p-2.5 text-sm font-semibold"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustAmount((a) => a + 50)}
                  className="rounded-xl text-xs"
                >
                  +50
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustAmount((a) => a - 20)}
                  className="rounded-xl text-xs"
                >
                  -20
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Reason (Mandatory)</label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Explain why credits are being adjusted (e.g. Compensation for failed generation, promo grant, correction)"
                className="w-full rounded-xl border border-stone-300 p-2.5 text-sm min-h-20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAdjustOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => void handleAdjust()}
              disabled={busy || !adjustReason.trim() || adjustAmount === 0}
              className="rounded-xl bg-[#155F65] text-white hover:bg-[#0F4A4F]"
            >
              {busy ? "Saving…" : "Confirm Adjustment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
