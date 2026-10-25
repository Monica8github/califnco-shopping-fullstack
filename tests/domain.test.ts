import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { MemoryStore } from "../functions/store.js";
import {
  reserveOrder,
  releaseOrder,
  markCaptured,
  changeOrderStatus,
  verifySignature,
  expireUnpaidReservations,
} from "../functions/domain.js";
import type { Product, Profile, Order } from "../shared/types.js";
const product: Product = {
  id: "test-filter",
  name: "Test filter",
  category: "Filters",
  description: "Filter",
  image: "/products/test.jpg",
  price: 1000,
  wholesalePrice: 700,
  stock: 10,
  minDealerQty: 3,
  featured: true,
  active: true,
  specs: {},
};
const customer: Profile = {
  id: "customer",
  name: "Customer",
  email: "customer@example.test",
  phone: "9876543210",
  role: "customer",
  dealerStatus: "none",
  createdAt: new Date().toISOString(),
};
const address = {
  name: "Test Customer",
  phone: "9876543210",
  line1: "10 Test Street",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600001",
};
const payload = (qty = 1, key = "checkout-1") => ({
  items: [{ productId: product.id, quantity: qty }],
  address,
  idempotencyKey: key,
});
async function setup(p = customer, stock = 10) {
  const s = new MemoryStore();
  await s.atomic(async (t) => {
    t.put("products", product.id, { ...product, stock });
    t.put("users", p.id, p);
  });
  return s;
}
test("customer checkout uses canonical retail paise and reserves inventory", async () => {
  const s = await setup();
  const { order } = await reserveOrder(s, customer, payload(2));
  assert.equal(order.amount, 200000);
  assert.equal((await s.get<Product>("products", product.id))!.stock, 8);
});
test("idempotent checkout cannot double-reserve and rejects changed payload", async () => {
  const s = await setup();
  const [a, b] = await Promise.all([
    reserveOrder(s, customer, payload(2)),
    reserveOrder(s, customer, payload(2)),
  ]);
  assert.equal(a.order.id, b.order.id);
  assert.equal((await s.get<Product>("products", product.id))!.stock, 8);
  await assert.rejects(
    () => reserveOrder(s, customer, payload(3)),
    /different cart/,
  );
});
test("concurrent orders cannot oversell", async () => {
  const s = await setup(customer, 3);
  const r = await Promise.allSettled([
    reserveOrder(s, customer, payload(2, "attempt-1")),
    reserveOrder(s, customer, payload(2, "attempt-2")),
  ]);
  assert.equal(r.filter((v) => v.status === "fulfilled").length, 1);
  assert.equal((await s.get<Product>("products", product.id))!.stock, 1);
});
test("rejects client pricing, negative quantities and invalid addresses", async () => {
  const s = await setup();
  await assert.rejects(() =>
    reserveOrder(s, customer, { ...payload(), price: 1 }),
  );
  await assert.rejects(() => reserveOrder(s, customer, payload(-1)));
  await assert.rejects(() =>
    reserveOrder(s, customer, {
      ...payload(),
      address: { ...address, pincode: "000000" },
    }),
  );
});
test("duplicate SKU quantities are merged before stock and minimum checks", async () => {
  const s = await setup(customer, 3);
  await assert.rejects(
    () =>
      reserveOrder(s, customer, {
        ...payload(),
        items: [
          { productId: product.id, quantity: 2 },
          { productId: product.id, quantity: 2 },
        ],
      }),
    /Only 3/,
  );
  assert.equal((await s.get<Product>("products", product.id))!.stock, 3);
});
test("pending dealers cannot order; approved dealers receive wholesale and minimum applies", async () => {
  const p: Profile = { ...customer, role: "dealer", dealerStatus: "pending" };
  const s = await setup(p);
  await assert.rejects(() => reserveOrder(s, p, payload(3)), /approved/);
  await s.atomic(async (t) =>
    t.put("users", p.id, { ...p, dealerStatus: "approved" }),
  );
  await assert.rejects(() => reserveOrder(s, p, payload(1)), /minimum/);
  const { order } = await reserveOrder(s, p, payload(3));
  assert.equal(order.amount, 210000);
});
test("fresh profile role overrides a stale approved-dealer session", async () => {
  const p: Profile = { ...customer, role: "dealer", dealerStatus: "approved" };
  const s = await setup({ ...p, dealerStatus: "rejected" });
  await assert.rejects(() => reserveOrder(s, p, payload(3)), /approved/);
});
test("cancelling an unpaid order releases inventory exactly once", async () => {
  const s = await setup();
  const { order } = await reserveOrder(s, customer, payload(2));
  await releaseOrder(s, order.id, "cancelled", customer);
  await releaseOrder(s, order.id, "cancelled", customer);
  assert.equal((await s.get<Product>("products", product.id))!.stock, 10);
});
test("expiry releases old reservations once while preserving recent reservations", async () => {
  const s = await setup();
  const now = new Date();
  const old = await reserveOrder(
    s,
    customer,
    payload(2, "old-reservation"),
    new Date(now.getTime() - 3600000),
  );
  const recent = await reserveOrder(
    s,
    customer,
    payload(3, "new-reservation"),
    now,
  );
  await Promise.all([
    expireUnpaidReservations(s, now),
    expireUnpaidReservations(s, now),
  ]);
  assert.equal((await s.get<Product>("products", product.id))!.stock, 7);
  assert.equal(
    (await s.get<Order>("orders", old.order.id))!.status,
    "cancelled",
  );
  assert.equal(
    (await s.get<Order>("orders", recent.order.id))!.status,
    "awaiting_payment",
  );
});
test("payment signatures bind server order ID and payment ID", () => {
  const sig = createHmac("sha256", "test-secret")
    .update("order_x|pay_y")
    .digest("hex");
  assert.ok(verifySignature("order_x", "pay_y", sig, "test-secret"));
  assert.equal(verifySignature("other", "pay_y", sig, "test-secret"), false);
  assert.equal(
    verifySignature("order_x", "pay_y", "short", "test-secret"),
    false,
  );
});
async function payable(s: MemoryStore) {
  const { order } = await reserveOrder(s, customer, payload(2));
  await s.atomic(async (t) =>
    t.put("orders", order.id, { ...order, razorpayOrderId: "order_x" }),
  );
  return order;
}
test("only captured matching amounts and currency confirm an order", async () => {
  const s = await setup(),
    o = await payable(s);
  const payment = {
    id: "pay_x",
    order_id: "order_x",
    amount: o.amount,
    currency: "INR",
    status: "captured",
  };
  await assert.rejects(
    () => markCaptured(s, o.id, { ...payment, amount: 1 }),
    /match/,
  );
  await assert.rejects(
    () => markCaptured(s, o.id, { ...payment, status: "authorized" }),
    /not captured/,
  );
  const a = await markCaptured(s, o.id, payment);
  const b = await markCaptured(s, o.id, payment);
  assert.equal(a.status, "confirmed");
  assert.equal(b.history.length, a.history.length);
  assert.equal((await s.get<Product>("products", product.id))!.stock, 8);
});
test("captured payment arriving after cancellation requires manual review", async () => {
  const s = await setup(),
    o = await payable(s);
  await releaseOrder(s, o.id, "cancelled");
  const r = await markCaptured(s, o.id, {
    id: "pay_x",
    order_id: "order_x",
    amount: o.amount,
    currency: "INR",
    status: "captured",
  });
  assert.equal(r.status, "paid_needs_review");
  assert.equal((await s.get<Product>("products", product.id))!.stock, 10);
});
test("fulfillment requires admin, captured payment, and ordered transitions", async () => {
  const s = await setup(),
    o = await payable(s),
    admin = { ...customer, role: "admin" as const };
  await assert.rejects(
    () => changeOrderStatus(s, customer, o.id, "processing"),
    /Administrator/,
  );
  await assert.rejects(
    () => changeOrderStatus(s, admin, o.id, "processing"),
    /captured/,
  );
  await markCaptured(s, o.id, {
    id: "pay_x",
    order_id: "order_x",
    amount: o.amount,
    currency: "INR",
    status: "captured",
  });
  await assert.rejects(
    () => changeOrderStatus(s, admin, o.id, "delivered"),
    /transition/,
  );
  assert.equal(
    (await changeOrderStatus(s, admin, o.id, "processing")).status,
    "processing",
  );
});
test("another customer cannot cancel an order", async () => {
  const s = await setup();
  const { order } = await reserveOrder(s, customer, payload());
  await assert.rejects(
    () => releaseOrder(s, order.id, "cancelled", { ...customer, id: "other" }),
    /denied/,
  );
});
