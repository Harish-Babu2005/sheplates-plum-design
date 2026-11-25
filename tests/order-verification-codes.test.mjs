import test from "node:test";
import assert from "node:assert/strict";
import {
  CODE_DIGITS,
  MAX_ATTEMPTS,
  generateOrderVerificationCode,
  hashOrderVerificationCode,
  encryptOrderVerificationCode,
  decryptOrderVerificationCode,
  verifyOrderVerificationCode,
  getCustomerCodeLabel,
  isCodeVisibleToCustomer,
} from "../lib/order-verification.mjs";
import {
  generateDeliveryVerificationCode,
  hashDeliveryVerificationCode,
  verifyDeliveryVerificationCode,
} from "../lib/third-party-delivery.mjs";

const TEST_SECRET = "test-service-role-secret-key-for-sheplates-verification-1234";

// In-memory state simulator mirroring server verification, lockout, bypass block, override & settlements
function createOrderSimulator() {
  const orders = new Map();
  const auditLogs = [];
  const notifications = [];

  function confirmOrderAfterPayment(orderId, fulfilmentMode, total = 250) {
    const isThirdParty = fulfilmentMode === "third_party_delivery";
    let code = null;
    let hash = null;
    let encrypted = null;
    if (!isThirdParty) {
      code = generateOrderVerificationCode();
      hash = hashOrderVerificationCode(orderId, code, TEST_SECRET);
      encrypted = encryptOrderVerificationCode(orderId, code, TEST_SECRET);
    }
    const order = {
      id: orderId,
      orderNumber: `SP-${orderId.toUpperCase()}`,
      customerId: "cust-1",
      vendorId: "vend-1",
      fulfilmentMode,
      status: "confirmed",
      total,
      verificationCodeHash: hash,
      verificationCodeEncrypted: encrypted,
      verificationAttempts: 0,
      verificationLockedAt: null,
      verifiedAt: null,
      completedViaOverride: false,
      overrideReason: null,
      overrideBy: null,
    };
    orders.set(orderId, order);
    return { order, plainCodeIssuedToServer: code };
  }

  function createLegacyInProgressOrder(orderId, fulfilmentMode, status = "out_for_delivery", total = 300) {
    // Legacy order created before verification feature went live (no hash/encrypted yet)
    const order = {
      id: orderId,
      orderNumber: `SP-LEGACY-${orderId}`,
      customerId: "cust-1",
      vendorId: "vend-1",
      fulfilmentMode,
      status,
      total,
      verificationCodeHash: null,
      verificationCodeEncrypted: null,
      verificationAttempts: 0,
      verificationLockedAt: null,
      verifiedAt: null,
      completedViaOverride: false,
      overrideReason: null,
      overrideBy: null,
    };
    orders.set(orderId, order);
    return order;
  }

  function getCustomerView(orderId, requesterRole, requesterId) {
    if (requesterRole !== "customer") {
      return { ok: false, status: 403, error: "Vendor and delivery staff cannot view verification codes." };
    }
    const order = orders.get(orderId);
    if (!order || order.customerId !== requesterId) {
      return { ok: false, status: 404, error: "Order not found." };
    }
    if (!isCodeVisibleToCustomer(order.status, order.fulfilmentMode)) {
      return { ok: true, visible: false, code: null };
    }
    if (!order.verificationCodeEncrypted) {
      // Backfill legacy in-progress order on-the-fly
      const code = generateOrderVerificationCode();
      order.verificationCodeHash = hashOrderVerificationCode(orderId, code, TEST_SECRET);
      order.verificationCodeEncrypted = encryptOrderVerificationCode(orderId, code, TEST_SECRET);
    }
    const code = decryptOrderVerificationCode(orderId, order.verificationCodeEncrypted, TEST_SECRET);
    return {
      ok: true,
      visible: true,
      code,
      label: getCustomerCodeLabel(order.fulfilmentMode),
    };
  }

  function getVendorOrderSnapshot(orderId) {
    const order = orders.get(orderId);
    if (!order) return null;
    // Explicitly strip any verification code secrets from vendor/delivery staff payload
    const { verificationCodeHash: _h, verificationCodeEncrypted: _e, ...safeFields } = order;
    return safeFields;
  }

  function updateOrderStatusDirect(orderId, nextStatus, actorRole) {
    const order = orders.get(orderId);
    if (!order) return { ok: false, status: 404, error: "Order not found." };
    if (nextStatus === "completed" || nextStatus === "delivered") {
      return {
        ok: false,
        status: 409,
        error: "Orders can only be completed by verifying the customer's verification code.",
      };
    }
    if (nextStatus === "cancelled") {
      order.status = "cancelled";
      return { ok: true, status: "cancelled" };
    }
    order.status = nextStatus;
    return { ok: true, status: nextStatus };
  }

  function verifyCode(orderId, code, actorRole = "vendor") {
    const order = orders.get(orderId);
    if (!order) return { ok: false, status: 404, error: "Order not found." };
    if (order.status === "completed" || order.status === "delivered") {
      return { ok: false, status: 409, error: "This order has already been completed." };
    }
    if (order.status === "cancelled") {
      return { ok: false, status: 409, error: "This order was cancelled." };
    }
    if (order.verificationAttempts >= MAX_ATTEMPTS || order.verificationLockedAt) {
      return { ok: false, status: 429, error: "Verification is locked after 5 failed attempts.", locked: true };
    }
    const valid = verifyOrderVerificationCode(orderId, code, order.verificationCodeHash, TEST_SECRET);
    if (valid) {
      const target = order.fulfilmentMode === "self_pickup" ? "completed" : "delivered";
      order.status = target;
      order.verifiedAt = new Date().toISOString();
      order.verificationAttempts = 0;
      notifications.push({ recipientId: order.customerId, title: `Order ${target}`, orderId });
      return { ok: true, status: target };
    }
    order.verificationAttempts += 1;
    if (order.verificationAttempts >= MAX_ATTEMPTS) {
      order.verificationLockedAt = new Date().toISOString();
      notifications.push({ recipientId: "ops-1", kind: "security_alert", orderId });
      return { ok: false, status: 429, error: "Verification locked after 5 failed attempts.", locked: true };
    }
    return { ok: false, status: 400, error: "Incorrect code", remainingAttempts: MAX_ATTEMPTS - order.verificationAttempts };
  }

  function operationsOverride(orderId, actorRole, actorId, reason) {
    if (actorRole !== "operations" && actorRole !== "admin") {
      return { ok: false, status: 403, error: "Only Operations can override order completion." };
    }
    if (!reason || reason.trim().length < 3) {
      return { ok: false, status: 400, error: "A valid reason is required." };
    }
    const order = orders.get(orderId);
    if (!order) return { ok: false, status: 404, error: "Order not found." };
    const target = order.fulfilmentMode === "self_pickup" ? "completed" : "delivered";
    const prev = order.status;
    order.status = target;
    order.completedViaOverride = true;
    order.overrideReason = reason.trim();
    order.overrideBy = actorId;
    order.verifiedAt = new Date().toISOString();
    auditLogs.push({
      actorId,
      actorRole,
      action: "operations_override_completion",
      entityId: orderId,
      reason: reason.trim(),
      previousStatus: prev,
      newStatus: target,
      timestamp: order.verifiedAt,
    });
    return { ok: true, status: target };
  }

  function computeVendorSettlements(vendorId) {
    let settledTotal = 0;
    let settledCount = 0;
    for (const order of orders.values()) {
      if (order.vendorId === vendorId && (order.status === "completed" || order.status === "delivered")) {
        settledTotal += order.total;
        settledCount += 1;
      }
    }
    return { settledTotal, settledCount };
  }

  return {
    orders,
    auditLogs,
    notifications,
    confirmOrderAfterPayment,
    createLegacyInProgressOrder,
    getCustomerView,
    getVendorOrderSnapshot,
    updateOrderStatusDirect,
    verifyCode,
    operationsOverride,
    computeVendorSettlements,
  };
}

test("1. Consistent 6-digit code format across Third-party, Vendor Delivery, Pickup & Food Drops", () => {
  assert.equal(CODE_DIGITS, 6);
  const thirdPartyCode = generateDeliveryVerificationCode();
  const orderCode = generateOrderVerificationCode();
  assert.match(thirdPartyCode, /^\d{6}$/);
  assert.match(orderCode, /^\d{6}$/);

  const tpHash = hashDeliveryVerificationCode("ord-tp-1", thirdPartyCode, TEST_SECRET);
  assert.equal(verifyDeliveryVerificationCode("ord-tp-1", thirdPartyCode, tpHash, TEST_SECRET), true);
  assert.equal(verifyDeliveryVerificationCode("ord-tp-1", "000000", tpHash, TEST_SECRET), thirdPartyCode === "000000");
});

test("2. Case 1 (Pickup): Correct code marks Completed, wrong code fails, vendor cannot see code", () => {
  const sim = createOrderSimulator();
  const { order, plainCodeIssuedToServer } = sim.confirmOrderAfterPayment("ord-pickup-1", "self_pickup", 400);

  // Move to Ready for pickup
  const stepRes = sim.updateOrderStatusDirect("ord-pickup-1", "ready_for_pickup", "vendor");
  assert.equal(stepRes.ok, true);

  // Customer sees code with correct label
  const custView = sim.getCustomerView("ord-pickup-1", "customer", "cust-1");
  assert.equal(custView.visible, true);
  assert.equal(custView.code, plainCodeIssuedToServer);
  assert.equal(custView.label, "Show this code at the store");

  // Vendor cannot see plain code in API response or snapshot
  const vendorView = sim.getCustomerView("ord-pickup-1", "vendor", "vend-1");
  assert.equal(vendorView.ok, false);
  assert.equal(vendorView.status, 403);
  const vendorSnap = sim.getVendorOrderSnapshot("ord-pickup-1");
  assert.equal("verificationCode" in vendorSnap, false);
  assert.equal("verificationCodeEncrypted" in vendorSnap, false);
  assert.equal("verificationCodeHash" in vendorSnap, false);

  // Wrong code fails
  const wrongCode = plainCodeIssuedToServer === "111111" ? "222222" : "111111";
  const wrongRes = sim.verifyCode("ord-pickup-1", wrongCode, "vendor");
  assert.equal(wrongRes.ok, false);
  assert.equal(wrongRes.remainingAttempts, 4);

  // Correct code succeeds
  const rightRes = sim.verifyCode("ord-pickup-1", plainCodeIssuedToServer, "vendor");
  assert.equal(rightRes.ok, true);
  assert.equal(rightRes.status, "completed");
  assert.equal(order.status, "completed");

  // Code is no longer visible to customer once completed
  const afterCustView = sim.getCustomerView("ord-pickup-1", "customer", "cust-1");
  assert.equal(afterCustView.visible, false);
});

test("3. Case 2 (Vendor Delivery): Correct code marks Delivered, wrong code fails, delivery staff cannot see code", () => {
  const sim = createOrderSimulator();
  const { order, plainCodeIssuedToServer } = sim.confirmOrderAfterPayment("ord-deliv-1", "vendor_delivery", 550);

  // Move to Out for delivery
  sim.updateOrderStatusDirect("ord-deliv-1", "out_for_delivery", "vendor");

  // Customer sees code with delivery label
  const custView = sim.getCustomerView("ord-deliv-1", "customer", "cust-1");
  assert.equal(custView.visible, true);
  assert.equal(custView.code, plainCodeIssuedToServer);
  assert.equal(custView.label, "Share this code only when you receive your order");

  // Wrong code fails
  const wrongCode = plainCodeIssuedToServer === "123456" ? "654321" : "123456";
  const wrongRes = sim.verifyCode("ord-deliv-1", wrongCode, "vendor");
  assert.equal(wrongRes.ok, false);

  // Correct code marks Delivered
  const rightRes = sim.verifyCode("ord-deliv-1", plainCodeIssuedToServer, "vendor");
  assert.equal(rightRes.ok, true);
  assert.equal(rightRes.status, "delivered");
  assert.equal(order.status, "delivered");
});

test("4. Attempts limit (5 wrong attempts locks code and notifies Operations)", () => {
  const sim = createOrderSimulator();
  const { order, plainCodeIssuedToServer } = sim.confirmOrderAfterPayment("ord-lock-1", "vendor_delivery");
  sim.updateOrderStatusDirect("ord-lock-1", "out_for_delivery", "vendor");
  const wrongCode = plainCodeIssuedToServer === "999999" ? "888888" : "999999";

  for (let i = 1; i <= 4; i++) {
    const res = sim.verifyCode("ord-lock-1", wrongCode, "vendor");
    assert.equal(res.ok, false);
    assert.equal(res.remainingAttempts, 5 - i);
    assert.equal(order.verificationLockedAt, null);
  }

  // 5th wrong attempt triggers lockout and Operations alert
  const fifth = sim.verifyCode("ord-lock-1", wrongCode, "vendor");
  assert.equal(fifth.ok, false);
  assert.equal(fifth.locked, true);
  assert.equal(fifth.status, 429);
  assert.ok(order.verificationLockedAt);
  assert.ok(sim.notifications.some((n) => n.recipientId === "ops-1" && n.kind === "security_alert" && n.orderId === "ord-lock-1"));

  // Even the correct code is now rejected while locked
  const afterLock = sim.verifyCode("ord-lock-1", plainCodeIssuedToServer, "vendor");
  assert.equal(afterLock.ok, false);
  assert.equal(afterLock.status, 429);
});

test("5. Used code cannot be reused and cancelled order code stops working", () => {
  const sim = createOrderSimulator();
  const { plainCodeIssuedToServer: code1 } = sim.confirmOrderAfterPayment("ord-used-1", "self_pickup");
  sim.updateOrderStatusDirect("ord-used-1", "ready_for_pickup", "vendor");
  assert.equal(sim.verifyCode("ord-used-1", code1, "vendor").ok, true);
  const reuse = sim.verifyCode("ord-used-1", code1, "vendor");
  assert.equal(reuse.ok, false);
  assert.equal(reuse.status, 409);

  const { plainCodeIssuedToServer: code2 } = sim.confirmOrderAfterPayment("ord-cancel-1", "vendor_delivery");
  sim.updateOrderStatusDirect("ord-cancel-1", "cancelled", "customer");
  const cancelAttempt = sim.verifyCode("ord-cancel-1", code2, "vendor");
  assert.equal(cancelAttempt.ok, false);
  assert.equal(cancelAttempt.status, 409);
  assert.equal(sim.getCustomerView("ord-cancel-1", "customer", "cust-1").visible, false);
});

test("6. Direct API status update without code must fail", () => {
  const sim = createOrderSimulator();
  sim.confirmOrderAfterPayment("ord-bypass-1", "self_pickup");
  const directComplete = sim.updateOrderStatusDirect("ord-bypass-1", "completed", "vendor");
  assert.equal(directComplete.ok, false);
  assert.equal(directComplete.status, 409);

  sim.confirmOrderAfterPayment("ord-bypass-2", "vendor_delivery");
  const directDeliver = sim.updateOrderStatusDirect("ord-bypass-2", "delivered", "vendor");
  assert.equal(directDeliver.ok, false);
  assert.equal(directDeliver.status, 409);
});

test("7. Operations override requires reason and writes audit entry", () => {
  const sim = createOrderSimulator();
  const { order } = sim.confirmOrderAfterPayment("ord-ovr-1", "vendor_delivery");
  sim.updateOrderStatusDirect("ord-ovr-1", "out_for_delivery", "vendor");

  // Vendor cannot override
  const vendorAttempt = sim.operationsOverride("ord-ovr-1", "vendor", "vend-1", "Customer lost phone");
  assert.equal(vendorAttempt.ok, false);
  assert.equal(vendorAttempt.status, 403);

  // Empty reason rejected
  const noReason = sim.operationsOverride("ord-ovr-1", "operations", "ops-1", "");
  assert.equal(noReason.ok, false);
  assert.equal(noReason.status, 400);

  // Valid Operations override succeeds and logs audit
  const okRes = sim.operationsOverride("ord-ovr-1", "operations", "ops-1", "Customer lost phone, verified over call");
  assert.equal(okRes.ok, true);
  assert.equal(order.status, "delivered");
  assert.equal(order.completedViaOverride, true);
  assert.equal(sim.auditLogs.length, 1);
  assert.equal(sim.auditLogs[0].actorId, "ops-1");
  assert.equal(sim.auditLogs[0].reason, "Customer lost phone, verified over call");
});

test("8. Legacy in-progress order at release time backfills code seamlessly", () => {
  const sim = createOrderSimulator();
  sim.createLegacyInProgressOrder("ord-legacy-1", "vendor_delivery", "out_for_delivery", 350);

  const custView = sim.getCustomerView("ord-legacy-1", "customer", "cust-1");
  assert.equal(custView.visible, true);
  assert.match(custView.code, /^\d{6}$/);

  const verifyRes = sim.verifyCode("ord-legacy-1", custView.code, "vendor");
  assert.equal(verifyRes.ok, true);
  assert.equal(verifyRes.status, "delivered");
});

test("9. Settlements only count orders after verification or Operations override", () => {
  const sim = createOrderSimulator();
  const { plainCodeIssuedToServer: codeA } = sim.confirmOrderAfterPayment("ord-settle-1", "self_pickup", 400);
  sim.confirmOrderAfterPayment("ord-settle-2", "vendor_delivery", 600);

  // Before verification: 0 settled
  assert.deepEqual(sim.computeVendorSettlements("vend-1"), { settledTotal: 0, settledCount: 0 });

  // Verify order 1
  sim.verifyCode("ord-settle-1", codeA, "vendor");
  assert.deepEqual(sim.computeVendorSettlements("vend-1"), { settledTotal: 400, settledCount: 1 });

  // Override order 2
  sim.operationsOverride("ord-settle-2", "operations", "ops-1", "Customer phone dead");
  assert.deepEqual(sim.computeVendorSettlements("vend-1"), { settledTotal: 1000, settledCount: 2 });
});
