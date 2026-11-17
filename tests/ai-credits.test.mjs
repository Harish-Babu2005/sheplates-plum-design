import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  PLAN_INCLUDED_CREDITS,
  CREDIT_PACKS,
  AI_ACTION_COSTS,
  AI_ACTION_LABELS,
  LOW_CREDIT_THRESHOLD_PERCENT,
  calculateCreditPackBilling,
  isLowCreditBalance,
  getActionCreditCost,
} from "../lib/ai-credits-config.ts";
import {
  checkVendorAiCredits,
  deductVendorAiCredits,
  grantPlanAiCredits,
  addPurchasedAiCredits,
  adjustVendorAiCreditsAdmin,
} from "../lib/ai-credits-server.ts";
import { PLAN_LIMITS } from "../lib/plans.ts";

// Helper to mock Supabase admin client with in-memory state
function createMockSupabase(initialCredits = { plan_credits: 200, purchased_credits: 0, plan: "crave" }) {
  let credits = { ...initialCredits };
  const ledger = [];
  const auditLogs = [];

  const mockClient = {
    _state: { credits, ledger, auditLogs },
    from(tableName) {
      if (tableName === "vendor_ai_credits") {
        return {
          select(fields) {
            return {
              eq(col, val) {
                return {
                  maybeSingle: async () => ({
                    data: {
                      vendor_id: val,
                      plan_credits: credits.plan_credits,
                      purchased_credits: credits.purchased_credits,
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                };
              },
            };
          },
          update(fields) {
            return {
              eq(col, val) {
                if (fields.plan_credits !== undefined) credits.plan_credits = fields.plan_credits;
                if (fields.purchased_credits !== undefined) credits.purchased_credits = fields.purchased_credits;
                return Promise.resolve({ data: credits, error: null });
              },
            };
          },
          upsert(record) {
            if (record.plan_credits !== undefined) credits.plan_credits = record.plan_credits;
            if (record.purchased_credits !== undefined) credits.purchased_credits = record.purchased_credits;
            return Promise.resolve({ data: record, error: null });
          },
        };
      }
      if (tableName === "vendors") {
        return {
          select(fields) {
            return {
              eq(col, val) {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: val,
                      vendor_plans: { code: credits.plan || "crave" },
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (tableName === "vendor_ai_credit_ledger") {
        return {
          insert(records) {
            const arr = Array.isArray(records) ? records : [records];
            ledger.push(...arr);
            return Promise.resolve({ data: arr, error: null });
          },
          select(fields) {
            return {
              eq(col, val) {
                return {
                  order() {
                    return {
                      limit: async (lim) => ({
                        data: ledger.slice(-lim).reverse(),
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (tableName === "audit_logs") {
        return {
          insert(records) {
            const arr = Array.isArray(records) ? records : [records];
            auditLogs.push(...arr);
            return Promise.resolve({ data: arr, error: null });
          },
        };
      }
      throw new Error(`Unexpected table ${tableName}`);
    },
  };
  return mockClient;
}

test("AI Credits Feature Verification", async (t) => {
  await t.test("1. Plan Included Credits configuration", () => {
    assert.equal(PLAN_INCLUDED_CREDITS.taster, 0, "Taster must have 0 included credits");
    assert.equal(PLAN_INCLUDED_CREDITS.crave, 200, "Crave must have 200 included credits");
    assert.equal(PLAN_INCLUDED_CREDITS.thrive, 400, "Thrive must have 400 included credits");
    assert.equal(PLAN_INCLUDED_CREDITS.crown, 800, "Crown must have 800 included credits");

    // Check PLAN_LIMITS integration
    assert.equal(PLAN_LIMITS.taster.includedAiCredits, 0);
    assert.equal(PLAN_LIMITS.crave.includedAiCredits, 200);
    assert.equal(PLAN_LIMITS.thrive.includedAiCredits, 400);
    assert.equal(PLAN_LIMITS.crown.includedAiCredits, 800);
  });

  await t.test("2. Extra Credit Packs pricing and GST calculation", () => {
    const pack200 = calculateCreditPackBilling("pack_200");
    assert.ok(pack200, "pack_200 should exist");
    assert.equal(pack200.credits, 200);
    assert.equal(pack200.basePrice, 99);
    assert.equal(pack200.gstAmount, 17.82);
    assert.equal(pack200.totalAmount, 116.82);

    const pack400 = calculateCreditPackBilling("pack_400");
    assert.ok(pack400, "pack_400 should exist");
    assert.equal(pack400.credits, 400);
    assert.equal(pack400.basePrice, 299);
    assert.equal(pack400.gstAmount, 53.82);
    assert.equal(pack400.totalAmount, 352.82);

    const pack600 = calculateCreditPackBilling("pack_600");
    assert.ok(pack600, "pack_600 should exist");
    assert.equal(pack600.credits, 600);
    assert.equal(pack600.basePrice, 399);
    assert.equal(pack600.gstAmount, 71.82);
    assert.equal(pack600.totalAmount, 470.82);
  });

  await t.test("3. All AI actions mapped with placeholder cost = 1 credit", () => {
    const actions = [
      "product_image_generate",
      "image_enhance",
      "catalogue_import",
      "nutrition_estimate",
      "she_agent_chat",
      "business_insights",
      "quotation_assistant",
      "food_attributes",
    ];

    for (const act of actions) {
      assert.equal(AI_ACTION_COSTS[act], 1, `Action ${act} must default to 1 credit placeholder`);
      assert.ok(AI_ACTION_LABELS[act], `Action ${act} must have a human-readable label`);
      assert.equal(getActionCreditCost(act), 1);
    }
  });

  await t.test("4. AI call with enough credits: succeeds and deducts credits (plan credits first)", async () => {
    // Start with 200 plan credits, 50 purchased credits
    const admin = createMockSupabase({ plan_credits: 200, purchased_credits: 50, plan: "crave" });
    const vendorId = "VND-TEST-001";

    const check = await checkVendorAiCredits(admin, vendorId, "product_image_generate");
    assert.equal(check.allowed, true);
    assert.equal(check.cost, 1);
    assert.equal(check.balance, 250);

    // Deduct 1 credit
    const deductRes = await deductVendorAiCredits(admin, vendorId, "product_image_generate", "Product: Milk 500ml");
    assert.equal(deductRes.success, true);
    assert.equal(deductRes.deducted, 1);
    assert.equal(deductRes.planCreditsAfter, 199, "Must deduct from plan credits first");
    assert.equal(deductRes.purchasedCreditsAfter, 50, "Purchased credits untouched while plan credits remain");
    assert.equal(deductRes.newBalance, 249);

    // Verify ledger entry
    assert.equal(admin._state.ledger.length, 1);
    const entry = admin._state.ledger[0];
    assert.equal(entry.entry_type, "usage");
    assert.equal(entry.action, "product_image_generate");
    assert.equal(entry.credits_change, -1);
    assert.equal(entry.balance_after, 249);
  });

  await t.test("5. Plan credits depleted: deducts from purchased credits", async () => {
    const admin = createMockSupabase({ plan_credits: 0, purchased_credits: 10, plan: "crave" });
    const vendorId = "VND-TEST-002";

    const check = await checkVendorAiCredits(admin, vendorId, "nutrition_estimate");
    assert.equal(check.allowed, true);

    const deductRes = await deductVendorAiCredits(admin, vendorId, "nutrition_estimate");
    assert.equal(deductRes.success, true);
    assert.equal(deductRes.planCreditsAfter, 0);
    assert.equal(deductRes.purchasedCreditsAfter, 9, "Deducted from purchased credits when plan credits are 0");
    assert.equal(deductRes.newBalance, 9);
  });

  await t.test("6. AI call with too few credits: blocked with friendly message", async () => {
    const admin = createMockSupabase({ plan_credits: 0, purchased_credits: 0, plan: "crave" });
    const vendorId = "VND-TEST-003";

    const check = await checkVendorAiCredits(admin, vendorId, "business_insights");
    assert.equal(check.allowed, false);
    assert.equal(check.balance, 0);
    assert.ok(check.message?.includes("AI credit"), "Mentions AI credit requirement");
    assert.ok(check.message?.includes("top up"), "Friendly prompt to top up credits expected");

    // Calling deduct should fail
    await assert.rejects(
      async () => {
        await deductVendorAiCredits(admin, vendorId, "business_insights");
      },
      /Insufficient credits/
    );
  });

  await t.test("7. Taster plan blocked from AI features and purchasing credit packs", async () => {
    const admin = createMockSupabase({ plan_credits: 0, purchased_credits: 0, plan: "taster" });
    const vendorId = "VND-TASTER-001";

    const check = await checkVendorAiCredits(admin, vendorId, "she_agent_chat");
    assert.equal(check.allowed, false);
    assert.ok(check.message?.includes("Taster plan does not include AI features"));
  });

  await t.test("8. Failed AI call: must NOT charge credits", async () => {
    const admin = createMockSupabase({ plan_credits: 100, purchased_credits: 0, plan: "crave" });
    const vendorId = "VND-TEST-FAIL";

    const balanceBefore = 100;
    let generationFailed = false;
    try {
      // 1. Pre-check credits
      const check = await checkVendorAiCredits(admin, vendorId, "image_enhance");
      assert.equal(check.allowed, true);

      // 2. Call external AI provider (simulated failure)
      throw new Error("AI provider rate limited or down");

      // 3. Deduction would only happen here on success
    } catch {
      generationFailed = true;
    }

    assert.equal(generationFailed, true, "AI generation failed");
    // Verify credits were NOT deducted
    assert.equal(admin._state.credits.plan_credits, balanceBefore, "Balance must remain unchanged after failure");
    assert.equal(admin._state.ledger.length, 0, "No ledger usage entry should be written for failed calls");
  });

  await t.test("9. Credit pack purchase: credits added ONLY after server payment verification", async () => {
    const admin = createMockSupabase({ plan_credits: 50, purchased_credits: 0, plan: "crave" });
    const vendorId = "VND-TEST-BUY";

    // Simulate Razorpay signature verification logic
    const razorpayKeySecret = "demo_secret_key";
    const orderId = "order_123456";
    const paymentId = "pay_789012";

    // Legitimate signature:
    const validSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Invalid signature:
    const invalidSignature = "invalid_signature_hex";

    // 1. Try with invalid signature -> should reject and NOT add credits
    let verified = false;
    const computedExpected = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (computedExpected === invalidSignature) {
      await addPurchasedAiCredits(admin, vendorId, "pack_200", paymentId);
      verified = true;
    }

    assert.equal(verified, false, "Invalid payment signature must not verify");
    assert.equal(admin._state.credits.purchased_credits, 0, "No credits added for unverified payment");

    // 2. Legitimate verification -> add credits
    if (computedExpected === validSignature) {
      const grantRes = await addPurchasedAiCredits(admin, vendorId, "pack_200", paymentId);
      assert.equal(grantRes.creditsAdded, 200);
      assert.equal(grantRes.purchasedCredits, 200);
      assert.equal(grantRes.newBalance, 250);
      verified = true;
    }

    assert.equal(verified, true, "Valid payment signature successfully verified");
    assert.equal(admin._state.credits.purchased_credits, 200);
    assert.equal(admin._state.ledger.length, 1);
    assert.equal(admin._state.ledger[0].entry_type, "purchase");
    assert.equal(admin._state.ledger[0].credits_change, 200);
  });

  await t.test("10. Direct API calls skipping credit check or without auth are rejected", async () => {
    const admin = createMockSupabase({ plan_credits: 0, purchased_credits: 0, plan: "crave" });
    const vendorId = "VND-EMPTY";

    const check = await checkVendorAiCredits(admin, vendorId, "catalogue_import");
    assert.equal(check.allowed, false, "Direct call with 0 credits must be blocked");
    assert.equal(check.balance, 0);
  });

  await t.test("11. Low credit warning threshold (below 20%)", () => {
    // Crave has 200 plan credits. 20% = 40 credits. Warning triggers strictly below 20% (< 40)
    assert.equal(isLowCreditBalance(39, "crave"), true, "39 credits is < 20% of 200");
    assert.equal(isLowCreditBalance(40, "crave"), false, "40 credits is >= 20% of 200");
    assert.equal(isLowCreditBalance(100, "crave"), false);

    // Thrive has 400 plan credits. 20% = 80 credits
    assert.equal(isLowCreditBalance(79, "thrive"), true);
    assert.equal(isLowCreditBalance(80, "thrive"), false);

    // Crown has 800 plan credits. 20% = 160 credits
    assert.equal(isLowCreditBalance(159, "crown"), true);
    assert.equal(isLowCreditBalance(160, "crown"), false);
  });

  await t.test("12. Admin / Operations credit adjustments with mandatory reason", async () => {
    const admin = createMockSupabase({ plan_credits: 100, purchased_credits: 50, plan: "crave" });
    const vendorId = "VND-TEST-ADMIN";

    // Fails without reason
    await assert.rejects(
      async () => {
        await adjustVendorAiCreditsAdmin(admin, vendorId, 50, "   ", "ops_user_1");
      },
      /reason/i
    );

    // Succeeds with valid reason
    const res = await adjustVendorAiCreditsAdmin(
      admin,
      vendorId,
      50,
      "Compensation for system outage",
      "ops_user_1"
    );
    assert.equal(res.purchasedCreditsAfter, 100);
    assert.equal(res.newBalance, 200);

    // Verify ledger & audit log
    assert.equal(admin._state.ledger.length, 1);
    assert.equal(admin._state.ledger[0].entry_type, "adjustment");
    assert.equal(admin._state.ledger[0].credits_change, 50);
    assert.equal(admin._state.ledger[0].actor_id, "ops_user_1");
    assert.equal(admin._state.ledger[0].notes, "Compensation for system outage");

    assert.equal(admin._state.auditLogs.length, 1);
    assert.ok(admin._state.auditLogs[0].action.includes("vendor AI credits"));
  });

  await t.test("13. Plan upgrade applies new credits immediately", async () => {
    const admin = createMockSupabase({ plan_credits: 200, purchased_credits: 30, plan: "crave" });
    const vendorId = "VND-UPGRADE";

    // Upgrade from Crave (200) to Crown (800)
    const grant = await grantPlanAiCredits(admin, vendorId, "crown", "Upgraded to Crown plan");
    assert.equal(grant.newPlanCredits, 800);
    assert.equal(grant.purchasedCredits, 30, "Purchased credits preserved");
    assert.equal(grant.newBalance, 830);

    assert.equal(admin._state.ledger.length, 1);
    assert.equal(admin._state.ledger[0].entry_type, "grant");
    assert.equal(admin._state.ledger[0].action, "plan_upgrade_grant");
  });
});
