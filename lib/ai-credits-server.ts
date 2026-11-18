import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_ACTION_COSTS,
  AI_ACTION_LABELS,
  CREDIT_PACKS,
  PLAN_INCLUDED_CREDITS,
  isLowCreditBalance,
  type AiAction,
  type CreditPack,
  type PlanCode,
} from "./ai-credits-config.ts";
import { normalizePlanCode } from "./plans.ts";

export type VendorCreditBalance = {
  vendorId: string;
  planCode: PlanCode;
  planCredits: number;
  purchasedCredits: number;
  totalCredits: number;
  includedAllowance: number;
  isLow: boolean;
};

export type CreditLedgerEntry = {
  id: string;
  vendorId: string;
  entryType: "grant" | "purchase" | "usage" | "adjustment";
  action: string;
  creditsChange: number;
  planCreditsAfter: number;
  purchasedCreditsAfter: number;
  balanceAfter: number;
  notes?: string | null;
  actorId?: string | null;
  createdAt: string;
};

/**
 * Ensures a vendor record exists in vendor_ai_credits and returns their current balances.
 * If no record exists, initializes with the plan's included allowance.
 */
export async function getVendorAiCredits(
  admin: SupabaseClient,
  vendorId: string
): Promise<VendorCreditBalance> {
  const { data: existing, error } = await admin
    .from("vendor_ai_credits")
    .select("vendor_id, plan_credits, purchased_credits, updated_at")
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (error && error.code !== "PGRST116" && !/does not exist|42P01/i.test(error.message)) {
    console.error("Error reading vendor_ai_credits:", error);
  }

  // Get vendor's plan
  const { data: vendorData } = await admin
    .from("vendors")
    .select("id, plan_id, vendor_plans(code, name)")
    .eq("id", vendorId)
    .maybeSingle();

  const vendorPlansRecord = vendorData?.vendor_plans as unknown;
  const rawPlanCode = Array.isArray(vendorPlansRecord)
    ? (vendorPlansRecord[0] as { code?: string } | undefined)?.code
    : (vendorPlansRecord as { code?: string } | undefined)?.code;

  const planCode = normalizePlanCode(rawPlanCode);
  const includedAllowance = PLAN_INCLUDED_CREDITS[planCode] ?? 200;

  if (existing) {
    const planCredits = Number(existing.plan_credits ?? 0);
    const purchasedCredits = Number(existing.purchased_credits ?? 0);
    const totalCredits = planCredits + purchasedCredits;
    return {
      vendorId,
      planCode,
      planCredits,
      purchasedCredits,
      totalCredits,
      includedAllowance,
      isLow: isLowCreditBalance(planCode, totalCredits),
    };
  }

  // Initialize credits for new vendor
  const initialPlanCredits = includedAllowance;
  const initialPurchasedCredits = 0;
  const initialTotal = initialPlanCredits;

  try {
    await admin.from("vendor_ai_credits").upsert(
      {
        vendor_id: vendorId,
        plan_credits: initialPlanCredits,
        purchased_credits: initialPurchasedCredits,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vendor_id" }
    );

    if (initialPlanCredits > 0) {
      await admin.from("vendor_ai_credit_ledger").insert({
        vendor_id: vendorId,
        entry_type: "grant",
        action: "initial_plan_grant",
        credits_change: initialPlanCredits,
        plan_credits_after: initialPlanCredits,
        purchased_credits_after: 0,
        balance_after: initialPlanCredits,
        notes: `Initial grant for ${planCode} plan (${initialPlanCredits} credits)`,
      });
    }
  } catch (err) {
    console.warn("Could not insert initial vendor_ai_credits row (migration may be pending):", err);
  }

  return {
    vendorId,
    planCode,
    planCredits: initialPlanCredits,
    purchasedCredits: initialPurchasedCredits,
    totalCredits: initialTotal,
    includedAllowance,
    isLow: isLowCreditBalance(planCode, initialTotal),
  };
}

/**
 * Checks whether the vendor has enough AI credits before executing an AI call.
 */
export async function checkVendorAiCredits(
  admin: SupabaseClient,
  vendorId: string,
  action: AiAction
): Promise<{
  allowed: boolean;
  cost: number;
  balance: number;
  planCredits: number;
  purchasedCredits: number;
  message?: string;
  isLow?: boolean;
}> {
  const cost = AI_ACTION_COSTS[action] ?? 1;
  const balanceInfo = await getVendorAiCredits(admin, vendorId);

  if (balanceInfo.planCode === "taster" && balanceInfo.totalCredits < cost) {
    return {
      allowed: false,
      cost,
      balance: balanceInfo.totalCredits,
      planCredits: balanceInfo.planCredits,
      purchasedCredits: balanceInfo.purchasedCredits,
      message: "The Taster plan does not include AI features or credits. Upgrade to Crave, Thrive, or Crown to unlock AI capabilities.",
    };
  }

  if (balanceInfo.totalCredits < cost) {
    const actionLabel = AI_ACTION_LABELS[action] || "this AI action";
    return {
      allowed: false,
      cost,
      balance: balanceInfo.totalCredits,
      planCredits: balanceInfo.planCredits,
      purchasedCredits: balanceInfo.purchasedCredits,
      message: `You need ${cost} AI credit${cost === 1 ? "" : "s"} for ${actionLabel}, but your balance is ${balanceInfo.totalCredits}. Please top up your credits to continue.`,
    };
  }

  return {
    allowed: true,
    cost,
    balance: balanceInfo.totalCredits,
    planCredits: balanceInfo.planCredits,
    purchasedCredits: balanceInfo.purchasedCredits,
    isLow: balanceInfo.isLow,
  };
}

/**
 * Deducts credits for a successful AI action.
 * Rule: Uses plan's included credits first, then purchased credits.
 * Records the change and balance after into vendor_ai_credit_ledger.
 */
export async function deductVendorAiCredits(
  admin: SupabaseClient,
  vendorId: string,
  action: AiAction,
  notes?: string
): Promise<{
  success: boolean;
  deducted: number;
  newBalance: number;
  planCreditsAfter: number;
  purchasedCreditsAfter: number;
}> {
  const cost = AI_ACTION_COSTS[action] ?? 1;
  const current = await getVendorAiCredits(admin, vendorId);

  if (current.totalCredits < cost) {
    throw new Error(`Insufficient credits: requires ${cost}, available ${current.totalCredits}`);
  }

  // Deduct from plan_credits first, then purchased_credits
  const fromPlan = Math.min(current.planCredits, cost);
  const fromPurchased = cost - fromPlan;

  const newPlanCredits = current.planCredits - fromPlan;
  const newPurchasedCredits = current.purchasedCredits - fromPurchased;
  const newBalance = newPlanCredits + newPurchasedCredits;

  try {
    await admin
      .from("vendor_ai_credits")
      .update({
        plan_credits: newPlanCredits,
        purchased_credits: newPurchasedCredits,
        updated_at: new Date().toISOString(),
      })
      .eq("vendor_id", vendorId);

    const actionLabel = AI_ACTION_LABELS[action] || action;
    await admin.from("vendor_ai_credit_ledger").insert({
      vendor_id: vendorId,
      entry_type: "usage",
      action,
      credits_change: -cost,
      plan_credits_after: newPlanCredits,
      purchased_credits_after: newPurchasedCredits,
      balance_after: newBalance,
      notes: notes || actionLabel,
    });
  } catch (err) {
    console.error("Failed to persist credit deduction in DB:", err);
  }

  return {
    success: true,
    deducted: cost,
    newBalance,
    planCreditsAfter: newPlanCredits,
    purchasedCreditsAfter: newPurchasedCredits,
  };
}

/**
 * Applies immediate plan credits upon an upgrade.
 * Rule: On upgrade, new plan's credits apply immediately.
 * Purchased credits are never altered.
 */
export async function grantPlanAiCredits(
  admin: SupabaseClient,
  vendorId: string,
  newPlanCode: PlanCode,
  reason = "Plan upgrade credit allocation"
): Promise<{
  newBalance: number;
  newPlanCredits: number;
  purchasedCredits: number;
}> {
  const current = await getVendorAiCredits(admin, vendorId);
  const targetPlanCredits = PLAN_INCLUDED_CREDITS[newPlanCode] ?? 0;

  // New plan credits apply immediately
  const delta = targetPlanCredits - current.planCredits;
  const newBalance = targetPlanCredits + current.purchasedCredits;

  try {
    await admin
      .from("vendor_ai_credits")
      .upsert(
        {
          vendor_id: vendorId,
          plan_credits: targetPlanCredits,
          purchased_credits: current.purchasedCredits,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "vendor_id" }
      );

    await admin.from("vendor_ai_credit_ledger").insert({
      vendor_id: vendorId,
      entry_type: "grant",
      action: "plan_upgrade_grant",
      credits_change: delta,
      plan_credits_after: targetPlanCredits,
      purchased_credits_after: current.purchasedCredits,
      balance_after: newBalance,
      notes: `${reason} (${newPlanCode.toUpperCase()} plan: ${targetPlanCredits} credits)`,
    });
  } catch (err) {
    console.error("Failed to grant plan credits in DB:", err);
  }

  return {
    newBalance,
    newPlanCredits: targetPlanCredits,
    purchasedCredits: current.purchasedCredits,
  };
}

/**
 * Adds purchased credit pack credits to the vendor's balance.
 * Rule: Add credits to the vendor's balance ONLY AFTER payment is confirmed on the server.
 */
export async function addPurchasedAiCredits(
  admin: SupabaseClient,
  vendorId: string,
  packId: string,
  paymentReference: string
): Promise<{
  creditsAdded: number;
  newBalance: number;
  purchasedCredits: number;
}> {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error(`Unknown credit pack: ${packId}`);

  const current = await getVendorAiCredits(admin, vendorId);
  const newPurchased = current.purchasedCredits + pack.credits;
  const newBalance = current.planCredits + newPurchased;

  try {
    await admin
      .from("vendor_ai_credits")
      .upsert(
        {
          vendor_id: vendorId,
          plan_credits: current.planCredits,
          purchased_credits: newPurchased,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "vendor_id" }
      );

    await admin.from("vendor_ai_credit_ledger").insert({
      vendor_id: vendorId,
      entry_type: "purchase",
      action: "pack_purchase",
      credits_change: pack.credits,
      plan_credits_after: current.planCredits,
      purchased_credits_after: newPurchased,
      balance_after: newBalance,
      notes: `Purchased ${pack.name} (${pack.credits} credits). Razorpay Payment ID: ${paymentReference}`,
    });
  } catch (err) {
    console.error("Failed to add purchased credits in DB:", err);
  }

  return {
    creditsAdded: pack.credits,
    newBalance,
    purchasedCredits: newPurchased,
  };
}

/**
 * Allows Operations and Super Admin to add or remove credits with a mandatory reason.
 * Logs the action to both credit ledger and audit log.
 */
export async function adjustVendorAiCreditsAdmin(
  admin: SupabaseClient,
  vendorId: string,
  amount: number,
  reason: string,
  actorId: string
): Promise<{
  newBalance: number;
  planCreditsAfter: number;
  purchasedCreditsAfter: number;
}> {
  if (amount === 0) throw new Error("Adjustment amount cannot be zero.");
  if (!reason.trim()) throw new Error("A reason must be provided for manual credit adjustment.");

  const current = await getVendorAiCredits(admin, vendorId);

  let newPlanCredits = current.planCredits;
  let newPurchasedCredits = current.purchasedCredits;

  if (amount > 0) {
    // Add to purchased credits (permanent adjustment)
    newPurchasedCredits += amount;
  } else {
    // Deduct: plan credits first, then purchased credits
    const toDeduct = Math.abs(amount);
    if (current.totalCredits < toDeduct) {
      throw new Error(`Cannot deduct ${toDeduct} credits: vendor only has ${current.totalCredits} total credits.`);
    }
    const fromPlan = Math.min(newPlanCredits, toDeduct);
    const fromPurchased = toDeduct - fromPlan;
    newPlanCredits -= fromPlan;
    newPurchasedCredits -= fromPurchased;
  }

  const newBalance = newPlanCredits + newPurchasedCredits;

  try {
    await admin
      .from("vendor_ai_credits")
      .upsert(
        {
          vendor_id: vendorId,
          plan_credits: newPlanCredits,
          purchased_credits: newPurchasedCredits,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "vendor_id" }
      );

    await admin.from("vendor_ai_credit_ledger").insert({
      vendor_id: vendorId,
      entry_type: "adjustment",
      action: amount > 0 ? "admin_grant" : "admin_deduct",
      credits_change: amount,
      plan_credits_after: newPlanCredits,
      purchased_credits_after: newPurchasedCredits,
      balance_after: newBalance,
      notes: reason.trim(),
      actor_id: actorId,
    });

    // Also record in central audit_logs table
    await admin.from("audit_logs").insert({
      actor_id: actorId,
      action: amount > 0 ? "Granted vendor AI credits" : "Deducted vendor AI credits",
      entity_type: "vendor",
      entity_id: vendorId,
      after_data: {
        adjustmentAmount: amount,
        reason: reason.trim(),
        previousBalance: current.totalCredits,
        newBalance,
        newPlanCredits,
        newPurchasedCredits,
      },
    });
  } catch (err) {
    console.error("Failed to adjust credits in DB:", err);
  }

  return {
    newBalance,
    planCreditsAfter: newPlanCredits,
    purchasedCreditsAfter: newPurchasedCredits,
  };
}

/**
 * Loads the chronological credit ledger for a vendor.
 */
export async function getVendorAiCreditLedger(
  admin: SupabaseClient,
  vendorId: string,
  limit = 100
): Promise<CreditLedgerEntry[]> {
  const { data, error } = await admin
    .from("vendor_ai_credit_ledger")
    .select("id, vendor_id, entry_type, action, credits_change, plan_credits_after, purchased_credits_after, balance_after, notes, actor_id, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (!/does not exist|42P01/i.test(error.message)) {
      console.error("Failed to load credit ledger:", error);
    }
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    vendorId: row.vendor_id,
    entryType: row.entry_type,
    action: row.action,
    creditsChange: row.credits_change,
    planCreditsAfter: row.plan_credits_after,
    purchasedCreditsAfter: row.purchased_credits_after,
    balanceAfter: row.balance_after,
    notes: row.notes,
    actorId: row.actor_id,
    createdAt: row.created_at,
  }));
}
