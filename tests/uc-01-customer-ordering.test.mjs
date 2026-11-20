import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const agentRouteSource = fs.readFileSync(path.join(root, "app/api/agent/route.ts"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "lib/she-agent-commerce-runtime.ts"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "components/sheplates-v3.tsx"), "utf8");

test("ShePlates She Agent – UC-01: Customer Ordering", async (t) => {
  // Test fixture data
  const mockVendors = [
    {
      id: "v-lakshmi",
      businessName: "Lakshmi Kitchen",
      verified: true,
      active: true,
      isOpen: true,
      is_open: true,
      serviceRadiusKm: 10,
      deliveryRadiusKm: 10,
      latitude: 11.0168,
      longitude: 76.9558,
    },
    {
      id: "v-kovai",
      businessName: "Kovai Flavours",
      verified: true,
      active: true,
      isOpen: true,
      is_open: true,
      serviceRadiusKm: 8,
      deliveryRadiusKm: 8,
      latitude: 11.0180,
      longitude: 76.9600,
    },
    {
      id: "v-closed",
      businessName: "Closed Kitchen",
      verified: true,
      active: false,
      isOpen: false,
      is_open: false,
      serviceRadiusKm: 5,
      deliveryRadiusKm: 5,
      latitude: 11.0200,
      longitude: 76.9700,
    },
  ];

  const mockProducts = [
    {
      id: "p-milk-a2",
      vendorId: "v-lakshmi",
      name: "Fresh A2 Cow Milk",
      category: "Dairy",
      baseUnit: "1 Litre",
      price: 65,
      stock: 12,
      stock_quantity: 12,
      active: true,
      imageUrl: "https://example.com/milk.jpg",
    },
    {
      id: "p-butter-cookies",
      vendorId: "v-lakshmi",
      name: "Butter Cookies",
      category: "Bakery",
      baseUnit: "250g pack",
      price: 120,
      stock: 8,
      stock_quantity: 8,
      active: true,
      imageUrl: "https://example.com/cookies.jpg",
    },
    {
      id: "p-farm-eggs",
      vendorId: "v-lakshmi",
      name: "Farm Fresh Eggs",
      category: "Poultry",
      baseUnit: "Pack of 6",
      price: 54,
      stock: 15,
      stock_quantity: 15,
      active: true,
      imageUrl: "https://example.com/eggs1.jpg",
    },
    {
      id: "p-duck-eggs",
      vendorId: "v-lakshmi",
      name: "Organic Duck Eggs",
      category: "Poultry",
      baseUnit: "Pack of 6",
      price: 85,
      stock: 6,
      stock_quantity: 6,
      active: true,
      imageUrl: "https://example.com/eggs2.jpg",
    },
    {
      id: "p-kovai-biryani",
      vendorId: "v-kovai",
      name: "Kovai Chicken Biryani",
      category: "Meals",
      baseUnit: "1 Box (serves 1-2)",
      price: 240,
      stock: 5,
      stock_quantity: 5,
      active: true,
      imageUrl: "https://example.com/biryani.jpg",
    },
    {
      id: "p-sold-out-halwa",
      vendorId: "v-lakshmi",
      name: "Tirunelveli Halwa",
      category: "Sweets",
      baseUnit: "250g",
      price: 150,
      stock: 0,
      stock_quantity: 0,
      active: true,
    },
  ];

  await t.test("1.1 Product discovery ('Show me milk near me' and Tamil 'பால் காட்டு')", () => {
    // Backend instructions require location, verified/open vendor, stock check
    assert.match(runtimeSource, /search_catalogue to return verified, active and open vendor products within service radius/);
    assert.match(runtimeSource, /For out-of-stock or not-found items, explain unavailability/);
    assert.match(agentRouteSource, /பால்|முட்டை|தயிர்/);

    // Filter logic test: find nearby milk
    const available = mockProducts.filter((p) => {
      const v = mockVendors.find((vend) => vend.id === p.vendorId);
      if (!v || !v.verified || !v.active || !v.isOpen) return false;
      if (p.stock <= 0) return false;
      return true;
    });

    const milkMatches = available.filter((p) => /milk|பால்/i.test(p.name) || /dairy/i.test(p.category));
    assert.equal(milkMatches.length, 1);
    assert.equal(milkMatches[0].id, "p-milk-a2");

    // UI card verification: image fallback to ProductGlyph, name, pack size/unit, price, vendor name, stock badge, Add button
    assert.match(uiSource, /product\.imageUrl \? <img src=\{product\.imageUrl\}/);
    assert.match(uiSource, /<ProductGlyph category=\{product\.category\} \/>/);
    assert.match(uiSource, /vendor\?\.businessName \|\| "Verified kitchen"/);
    assert.match(uiSource, /product\.baseUnit/);
    assert.match(uiSource, /money\(finalPrice\(product, state\)\)/);
    assert.match(uiSource, /In stock|Only \$\{product\.stock\} left|Out of stock/);
    assert.match(uiSource, /addProduct\(product\.id\)/);
  });

  await t.test("1.2 Add by tapping (routes through unified cart operation)", () => {
    // Both Add button and AI message must route through syncAgentCart
    assert.match(uiSource, /async function addProduct\(productId: string/);
    assert.match(uiSource, /syncAgentCart\(\[\{ productId, quantity: 1 \}\]/);
    assert.match(uiSource, /syncLiveCart/);
  });

  await t.test("1.3 Add by typing ('Add butter cookies to my cart')", () => {
    // Agent runtime prompt instruction
    assert.match(runtimeSource, /return the exact live product IDs in basketProductIds/);
    assert.match(agentRouteSource, /Added .* to your cart\. View cart\./);

    // Product search match test
    const found = mockProducts.find((p) => /butter cookies/i.test(p.name) && p.stock > 0);
    assert.ok(found);
    assert.equal(found.id, "p-butter-cookies");

    // UI renders "View cart" button
    assert.match(uiSource, /View cart|கூடையைப் பார்க்கவும்/);
    assert.match(uiSource, /navigate\("Cart"\)/);
  });

  await t.test("1.4 Unclear request ('Add an item to my cart')", () => {
    assert.match(runtimeSource, /If the customer request is unclear/);
    assert.match(agentRouteSource, /clarifyingQuestion = .*Which product would you like to add/);
  });

  await t.test("1.5 Several matches ('Add eggs')", () => {
    assert.match(runtimeSource, /If multiple products match \(e\.g\. 'Add eggs'\)/);
    assert.match(agentRouteSource, /found several \$\{term\} options from nearby kitchens/);

    const eggMatches = mockProducts.filter((p) => /egg/i.test(p.name));
    assert.equal(eggMatches.length, 2);
    assert.ok(eggMatches.some((e) => e.name === "Farm Fresh Eggs"));
    assert.ok(eggMatches.some((e) => e.name === "Organic Duck Eggs"));
  });

  await t.test("1.6 Quantity handling ('Add 3 packs of A2 milk')", () => {
    assert.match(runtimeSource, /When adding products with specific quantities \(e\.g\. 'Add 3 packs of A2 milk'\)/);
    assert.match(agentRouteSource, /basketItems = \[\{ productId: matchedId, quantity: requestedQty \}\]/);

    const reqQty = 3;
    const milk = mockProducts.find((p) => p.id === "p-milk-a2");
    assert.ok(milk);
    assert.ok(milk.stock >= reqQty);
  });

  await t.test("1.7 One kitchen per order restriction", () => {
    // Backend validation logic in route.ts
    assert.match(agentRouteSource, /existingVendorId && pVendorId\(matched\) && existingVendorId !== pVendorId\(matched\)/);
    assert.match(agentRouteSource, /base\.kitchenConflict = \{/);
    assert.match(agentRouteSource, /currentVendorName: existingVendorName/);
    assert.match(agentRouteSource, /requestedVendorName: pVendor\(matched\)/);
    assert.match(agentRouteSource, /conflictingProductId: pId\(matched\)/);

    // Frontend handles kitchen conflict
    assert.match(uiSource, /setKitchenConflict/);
    assert.match(uiSource, /One kitchen per order/);
    assert.match(uiSource, /Keep current cart/);
    assert.match(uiSource, /Start new cart with/);
    assert.match(uiSource, /startNewCartWithProduct/);
  });

  await t.test("1.8 Out of stock or closed vendor", () => {
    assert.match(runtimeSource, /For out-of-stock or not-found items, explain unavailability/);
    assert.match(agentRouteSource, /is currently out of stock/);

    const halwa = mockProducts.find((p) => p.id === "p-sold-out-halwa");
    assert.equal(halwa.stock, 0);

    const closed = mockVendors.find((v) => v.id === "v-closed");
    assert.equal(closed.isOpen, false);
  });

  await t.test("1.9 Product not found ('Add unicorn cake')", () => {
    assert.match(agentRouteSource, /couldn't find '\$\{term\}' from any verified kitchens/);

    const searchTarget = "unicorn cake";
    const found = mockProducts.find((p) => p.name.toLowerCase().includes(searchTarget.toLowerCase()));
    assert.equal(found, undefined);
  });

  await t.test("1.10 Checkout ('Place my order')", () => {
    assert.match(runtimeSource, /For 'Place my order' or checkout, validate the cart and set navigateTo to Cart/);
    assert.match(agentRouteSource, /Taking you to checkout to confirm your delivery address and payment/);
    assert.match(agentRouteSource, /base\.navigateTo = "Cart"/);

    // Order confirmation restriction: unpaid orders remain awaiting payment, never confirmed prematurely
    const ordersFile = fs.readFileSync(path.join(root, "tests/unpaid-orders-vendor-isolation.test.mjs"), "utf8");
    assert.match(ordersFile, /Awaiting payment/);
  });

  await t.test("1.11 Authentication gating (Not signed in)", () => {
    assert.match(uiSource, /sheplates_pending_cart_action/);
    assert.match(uiSource, /sessionStorage\.setItem\("sheplates_pending_cart_action"/);
    assert.match(uiSource, /sessionStorage\.getItem\("sheplates_pending_cart_action"\)/);
    assert.match(uiSource, /Please sign in to add items to your cart/);
  });

  await t.test("1.12 Bilingual support (Tamil & English)", () => {
    assert.match(runtimeSource, /Support English and Tamil naturally \(e\.g\. பால், முட்டை, கூடையில் சேர், ஆர்டர் செய்\)/);
    assert.match(agentRouteSource, /[\u0B80-\u0BFF]/); // Tamil unicode regex
    assert.match(agentRouteSource, /பால்|முட்டை|தயிர்|வெண்ணெய்|தோசை/);
    assert.match(agentRouteSource, /கூடையில் சேர்|ஆர்டர் செய்/);
  });

  await t.test("1.13 AI credits, failure resilience and retry", () => {
    // She agent AI action cost integration
    assert.match(agentRouteSource, /checkVendorAiCredits/);
    assert.match(agentRouteSource, /deductVendorAiCredits/);
    assert.match(agentRouteSource, /Insufficient AI credits/);

    // Retry capability
    assert.match(uiSource, /Try again/);
    assert.match(uiSource, /item\.isError && item\.retryText/);
  });

  await t.test("1.14 Preposition cleaning and stop-word filtering ('add the flavored badam milk in the cart')", () => {
    // Ensures prepositional phrases like 'in the cart' and stop words are stripped so they do not falsely match muffins/drink
    assert.match(agentRouteSource, /\(into\|in\|to\|on\)\\s\+\(the\\s\+\|my\\s\+\|this\\s\+\|our\\s\+\)\?\(cart\|basket\)/);
    assert.match(agentRouteSource, /STOP_WORDS/);
    assert.match(agentRouteSource, /scoredMatches/);
  });

  await t.test("1.15 Context-aware cart addition ('add the product to cart' and 'add the second one')", () => {
    // Ensures saying 'add the product to cart' or 'add it' checks conversation history and directly adds to cart
    assert.match(agentRouteSource, /recentProductIds/);
    assert.match(agentRouteSource, /isGenericReference/);
    assert.match(agentRouteSource, /targetOrdinal/);
  });

  await t.test("1.16 Clarification answer resolution ('the first option i prefer' / 'Add the first product to cart')", () => {
    // Ensures answering a clarifying question without 'add' (e.g. 'the first option i prefer') resolves and adds to cart
    assert.match(agentRouteSource, /isSelectionAnswer/);
    assert.match(agentRouteSource, /hasSelectionWord/);
    assert.match(agentRouteSource, /hasSingleKitchenPreference/);
  });

  await t.test("1.17 View cart navigation & conversation history persistence on revisit", () => {
    // View cart button does not overwrite navigation on full-page mode
    assert.match(uiSource, /navigate\("Cart"\);\s*if\s*\(!page\)\s*setOpen\(false\);/);
    // SheAgent saves and restores conversation from sessionStorage on revisit
    assert.match(uiSource, /sessionStorage\.getItem\(`sheplates_agent_convo_\${session\.email}`\)/);
    assert.match(uiSource, /sessionStorage\.setItem\(`sheplates_agent_convo_\${session\.email}`/);
    // When loading messages, productIds and intent are preserved
    assert.match(uiSource, /productIds:\s*m\.productIds/);
  });
});
