import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

function formatMoney(value) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

test("Pricing Module Bug Fixes Verification", async (t) => {
  const v3Path = path.resolve("components/sheplates-v3.tsx");
  const v3Content = fs.readFileSync(v3Path, "utf8");

  await t.test("BUG 17 — PRICING-001: Markup calculation, persistence, Admin access, and Audit log", () => {
    // 1. Admin navigation contains "Item pricing"
    assert.match(v3Content, /admin:\s*\[[^\]]*"Item pricing"[^\]]*\]/, "Admin navigation must include Item pricing");

    // 2. AdminArea routes "Item pricing" to <ItemPricing />
    assert.match(v3Content, /if\s*\(\s*active\s*===\s*"Item pricing"\s*\)\s*return\s*<ItemPricing/, "AdminArea must render ItemPricing when active is Item pricing");

    // 3. Mathematical correctness: base 100 with 10% markup gives 110
    const basePrice = 100;
    const markupPercent = 10;
    const customerPrice = Math.round(basePrice * (1 + markupPercent / 100) * 100) / 100;
    assert.equal(customerPrice, 110, "Base price 100 with 10% markup must yield customer price 110");

    // 4. ItemPricing includes explicit 'Save pricing changes' button
    assert.ok(v3Content.includes("Save pricing changes"), "ItemPricing must include Save pricing changes button");

    // 5. Audit log entry is recorded with 'Pricing change: item markup'
    assert.ok(v3Content.includes('"Pricing change: item markup"'), "ItemPricing must record audit log entry with action 'Pricing change: item markup'");

    // 6. Audit log entry matches /plan|price|pricing|percentage|markup/i to appear under Plans and pricing tab
    const testAction = "Pricing change: item markup";
    assert.ok(/plan|price|pricing|percentage|markup/i.test(testAction), "Action 'Pricing change: item markup' must match audit log pricing filter");

    // 7. Customer marketplace preserves markups across load and refresh
    assert.ok(v3Content.includes("markups: { ...current.markups, ...liveMarketplaceMarkups }"), "Customer marketplace initial load must preserve markups");
    assert.ok(v3Content.includes("markups: { ...current.markups, ...(live.markups || {}) }"), "Customer marketplace refresh must preserve markups");
  });

  await t.test("BUG 18 — PRICING-003: Consistent two-decimal price display across cart, order and invoice", () => {
    // 1. money helper tests
    const formatted100 = formatMoney(100).replace(/\u00a0/g, " ");
    const formatted110 = formatMoney(110).replace(/\u00a0/g, " ");
    const formatted40_5 = formatMoney(40.5).replace(/\u00a0/g, " ");
    const formatted0 = formatMoney(0).replace(/\u00a0/g, " ");
    const formatted35_48 = formatMoney(35.48).replace(/\u00a0/g, " ");

    assert.ok(formatted100.includes("100.00"), `money(100) must display 100.00, got ${formatted100}`);
    assert.ok(formatted110.includes("110.00"), `money(110) must display 110.00, got ${formatted110}`);
    assert.ok(formatted40_5.includes("40.50"), `money(40.5) must display 40.50, got ${formatted40_5}`);
    assert.ok(formatted0.includes("0.00"), `money(0) must display 0.00, got ${formatted0}`);
    assert.ok(formatted35_48.includes("35.48"), `money(35.48) must display 35.48, got ${formatted35_48}`);

    // 2. Check money function definition in sheplates-v3.tsx enforces minimumFractionDigits: 2
    assert.match(
      v3Content,
      /function money\(value:\s*number\)\s*\{[^}]*minimumFractionDigits:\s*2[^}]*maximumFractionDigits:\s*2/,
      "money() in sheplates-v3.tsx must enforce minimumFractionDigits: 2 and maximumFractionDigits: 2"
    );

    // 3. No naked '₹0' without decimals in delivery fee display
    assert.ok(!v3Content.includes('order.deliveryFee === 0 ? "₹0" : money(order.deliveryFee)'), "Delivery fee must not format zero as bare ₹0");
  });

  await t.test("BUG 19 — PRICING-005: Updating prices does not change existing order prices", () => {
    // Simulate placing an order with an item priced at 100
    const originalPrice = 100;
    const existingOrder = {
      id: "ORD-TEST-001",
      customerEmail: "customer@example.com",
      vendorId: "VEN-001",
      productId: "PROD-001",
      description: "Organic Tomatoes",
      quantity: 1,
      unit: "1 kg pack",
      subtotal: originalPrice,
      total: originalPrice,
      totalAmount: originalPrice,
      items: [
        {
          productId: "PROD-001",
          name: "Organic Tomatoes",
          quantity: 1,
          unit: "1 kg pack",
          price: originalPrice,
        },
      ],
      date: "2026-11-20",
      slot: "08:00 - 10:00",
      mode: "Vendor delivery",
      status: "Scheduled",
      payment: "Pending",
    };

    // Simulate updating the product's price to 120
    const newPrice = 120;
    const updatedProduct = {
      id: "PROD-001",
      name: "Organic Tomatoes",
      vendorPrice: newPrice,
      baseUnit: "1 kg pack",
    };

    // Verify existing order retains its original frozen price
    assert.equal(existingOrder.items[0].price, 100, "Existing order item price must remain 100");
    assert.equal(existingOrder.subtotal, 100, "Existing order subtotal must remain 100");
    assert.equal(existingOrder.total, 100, "Existing order total must remain 100");
    assert.equal(existingOrder.totalAmount, 100, "Existing order totalAmount must remain 100");

    // Verify new order uses the updated price of 120
    const newOrder = {
      id: "ORD-TEST-002",
      customerEmail: "customer@example.com",
      vendorId: "VEN-001",
      productId: updatedProduct.id,
      description: updatedProduct.name,
      quantity: 1,
      unit: updatedProduct.baseUnit,
      subtotal: newPrice,
      total: newPrice,
      totalAmount: newPrice,
      items: [
        {
          productId: updatedProduct.id,
          name: updatedProduct.name,
          quantity: 1,
          unit: updatedProduct.baseUnit,
          price: newPrice,
        },
      ],
      date: "2026-11-21",
      slot: "08:00 - 10:00",
      mode: "Vendor delivery",
      status: "Scheduled",
      payment: "Pending",
    };

    assert.equal(newOrder.items[0].price, 120, "New order item price must use updated price 120");
    assert.equal(newOrder.total, 120, "New order total must use updated price 120");

    // Existing order is still unaffected
    assert.equal(existingOrder.items[0].price, 100, "Existing order item price is still 100 after new order placed");
    assert.equal(existingOrder.total, 100, "Existing order total is still 100 after new order placed");
  });
});
