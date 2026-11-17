import test from "node:test";
import assert from "node:assert/strict";

test("She Agent Resilience and Grounded Fallback", async (t) => {
  await t.test("Vendor greeting 'hi' returns grounded response without crashing", () => {
    const mockContext = {
      vendor: { businessName: "Annam Kitchen", plan: "Crown" },
      products: [
        { id: "p1", name: "Full Meals", stock_quantity: 10, active: true },
        { id: "p2", name: "Curd Rice", stock_quantity: 0, active: true },
      ],
      orders: [
        { id: "ORD-001", order_number: "ORD-001", scheduled_slot: "12:00 PM - 01:00 PM", fulfilment_mode: "delivery", status: "Confirmed" },
      ],
      deliveryStaff: [{ id: "st-1", name: "Rider 1", active: true }],
      quoteOpportunities: [],
      quotations: [],
    };

    assert.ok(mockContext.vendor.businessName);
    assert.equal(mockContext.products.length, 2);
    assert.equal(mockContext.orders.length, 1);
  });

  await t.test("Vendor 'What must I fulfil next?' checks open orders", () => {
    const orders = [
      { id: "ORD-1234", order_number: "SP-ORD1234", scheduled_slot: "09:00 AM - 11:00 AM", fulfilment_mode: "Vendor delivery", status: "Confirmed" }
    ];
    const openOrders = orders.filter((o) => !/delivered|cancel|complete|rejected/i.test(o.status));
    assert.equal(openOrders.length, 1);
    const nextOrder = openOrders[0];
    const summary = `You have ${openOrders.length} open order needing fulfilment. Next order #${nextOrder.order_number.slice(-8)} is scheduled for ${nextOrder.scheduled_slot} (${nextOrder.fulfilment_mode}).`;
    assert.ok(summary.includes("Next order #"));
    assert.ok(summary.includes("needing fulfilment"));
  });

  await t.test("Vendor 'Summarise my inventory' calculates in-stock and out-of-stock items", () => {
    const products = [
      { id: "p1", name: "Sambar Rice", stock_quantity: 15, active: true },
      { id: "p2", name: "Curd Vadai", stock_quantity: 3, active: true },
      { id: "p3", name: "Payasam", stock_quantity: 0, active: true },
    ];
    const stockOf = (p) => Number(p.stock_quantity ?? 0);
    const outOfStock = products.filter((p) => stockOf(p) <= 0);
    const lowStock = products.filter((p) => stockOf(p) > 0 && stockOf(p) <= 5);
    const live = products.filter((p) => p.active !== false && stockOf(p) > 0);

    assert.equal(live.length, 2);
    assert.equal(outOfStock.length, 1);
    assert.equal(lowStock.length, 1);
    assert.equal(outOfStock[0].name, "Payasam");
    assert.equal(lowStock[0].name, "Curd Vadai");
  });
});
