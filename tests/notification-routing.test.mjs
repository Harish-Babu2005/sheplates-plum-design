import test from "node:test";
import assert from "node:assert/strict";
import {
  extractNotificationType,
  extractTargetId,
  buildNotificationUrl,
  resolveNotificationTarget,
  executeNotificationNavigation,
} from "../lib/notification-router.ts";

test("Notification Routing - Type Extraction", () => {
  // Explicit type
  assert.equal(extractNotificationType({ type: "order_assigned", title: "", body: "" }), "order_assigned");
  
  // EntityType inference
  assert.equal(extractNotificationType({ entityType: "customer_follow_request", title: "", body: "" }), "customer_follow_request");
  assert.equal(extractNotificationType({ entityType: "order", title: "", body: "" }), "order_status_changed");
  assert.equal(extractNotificationType({ entityType: "ticket", title: "", body: "" }), "ticket_updated");
  
  // Smart regex text fallback
  assert.equal(
    extractNotificationType({ title: "Delivery person assigned", body: "Ramesh will handle ORD-100." }),
    "order_assigned"
  );
  assert.equal(
    extractNotificationType({ title: "Complete payment", body: "Your quotation RFQ-200 is ready for payment." }),
    "rfq_payment_due"
  );
  assert.equal(
    extractNotificationType({ title: "A vendor sent a quotation", body: "Priya quoted for RFQ-200." }),
    "rfq_received"
  );
  assert.equal(
    extractNotificationType({ title: "Special batches", body: "New Food Drop DRP-500 is live." }),
    "food_drop_posted"
  );
  assert.equal(
    extractNotificationType({ title: "Support ticket updated", body: "TKT-300 status changed." }),
    "ticket_updated"
  );
  assert.equal(
    extractNotificationType({ title: "Payout sent", body: "Weekly settlement processed." }),
    "payout_sent"
  );
  assert.equal(
    extractNotificationType({ title: "Unrecognized update", body: "Random test notification." }),
    "unknown"
  );
});

test("Notification Routing - Target ID Extraction", () => {
  // Explicit entityId
  assert.equal(extractTargetId({ entityId: "ORD-999", title: "", body: "" }), "ORD-999");

  // Regex extraction from text
  assert.equal(
    extractTargetId({ title: "Delivery assigned", body: "Ramesh will handle order ORD-1234." }),
    "ORD-1234"
  );
  assert.equal(
    extractTargetId({ title: "Quotation received", body: "Vendor replied to RFQ-5678." }),
    "RFQ-5678"
  );
  assert.equal(
    extractTargetId({ title: "Ticket response", body: "Update on ticket TKT-9012." }),
    "TKT-9012"
  );
  assert.equal(
    extractTargetId({ title: "Cancellation notice", body: "Review CAN-3456 now." }),
    "CAN-3456"
  );
  assert.equal(
    extractTargetId({ title: "Food Drop Live", body: "Claim drop DRP-7890 today." }),
    "DRP-7890"
  );
  assert.equal(
    extractTargetId({ title: "Schedule Payment", body: "Your recurring meal SCH-4321 is active." }),
    "SCH-4321"
  );
  assert.equal(
    extractTargetId({ title: "Vendor Verification", body: "Review documents for VND-6543." }),
    "VND-6543"
  );
});

test("Notification Routing - Module Target Views", () => {
  const customerSession = { email: "ananya@sheplates.demo", role: "customer" };
  const vendorSession = { email: "priya@sheplates.demo", role: "vendor", vendorId: "VND-1" };
  const opsSession = { email: "ops@sheplates.demo", role: "operations" };
  const adminSession = { email: "admin@sheplates.demo", role: "admin" };

  // Orders screen
  const orderNotif = {
    id: "N1",
    recipient: "ananya@sheplates.demo",
    recipientRole: "customer",
    type: "order_assigned",
    title: "Delivery partner assigned",
    body: "Order ORD-100 is out with Ramesh.",
  };
  assert.equal(resolveNotificationTarget(orderNotif, customerSession).view, "Orders");
  assert.equal(resolveNotificationTarget(orderNotif, vendorSession).view, "Orders");
  assert.equal(resolveNotificationTarget(orderNotif, opsSession).view, "Orders");
  assert.equal(resolveNotificationTarget(orderNotif, customerSession).queryParams?.orderId, "ORD-100");

  // RFQ screen per role
  const rfqNotif = {
    id: "N2",
    recipient: "user@demo",
    recipientRole: "customer",
    type: "rfq_received",
    title: "A vendor sent a quotation",
    body: "Quote for RFQ-200 arrived.",
  };
  assert.equal(resolveNotificationTarget(rfqNotif, customerSession).view, "My quotations");
  assert.equal(resolveNotificationTarget(rfqNotif, vendorSession).view, "Quote opportunities");
  assert.equal(resolveNotificationTarget(rfqNotif, opsSession).view, "RFQ desk");

  // Food Drops screen
  const dropNotif = {
    id: "N3",
    recipient: "ananya@sheplates.demo",
    recipientRole: "customer",
    type: "food_drop_posted",
    title: "Food Drop available",
    body: "DRP-300 is live nearby.",
  };
  assert.equal(resolveNotificationTarget(dropNotif, customerSession).view, "Food Drops");
  assert.equal(resolveNotificationTarget(dropNotif, vendorSession).view, "Food Drops");

  // Subscriptions / Schedules
  const scheduleNotif = {
    id: "N4",
    recipient: "ananya@sheplates.demo",
    recipientRole: "customer",
    type: "schedule_payment_due",
    title: "Schedule created",
    body: "SCH-400 is ready for payment.",
  };
  assert.equal(resolveNotificationTarget(scheduleNotif, customerSession).view, "My schedule");
  assert.equal(resolveNotificationTarget(scheduleNotif, vendorSession).view, "Orders");

  // Tickets
  const ticketNotif = {
    id: "N5",
    recipient: "user@demo",
    recipientRole: "customer",
    type: "ticket_updated",
    title: "Ticket response",
    body: "TKT-500 was resolved.",
  };
  assert.equal(resolveNotificationTarget(ticketNotif, customerSession).view, "Ticket centre");
  assert.equal(resolveNotificationTarget(ticketNotif, vendorSession).view, "Ticket centre");
  assert.equal(resolveNotificationTarget(ticketNotif, opsSession).view, "Ticket centre");
  assert.equal(resolveNotificationTarget(ticketNotif, adminSession).view, "Ticket centre");

  // Cancellations
  const cancelNotif = {
    id: "N6",
    recipient: "ops@sheplates.demo",
    recipientRole: "operations",
    type: "cancellation_review",
    title: "Quality complaint",
    body: "CAN-600 needs review.",
  };
  assert.equal(resolveNotificationTarget(cancelNotif, opsSession).view, "Cancellations");
  assert.equal(resolveNotificationTarget(cancelNotif, customerSession).view, "Orders");

  // Settlements / Payouts
  const payoutNotif = {
    id: "N7",
    recipient: "priya@sheplates.demo",
    recipientRole: "vendor",
    type: "payout_sent",
    title: "Payout sent",
    body: "Payout of Rs 5000 sent.",
  };
  assert.equal(resolveNotificationTarget(payoutNotif, vendorSession).view, "Settlements");
  assert.equal(resolveNotificationTarget(payoutNotif, opsSession).view, "Vendor payments");
  assert.equal(resolveNotificationTarget(payoutNotif, adminSession).view, "Vendor payments");

  // Verification
  const verifyNotif = {
    id: "N8",
    recipient: "priya@sheplates.demo",
    recipientRole: "vendor",
    type: "vendor_verification_update",
    title: "Vendor verified",
    body: "VND-1 compliance approved.",
  };
  assert.equal(resolveNotificationTarget(verifyNotif, vendorSession).view, "Verification");
  assert.equal(resolveNotificationTarget(verifyNotif, opsSession).view, "Vendor verification");

  // Follow request
  const followNotif = {
    id: "N9",
    recipient: "ananya@sheplates.demo",
    recipientRole: "customer",
    type: "customer_follow_request",
    title: "New follower",
    body: "A user wants to follow your food stories.",
  };
  assert.equal(resolveNotificationTarget(followNotif, customerSession).view, "Stories");
});

test("Notification Routing - Missing or Deleted Target Handling", () => {
  const session = { email: "ananya@sheplates.demo", role: "customer" };
  const mockState = {
    orders: [{ id: "ORD-1", customerEmail: "ananya@sheplates.demo", vendorId: "VND-1" }],
    requirements: [{ id: "RFQ-1", customerEmail: "ananya@sheplates.demo" }],
    tickets: [{ id: "TKT-1", creatorEmail: "ananya@sheplates.demo" }],
  };

  // Target exists -> retains target ID query param
  const validOrderNotif = {
    id: "N1",
    recipient: "ananya@sheplates.demo",
    recipientRole: "customer",
    type: "order_assigned",
    title: "Delivery person assigned",
    body: "Order ORD-1 has an update.",
  };
  const validRoute = resolveNotificationTarget(validOrderNotif, session, mockState);
  assert.equal(validRoute.view, "Orders");
  assert.equal(validRoute.queryParams?.orderId, "ORD-1");
  assert.equal(validRoute.url, "/?view=Orders&orderId=ORD-1");

  // Target deleted / missing in state -> falls back gracefully to list view with message
  const deletedOrderNotif = {
    id: "N2",
    recipient: "ananya@sheplates.demo",
    recipientRole: "customer",
    type: "order_assigned",
    title: "Delivery person assigned",
    body: "Order ORD-DELETED has an update.",
  };
  const fallbackRoute = resolveNotificationTarget(deletedOrderNotif, session, mockState);
  assert.equal(fallbackRoute.view, "Orders");
  assert.equal(fallbackRoute.url, "/?view=Orders");
  assert.ok(fallbackRoute.message?.includes("no longer available"));
});

test("Notification Routing - Cross-User Isolation and Data Security", () => {
  const customerA = { email: "ananya@sheplates.demo", role: "customer" };
  const customerB = { email: "sneha@sheplates.demo", role: "customer" };
  const mockState = {
    orders: [{ id: "ORD-1", customerEmail: "sneha@sheplates.demo", vendorId: "VND-1" }],
  };

  const notif = {
    id: "N1",
    recipient: "ananya@sheplates.demo",
    recipientRole: "customer",
    type: "order_assigned",
    title: "Order update",
    body: "Update on ORD-1.",
  };

  // Customer A attempts to open Customer B's order
  const route = resolveNotificationTarget(notif, customerA, mockState);
  assert.equal(route.view, "Orders");
  assert.equal(route.accessDenied, true);
  assert.ok(route.message?.includes("Access denied"));
  // Does not leak target orderId in URL
  assert.equal(route.url, "/?view=Orders");
});

test("Notification Routing - Unknown Notification Type Fallback", () => {
  const session = { email: "ananya@sheplates.demo", role: "customer" };
  const unknownNotif = {
    id: "N99",
    recipient: "ananya@sheplates.demo",
    recipientRole: "customer",
    title: "Something happened",
    body: "Non-standard notification message.",
  };

  const route = resolveNotificationTarget(unknownNotif, session);
  assert.equal(route.view, "Notifications");
  assert.equal(route.url, "/?view=Notifications");
  assert.ok(route.message?.includes("notification list"));
});

test("Notification Routing - Logged Out Navigation Saves Pending URL", () => {
  let savedStorageKey = null;
  let savedStorageValue = null;
  let toastMsg = null;

  globalThis.window = {
    history: { pushState: () => {} },
  };
  globalThis.sessionStorage = {
    setItem: (key, val) => {
      savedStorageKey = key;
      savedStorageValue = val;
    },
    getItem: () => null,
    removeItem: () => {},
  };

  const route = {
    module: "customer",
    view: "Orders",
    url: "/?view=Orders&orderId=ORD-100",
  };

  let navigatedTo = null;
  executeNotificationNavigation(
    route,
    (v) => { navigatedTo = v; },
    false, // logged out
    (type, msg) => { toastMsg = msg; }
  );

  assert.equal(navigatedTo, null);
  assert.equal(savedStorageKey, "sheplates_pending_notification_url");
  assert.equal(savedStorageValue, "/?view=Orders&orderId=ORD-100");
  assert.ok(toastMsg?.includes("sign in"));

  delete globalThis.window;
  delete globalThis.sessionStorage;
});

test("Order Details Modal - Closing Cleans URL and Avoids Reopen Loop", () => {
  let currentUrl = "/?view=Orders&orderId=ORD-100";
  globalThis.window = {
    location: {
      search: "?view=Orders&orderId=ORD-100",
      pathname: "/",
    },
    history: {
      replaceState: (state, title, url) => {
        currentUrl = url;
        window.location.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
      },
    },
  };

  let detailsOrder = { id: "ORD-100", status: "Confirmed" };
  const lastAutoOpenedOrderIdRef = { current: "ORD-100" };

  // Simulate close
  const handleCloseDetails = () => {
    detailsOrder = null;
    const params = new URLSearchParams(window.location.search);
    if (params.has("orderId")) {
      lastAutoOpenedOrderIdRef.current = params.get("orderId");
      params.delete("orderId");
      const target = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({ page: "Orders" }, "", target);
    }
  };

  handleCloseDetails();

  assert.equal(detailsOrder, null);
  assert.equal(currentUrl, "/?view=Orders");
  assert.equal(window.location.search, "?view=Orders");
  assert.equal(lastAutoOpenedOrderIdRef.current, "ORD-100");

  delete globalThis.window;
});
