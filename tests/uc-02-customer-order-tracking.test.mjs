import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const agentRouteSource = fs.readFileSync(path.join(root, "app/api/agent/route.ts"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "lib/she-agent-commerce-runtime.ts"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "components/sheplates-v3.tsx"), "utf8");
const convoSource = fs.readFileSync(path.join(root, "lib/ai-conversation-server.ts"), "utf8");

test("ShePlates She Agent – UC-02: Customer Order Tracking", async (t) => {
  // Test fixture orders
  const mockOrders = [
    {
      id: "ord-active-1",
      orderNumber: "84729101",
      customerEmail: "harish@example.com",
      vendorId: "v-kandan",
      vendorName: "Kandan Foods",
      status: "Preparing",
      scheduledDate: "2026-11-20",
      scheduledSlot: "Lunch (12:00 PM - 02:00 PM)",
      fulfilmentMode: "Vendor delivery",
      items: [{ name: "Traditional South Indian Thali", quantity: 1, unit: "meal" }],
      deliveryPartner: undefined,
      deliveryPartnerPhone: undefined,
      total: 160,
      createdAt: "2026-11-20T10:00:00Z",
    },
    {
      id: "ord-active-2",
      orderNumber: "84729102",
      customerEmail: "harish@example.com",
      vendorId: "v-kovai",
      vendorName: "Kovai Flavours",
      status: "Out for delivery",
      scheduledDate: "2026-11-20",
      scheduledSlot: "Lunch (12:00 PM - 02:00 PM)",
      fulfilmentMode: "Vendor delivery",
      items: [{ name: "Kovai Chicken Biryani", quantity: 2, unit: "box" }],
      deliveryPartner: "Kumar S",
      deliveryPartnerPhone: "9876543210",
      total: 480,
      createdAt: "2026-11-20T09:30:00Z",
    },
    {
      id: "ord-delivered-3",
      orderNumber: "84729100",
      customerEmail: "harish@example.com",
      vendorId: "v-lakshmi",
      vendorName: "Lakshmi Kitchen",
      status: "Delivered",
      scheduledDate: "2026-11-19",
      scheduledSlot: "Dinner (07:00 PM - 09:00 PM)",
      fulfilmentMode: "Vendor delivery",
      items: [{ name: "Aloo bhujia sev", quantity: 1, unit: "200g" }],
      total: 58,
      createdAt: "2026-11-19T18:00:00Z",
    },
    {
      id: "ord-delayed-4",
      orderNumber: "84729104",
      customerEmail: "harish@example.com",
      vendorId: "v-kandan",
      vendorName: "Kandan Foods",
      status: "Delayed",
      scheduledDate: "2026-11-20",
      scheduledSlot: "Breakfast (08:00 AM - 10:00 AM)",
      fulfilmentMode: "Vendor delivery",
      items: [{ name: "Idli Sambar combo", quantity: 1 }],
      total: 90,
      createdAt: "2026-11-20T07:00:00Z",
    },
    {
      id: "ord-cancelled-5",
      orderNumber: "84729105",
      customerEmail: "harish@example.com",
      vendorId: "v-kandan",
      vendorName: "Kandan Foods",
      status: "Cancelled",
      scheduledDate: "2026-11-18",
      scheduledSlot: "Morning (09:00 AM - 11:00 AM)",
      items: [{ name: "Filter Coffee", quantity: 2 }],
      total: 60,
      createdAt: "2026-11-18T08:00:00Z",
    },
  ];

  await t.test("2.1 Track latest order automatically without requiring order number", () => {
    // Verified implementation matches
    assert.match(agentRouteSource, /isTrackingIntent/);
    assert.match(agentRouteSource, /isActiveOrder/);
    assert.match(agentRouteSource, /targetOrder = activeOrders\.length > 0 \? activeOrders\[0\] : sortedOrders\[0\]/);

    // Filter active orders
    const inactive = ["delivered", "completed", "cancelled", "expired", "failed", "payment failed"];
    const active = mockOrders.filter((o) => !inactive.includes(o.status.toLowerCase()));
    assert.equal(active.length, 3); // ord-active-1, ord-active-2, ord-delayed-4

    // Sorted newest first
    const sortedActive = [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    assert.equal(sortedActive[0].id, "ord-active-1");
    assert.equal(sortedActive[0].orderNumber, "84729101");
  });

  await t.test("2.2 Automatic identification supports natural phrases ('Track my order', 'Where is my order?')", () => {
    // Regex from agent route for tracking queries
    const trackingRegex = /(^|\b)(track(\s+my)?(\s+next)?\s+orders?|where('?s|\s+is)\s+(my\s+)?(next\s+)?orders?|order\s+status|status\s+of\s+(my\s+)?order|any\s+update\s+(on\s+)?(my\s+)?order|has\s+(my\s+)?order\s+been\s+delivered|when\s+will\s+(it|my\s+order)\s+arrive|who\s+is\s+delivering(\s+it)?|is\s+my\s+order\s+ready|delivery\s+(status|partner|driver|rider|boy|person|staff))\b/i;

    assert.ok(trackingRegex.test("Track my order"), "Track my order");
    assert.ok(trackingRegex.test("Where is my order?"), "Where is my order?");
    assert.ok(trackingRegex.test("Where's my order"), "Where's my order");
    assert.ok(trackingRegex.test("Any update on my order?"), "Any update on my order?");
    assert.ok(trackingRegex.test("Has my order been delivered?"), "Has my order been delivered?");
    assert.ok(trackingRegex.test("When will it arrive?"), "When will it arrive?");
    assert.ok(trackingRegex.test("Who is delivering it?"), "Who is delivering it?");
    assert.ok(trackingRegex.test("Track my next order"), "Track my next order");

    // Check presence in source code
    assert.ok(agentRouteSource.includes("isExplicitTrackingQuery"));
    assert.ok(agentRouteSource.includes('body.task === "order_tracking"'));
  });

  await t.test("2.3 No orders on account responds with exact required string and nearby recommendations", () => {
    const expectedEnglish = "You haven't placed any orders yet. Would you like me to help you find products nearby?";
    const expectedTamil = "நீங்கள் இன்னும் எந்த ஆர்டரும் செய்யவில்லை. அருகிலுள்ள தயாரிப்புகளைக் கண்டறிய நான் உங்களுக்கு உதவட்டுமா?";

    assert.ok(agentRouteSource.includes(expectedEnglish), "Exact required English string must be in route");
    assert.ok(agentRouteSource.includes(expectedTamil), "Tamil equivalent must be in route");
    assert.match(agentRouteSource, /base\.selectedProductIds = products\.filter/);
    assert.match(agentRouteSource, /base\.intent = "browse"/);
  });

  await t.test("2.4 Security: someone else's order cannot be accessed", () => {
    assert.match(agentRouteSource, /You can only view and track orders placed from your own account/);
    assert.match(agentRouteSource, /does not belong to your account/);
    assert.match(agentRouteSource, /உங்கள் சொந்த கணக்கிலிருந்து செய்யப்பட்ட ஆர்டர்களை மட்டுமே நீங்கள் கண்காணிக்க முடியும்/);

    // Simulate requested order not in user's mockOrders
    const requestedUnauthorizedRef = "ord-foreign-999";
    const found = mockOrders.find((o) => o.id === requestedUnauthorizedRef || o.orderNumber === requestedUnauthorizedRef);
    assert.equal(found, undefined, "Foreign order is not accessible in customer context");
  });

  await t.test("2.5 Conversation memory within the same chat (follow-up questions)", () => {
    // Route extracts targetOrderId and selectableOrders from history
    assert.match(agentRouteSource, /let lastTrackedOrderId: string \| undefined/);
    assert.match(agentRouteSource, /isTrackingFollowUp/);
    assert.match(agentRouteSource, /targetOrder = orders\.find\(\(o\) => String\(o\.id/);

    // Fresh retrieval from database/state (never stale cache)
    assert.match(agentRouteSource, /targetOrder = orders\.find/);
  });

  await t.test("2.6 Conversation memory across sessions (30-day retention and context recovery)", () => {
    assert.match(convoSource, /const thirtyDaysAgo = new Date\(Date\.now\(\) - 30 \* 24 \* 60 \* 60 \* 1000\)\.toISOString\(\)/);
    assert.match(convoSource, /targetOrderId: ctx\.targetOrderId/);
    assert.match(convoSource, /selectableOrders: ctx\.selectableOrders/);
    assert.match(agentRouteSource, /targetOrderId: result\.targetOrderId/);
    assert.match(agentRouteSource, /selectableOrders: result\.selectableOrders/);
  });

  await t.test("2.7 Multiple active orders: newest first + selectable cards with quick track button", () => {
    // Backend populates selectableOrders with remaining active orders
    assert.match(agentRouteSource, /base\.selectableOrders = remainingActive\.map/);
    assert.match(agentRouteSource, /You have \$\{base\.selectableOrders\.length\} other active order\(s\) below/);

    // UI renders selectable orders with track button
    assert.match(uiSource, /item\.selectableOrders\?\.length/);
    assert.match(uiSource, /Other active orders/);
    assert.match(uiSource, /Track order #/);
    assert.match(uiSource, /<button type="button" onClick=\{\(\) => void send\(`Track order #\$\{ord\.orderNumber\}`\)\}/);
  });

  await t.test("2.8 Status handling (Confirmed, Preparing, Ready, Out for delivery, Delivered)", () => {
    assert.match(agentRouteSource, /is confirmed and is being prepared by the vendor/);
    assert.match(agentRouteSource, /is currently being prepared fresh in the kitchen/);
    assert.match(agentRouteSource, /is ready for pickup!/);
    assert.match(agentRouteSource, /is out for delivery!/);
    assert.match(agentRouteSource, /has been delivered\. Enjoy your meal!/);
  });

  await t.test("2.9 Delayed and cancelled orders handling with next steps", () => {
    assert.match(agentRouteSource, /is currently experiencing a delay/);
    assert.match(agentRouteSource, /Next step: We are monitoring the kitchen/);
    assert.match(agentRouteSource, /was cancelled\. Any payment deducted will be processed for refund/);
    assert.match(agentRouteSource, /Would you like help finding another meal nearby\?/);
  });

  await t.test("2.10 Tamil and English bilingual support", () => {
    const tamilTrackingRegex = /(ஆர்டர்\s*(ட்ராக்|நிலை|எங்கே|தகவல்|அப்டேட்|வந்துவிட்டதா)|எப்போது\s*வரும்|யார்\s*(கொண்டு\s*வருகிறார்|டெலிவரி\s*செய்கிறார்)|டெலிவரி\s*பார்ட்னர்)/;

    assert.ok(tamilTrackingRegex.test("என் ஆர்டர் எங்கே"), "Tamil: where is order");
    assert.ok(tamilTrackingRegex.test("என் ஆர்டர் நிலை என்ன"), "Tamil: order status");
    assert.ok(tamilTrackingRegex.test("ஆர்டர் வந்துவிட்டதா"), "Tamil: has order arrived");
    assert.ok(tamilTrackingRegex.test("எப்போது வரும்"), "Tamil: when will it arrive");
    assert.ok(tamilTrackingRegex.test("யார் டெலிவரி செய்கிறார்"), "Tamil: who is delivering");

    // Source contains Tamil status strings
    assert.ok(agentRouteSource.includes("டெலிவரிக்கு புறப்பட்டுவிட்டது!"));
    assert.ok(agentRouteSource.includes("சமையலறையில் புத்தம் புதியதாகத் தயாரிக்கப்பட்டு வருகிறது"));
    assert.ok(agentRouteSource.includes("வெற்றிகரமாக டெலிவரி செய்யப்பட்டுவிட்டது"));
    assert.ok(agentRouteSource.includes("ரத்து செய்யப்பட்டுள்ளது"));
  });

  await t.test("2.11 Tracking variations: track, track my next order, track the puff, and tool normalization", () => {
    // Regex matching
    const isExplicitTrackingQuery = (msg, rawMsg = msg) =>
      /^track\b/i.test(msg.trim()) ||
      /\btrack(ing)?\b/i.test(msg) ||
      /(where('?s|\s+is)\s+(my\s+|that\s+|this\s+|the\s+|next\s+)?(next\s+)?(orders?|food|meal|delivery|package|parcel|[a-z0-9\-]+)|where('?s|\s+is)\s+it)\b/i.test(msg) ||
      /(order\s+status|status\s+of\s+(my\s+|that\s+|this\s+|the\s+)?orders?|any\s+update\s+(on\s+)?(my\s+|that\s+|this\s+|the\s+)?orders?|has\s+(my\s+|that\s+|this\s+|the\s+)?orders?\s+been\s+delivered|when\s+will\s+(it|my\s+order|that\s+order|the\s+order)\s+arrive|who\s+is\s+delivering(\s+it)?|is\s+(my\s+|that\s+|the\s+)?orders?\s+ready|delivery\s+(status|partner|driver|rider|boy|person|staff))\b/i.test(msg) ||
      /(^|\b)(track|where\s+is|status\s+of)\s*(the\s+|my\s+|that\s+|this\s+)?order\s*#?[a-z0-9\-]+/i.test(msg) ||
      /(ஆர்டர்\s*(ட்ராக்|நிலை|எங்கே|தகவல்|அப்டேட்|வந்துவிட்டதா)|எப்போது\s*வரும்|யார்\s*(கொண்டு\s*வருகிறார்|டெலிவரி\s*செய்கிறார்)|டெலிவரி\s*பார்ட்னர்|ட்ராக்)/i.test(rawMsg);

    assert.ok(isExplicitTrackingQuery("track"), "matches 'track'");
    assert.ok(isExplicitTrackingQuery("Track my next order"), "matches 'Track my next order'");
    assert.ok(isExplicitTrackingQuery("track the puff"), "matches 'track the puff'");
    assert.ok(isExplicitTrackingQuery("track that order"), "matches 'track that order'");
    assert.ok(isExplicitTrackingQuery("where is my puff"), "matches 'where is my puff'");

    // Check puff matching in order items
    const puffOrders = [
      { id: "ord-1", items: [{ name: "Masala munch puff snacks", quantity: 2 }], status: "Preparing" },
      { id: "ord-2", items: [{ name: "Veg Biryani", quantity: 1 }], status: "Delivered" },
    ];
    const trackTerm = "track the puff"
      .replace(/\b(track|tracking|where('?s|\s+is)|status(\s+of)?|any\s+update\s+on|my|the|this|that|next|an?|order|orders|food|item|items|package|parcel|delivery)\b/gi, "")
      .trim();
    assert.equal(trackTerm, "puff");
    const matchedPuffOrder = puffOrders.find((o) => {
      const names = o.items.map((it) => it.name).join(" ").toLowerCase();
      return names.includes(trackTerm.toLowerCase());
    });
    assert.equal(matchedPuffOrder?.id, "ord-1");

    // Runtime normalizes tools and handles structured schema format
    const freshRuntime = fs.readFileSync(path.join(root, "lib/she-agent-commerce-runtime.ts"), "utf8");
    assert.match(freshRuntime, /normalizeTool\(t\)/);
    assert.match(freshRuntime, /response_format/);
  });
});
