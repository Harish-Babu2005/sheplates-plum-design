import test from "node:test";
import assert from "node:assert/strict";

/**
 * Test Suite: Vendor Isolation from Unpaid Orders
 * Verifies that orders awaiting payment, failed payments, expired orders, and abandoned checkouts
 * are completely isolated from vendors across normal orders, schedules, RFQs, and Food Drops.
 */

// Helper to simulate vendor order visibility filtering
function isPaidOrFoodDrop(o) {
  const isPaid = (o.payment === "Paid" && o.status !== "Awaiting payment");
  const isFoodDrop = Boolean(o.foodDropId) || o.paymentProvider === "food_drop_pickup";
  return isPaid || isFoodDrop;
}

function filterVendorOrders(orders, vendorId, todayStr) {
  return orders.filter((o) => {
    if (o.vendorId !== vendorId) return false;
    if (!isPaidOrFoodDrop(o)) return false;
    if (o.status === "Awaiting payment" || o.status === "Payment failed" || o.status === "Expired") return false;
    if (o.date && o.date < todayStr && o.payment !== "Paid") return false;
    return true;
  });
}

function computeVendorMetrics(visibleOrders, todayStr) {
  const ordersToday = visibleOrders.filter((x) => x.date === todayStr && x.status !== "Cancelled");
  const salesToday = ordersToday.reduce((sum, x) => sum + x.total, 0);
  const waitingForYou = visibleOrders.filter((x) => x.status === "Scheduled");
  const badgeCount = waitingForYou.length;
  return { ordersToday: ordersToday.length, salesToday, waitingForYou: waitingForYou.length, badgeCount };
}

test("Scenario 1: Add to cart only — Vendor metrics remain 0 and no order reaches vendor", () => {
  const cart = [{ id: "cart-1", customerEmail: "cust@sheplates.test", productId: "milk-1", vendorId: "vnd-praga", quantity: 2 }];
  const allOrders = [];
  const todayStr = "2026-11-18";

  const visible = filterVendorOrders(allOrders, "vnd-praga", todayStr);
  const metrics = computeVendorMetrics(visible, todayStr);

  assert.equal(visible.length, 0);
  assert.equal(metrics.ordersToday, 0);
  assert.equal(metrics.salesToday, 0);
  assert.equal(metrics.waitingForYou, 0);
  assert.equal(metrics.badgeCount, 0);
});

test("Scenario 2: Reach payment page and leave/abandon — Order is 'Awaiting payment', invisible to vendor", () => {
  const todayStr = "2026-11-18";
  const abandonedOrder = {
    id: "ORD-ABANDONED",
    customerEmail: "cust@sheplates.test",
    vendorId: "vnd-praga",
    total: 120,
    date: todayStr,
    slot: "6:00 AM - 7:30 AM",
    status: "Awaiting payment",
    payment: "Pending",
  };
  const allOrders = [abandonedOrder];

  const visible = filterVendorOrders(allOrders, "vnd-praga", todayStr);
  const metrics = computeVendorMetrics(visible, todayStr);

  assert.equal(visible.length, 0, "Unpaid order must not appear in vendor orders");
  assert.equal(metrics.ordersToday, 0, "'Orders today' must not count unpaid order");
  assert.equal(metrics.salesToday, 0, "'Sales today' must not sum unpaid order total");
  assert.equal(metrics.waitingForYou, 0, "'Waiting for you' must not include unpaid order");
  assert.equal(metrics.badgeCount, 0, "Navigation badge must not count unpaid order");
});

test("Scenario 3: Payment fails — Order becomes 'Payment failed', remains invisible to vendor", () => {
  const todayStr = "2026-11-18";
  const failedOrder = {
    id: "ORD-FAILED",
    customerEmail: "cust@sheplates.test",
    vendorId: "vnd-praga",
    total: 250,
    date: todayStr,
    slot: "7:00 AM - 8:30 AM",
    status: "Payment failed",
    payment: "Failed",
  };
  const allOrders = [failedOrder];

  const visible = filterVendorOrders(allOrders, "vnd-praga", todayStr);
  const metrics = computeVendorMetrics(visible, todayStr);

  assert.equal(visible.length, 0);
  assert.equal(metrics.ordersToday, 0);
  assert.equal(metrics.salesToday, 0);
  assert.equal(metrics.waitingForYou, 0);
  assert.equal(metrics.badgeCount, 0);
});

test("Scenario 4: Payment succeeds — Order becomes 'Confirmed', visible to vendor", () => {
  const todayStr = "2026-11-18";
  const confirmedOrder = {
    id: "ORD-CONFIRMED",
    customerEmail: "cust@sheplates.test",
    vendorId: "vnd-praga",
    total: 350,
    date: todayStr,
    slot: "6:00 AM - 7:30 AM",
    status: "Confirmed",
    payment: "Paid",
  };
  const allOrders = [confirmedOrder];

  const visible = filterVendorOrders(allOrders, "vnd-praga", todayStr);
  const metrics = computeVendorMetrics(visible, todayStr);

  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, "ORD-CONFIRMED");
  assert.equal(metrics.ordersToday, 1);
  assert.equal(metrics.salesToday, 350);
});

test("Scenario 5: Delayed webhook — Vendor only sees order AFTER webhook arrives", () => {
  const todayStr = "2026-11-18";
  const order = {
    id: "ORD-DELAYED",
    customerEmail: "cust@sheplates.test",
    vendorId: "vnd-praga",
    total: 500,
    date: todayStr,
    slot: "6:00 AM - 7:30 AM",
    status: "Awaiting payment",
    payment: "Pending",
  };

  // Phase 1: Customer submitted payment, webhook in transit
  let visible = filterVendorOrders([order], "vnd-praga", todayStr);
  assert.equal(visible.length, 0, "Vendor must NOT see order while webhook is in transit");

  // Phase 2: Webhook arrives and server marks payment captured
  order.status = "Confirmed";
  order.payment = "Paid";
  visible = filterVendorOrders([order], "vnd-praga", todayStr);
  assert.equal(visible.length, 1, "Vendor sees order once webhook confirms payment");
});

test("Scenario 6: Duplicate webhook — Idempotent confirmation does not double-count", () => {
  const todayStr = "2026-11-18";
  const order = {
    id: "ORD-IDEMPOTENT",
    customerEmail: "cust@sheplates.test",
    vendorId: "vnd-praga",
    total: 200,
    date: todayStr,
    slot: "6:00 AM - 7:30 AM",
    status: "Awaiting payment",
    payment: "Pending",
  };

  function processWebhook(event, currentOrder) {
    if (currentOrder.payment === "Paid") {
      return { ok: true, alreadyPaid: true };
    }
    currentOrder.payment = "Paid";
    currentOrder.status = "Confirmed";
    return { ok: true, alreadyPaid: false };
  }

  // First webhook
  const first = processWebhook({ event: "payment.captured" }, order);
  assert.equal(first.ok, true);
  assert.equal(first.alreadyPaid, false);

  // Duplicate webhook
  const second = processWebhook({ event: "payment.captured" }, order);
  assert.equal(second.ok, true);
  assert.equal(second.alreadyPaid, true);

  const visible = filterVendorOrders([order], "vnd-praga", todayStr);
  const metrics = computeVendorMetrics(visible, todayStr);
  assert.equal(visible.length, 1);
  assert.equal(metrics.salesToday, 200, "Sales total must not duplicate");
});

test("Scenario 7: Expiry of unpaid order — Expires after timeout and releases reserved stock", () => {
  let reservedStock = 10;
  const order = {
    id: "ORD-EXPIRED",
    vendorId: "vnd-praga",
    status: "Awaiting payment",
    payment: "Pending",
    units: 2,
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 minutes ago
  };

  function checkAndExpire(ord, timeoutMinutes = 30) {
    const ageMs = Date.now() - new Date(ord.createdAt).getTime();
    if (ageMs > timeoutMinutes * 60 * 1000 && ord.payment === "Pending") {
      ord.status = "Expired";
      ord.payment = "Expired";
      reservedStock -= ord.units;
      return true;
    }
    return false;
  }

  const expired = checkAndExpire(order);
  assert.equal(expired, true);
  assert.equal(order.status, "Expired");
  assert.equal(reservedStock, 8, "Reserved units released on expiry");

  const visible = filterVendorOrders([order], "vnd-praga", "2026-11-18");
  assert.equal(visible.length, 0, "Expired order invisible to vendor");
});

test("Scenario 8: Food Drop pay-at-store — Visible to vendor with verification code without online payment", () => {
  const todayStr = "2026-11-18";
  const foodDropOrder = {
    id: "ORD-FOOD-DROP",
    customerEmail: "cust@sheplates.test",
    vendorId: "vnd-praga",
    total: 80,
    date: todayStr,
    slot: "Store pickup",
    mode: "Self pickup",
    status: "Confirmed",
    payment: "Paid",
    foodDropId: "FD-101",
    paymentProvider: "food_drop_pickup",
    verificationCode: "7492",
    verificationStatus: "pending",
  };

  const visible = filterVendorOrders([foodDropOrder], "vnd-praga", todayStr);
  const metrics = computeVendorMetrics(visible, todayStr);

  assert.equal(visible.length, 1, "Food Drop pay-at-store must be visible to vendor");
  assert.equal(visible[0].verificationCode, "7492");
  assert.equal(metrics.ordersToday, 1);
  assert.equal(metrics.salesToday, 80);
});

test("Scenario 9: RFQ order awaiting payment — Invisible to vendor until customer pays", () => {
  const todayStr = "2026-11-18";
  const rfqOrder = {
    id: "RFQ-ORD-555",
    customerEmail: "cust@sheplates.test",
    vendorId: "vnd-praga",
    total: 1800,
    date: "2026-11-20",
    slot: "Vendor to confirm",
    status: "Awaiting payment",
    payment: "Pending",
  };

  let visible = filterVendorOrders([rfqOrder], "vnd-praga", todayStr);
  assert.equal(visible.length, 0, "Vendor must not see awarded RFQ order before customer pays");

  // Customer completes payment
  rfqOrder.status = "Confirmed";
  rfqOrder.payment = "Paid";

  visible = filterVendorOrders([rfqOrder], "vnd-praga", todayStr);
  assert.equal(visible.length, 1, "Vendor sees RFQ order once payment is confirmed");
});

test("Scenario 10: Server API rejects vendor acceptance of unpaid order", () => {
  function serverValidateOrderAccept(order, role, vendorId) {
    if (role === "vendor" && order.vendorId !== vendorId) {
      return { status: 403, error: "This order belongs to another store." };
    }
    const isPaid = order.payment === "Paid";
    const isFoodDrop = order.paymentProvider === "food_drop_pickup";
    if (role === "vendor" && !isPaid && !isFoodDrop) {
      return { status: 403, error: "Cannot accept an order before payment is confirmed." };
    }
    return { status: 200, ok: true };
  }

  const unpaidOrder = {
    id: "ORD-ROGUE",
    vendorId: "vnd-praga",
    status: "Awaiting payment",
    payment: "Pending",
  };

  const result = serverValidateOrderAccept(unpaidOrder, "vendor", "vnd-praga");
  assert.equal(result.status, 403);
  assert.equal(result.error, "Cannot accept an order before payment is confirmed.");
});

test("Scenario 11: Date-passed pending orders are completely excluded from vendor queues", () => {
  const todayStr = "2026-11-18";
  const pastPendingOrder = {
    id: "ORD-PAST-DATE",
    vendorId: "vnd-praga",
    date: "2026-11-15", // date has passed
    status: "Awaiting payment",
    payment: "Pending",
  };

  const visible = filterVendorOrders([pastPendingOrder], "vnd-praga", todayStr);
  assert.equal(visible.length, 0, "Past date pending order must never appear to vendor");
});

