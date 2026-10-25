import test from "node:test";
import assert from "node:assert/strict";

test("public sample workspace keeps checkout, dealer decisions, and AI examples local", async () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  });
  const originalFetch = globalThis.fetch;
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto")!;
  // Ordinary HTTP development origins expose getRandomValues but not randomUUID.
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { getRandomValues: crypto.getRandomValues.bind(crypto) },
  });
  globalThis.fetch = async () => {
    throw new Error("Sample mode must never call the network");
  };
  try {
    const { demoApi } = await import("../apps/admin/src/browserDemo.js");
    const call = (
      path: string,
      method = "GET",
      body: unknown = undefined,
      role = "customer",
    ) => demoApi(path, method, body, "browser-demo:demo-" + role);
    const { products } = await call("/products");
    assert.equal(products.length, 60);
    assert.ok(products.every((p: any) => !Object.hasOwn(p, "wholesalePrice")));
    await assert.rejects(call("/admin/overview"), /administrator/);
    const { order } = await call("/checkout", "POST", {
      items: [{ productId: products[0].id, quantity: 1 }],
      address: { name: "Sample" },
    });
    await call("/demo/pay", "POST", { orderId: order.id });
    const history = await call("/orders");
    assert.ok(
      history.orders.some(
        (o: any) => o.id === order.id && o.status === "confirmed",
      ),
    );
    await call(
      "/admin/dealers/demo-pending",
      "PATCH",
      { status: "approved" },
      "admin",
    );
    const approved = await call("/me", "GET", undefined, "pending");
    assert.equal(approved.profile.dealerStatus, "approved");
    const post = await call("/admin/automation/step", "POST", {}, "admin");
    assert.equal(post.post.status, "dry_run");
    assert.equal(post.post.exampleImage, true);
    assert.equal(post.post.fixture, true);
    assert.ok(data.size > 0);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "crypto", originalCrypto);
    Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
