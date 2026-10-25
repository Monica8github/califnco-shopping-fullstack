import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
let server: Server, base: string, dir: string;
before(async () => {
  dir = await mkdtemp(tmpdir() + "/califnco-");
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DATA_FILE = dir + "/data.json";
  delete process.env.VERCEL;
  const { handle } = await import("../functions/app.js");
  server = createServer(handle);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + (server.address() as any).port;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});
async function call(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
test("admin API rejects unsigned and customer requests", async () => {
  assert.equal((await call("/admin/overview")).status, 401);
  assert.equal((await call("/admin/overview", "demo-customer")).status, 403);
  assert.equal((await call("/admin/overview", "demo-admin")).status, 200);
});
test("retail customers cannot read wholesale prices", async () => {
  const publicData = await call("/products");
  assert.equal(publicData.data.products.length, 60);
  assert.equal(publicData.data.products[0].wholesalePrice, undefined);
  const dealer = await call("/products", "demo-dealer");
  assert.ok(dealer.data.products[0].wholesalePrice > 0);
  const pending = await call("/products", "demo-pending");
  assert.equal(pending.data.products[0].wholesalePrice, undefined);
});
test("profile patch cannot promote a user or approve a dealer", async () => {
  const r = await call("/me", "demo-customer", "PATCH", {
    name: "Test",
    phone: "",
    role: "admin",
  });
  assert.equal(r.status, 400);
});
test("dealer approval requires admin and changes server pricing", async () => {
  assert.equal(
    (
      await call("/admin/dealers/demo-pending", "demo-customer", "PATCH", {
        status: "approved",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/admin/dealers/demo-pending", "demo-admin", "PATCH", {
        status: "approved",
      })
    ).status,
    200,
  );
  assert.ok(
    (await call("/products", "demo-pending")).data.products[0].wholesalePrice,
  );
});
test("customer checkout, simulated verification, order history, and ownership work together", async () => {
  const p = (await call("/products", "demo-customer")).data.products[0];
  const address = {
    name: "Test User",
    phone: "9876543210",
    line1: "10 Test Street",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600001",
  };
  const checkout = await call("/checkout", "demo-customer", "POST", {
    items: [{ productId: p.id, quantity: 1 }],
    address,
    idempotencyKey: "integration-test",
  });
  assert.equal(checkout.status, 200);
  assert.equal(checkout.data.demo, true);
  const id = checkout.data.order.id;
  assert.equal(
    (await call("/demo/pay", "demo-dealer", "POST", { orderId: id })).status,
    404,
  );
  assert.equal(
    (await call("/demo/pay", "demo-customer", "POST", { orderId: id })).data
      .order.status,
    "confirmed",
  );
  assert.ok(
    (await call("/orders", "demo-customer")).data.orders.find(
      (o: any) => o.id === id,
    ),
  );
  assert.equal(
    (await call("/orders", "demo-dealer")).data.orders.some(
      (o: any) => o.id === id,
    ),
    false,
  );
});
test("service booking validates input and persists owner-scoped request", async () => {
  const r = await call("/services", "demo-customer", "POST", {
    type: "Repair",
    productName: "Test purifier",
    description: "Filter requires inspection",
    preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    address: {
      name: "Test User",
      phone: "9876543210",
      line1: "10 Test Street",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
    },
  });
  assert.equal(r.status, 201);
  assert.ok(
    (await call("/services", "demo-customer")).data.services.find(
      (s: any) => s.id === r.data.service.id,
    ),
  );
});
test("webhook rejects forged signatures", async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  assert.equal(
    (
      await call("/payments/webhook", undefined, "POST", {
        event: "payment.captured",
      })
    ).status,
    401,
  );
});
test("scheduler endpoint requires its own credential", async () => {
  process.env.CRON_SECRET = "test-cron-secret";
  assert.equal(
    (await call("/automation/daily", "demo-admin", "POST", {})).status,
    401,
  );
});
