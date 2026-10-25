import { seedDemo } from "../../../functions/demo";
import { clientId } from "./id";
import type { Store, Unit } from "../../../functions/store";
import type {
  Profile,
  Product,
  Order,
  ServiceRequest,
} from "../../../shared/types";

// This adapter never calls fetch. Sample changes are isolated to this browser
// tab and never reach Firebase, payment providers, or Instagram.
const key = "califnco-browser-sample-v1";
type Records = Record<string, Record<string, any>>;
let records: Records = {};
try {
  records = JSON.parse(sessionStorage.getItem(key) || "{}");
} catch {
  /* reset invalid sample state */
}
const read = <T>(collection: string, id: string): T | null =>
  structuredClone(records[collection]?.[id] ?? null);
const unit: Unit = {
  get: async <T>(c: string, id: string) => read<T>(c, id),
  put(c, id, value) {
    (records[c] ||= {})[id] = structuredClone(value);
  },
  remove(c, id) {
    delete records[c]?.[id];
  },
};
const store: Store = {
  get: unit.get,
  list: async <T>(
    c: string,
    filter?: { field: string; value: unknown },
    limit = 500,
  ) =>
    structuredClone(
      Object.values(records[c] || {})
        .filter((v) => !filter || v[filter.field] === filter.value)
        .slice(0, limit),
    ) as T[],
  async atomic(fn) {
    const result = await fn(unit);
    sessionStorage.setItem(key, JSON.stringify(records));
    return result;
  },
};
const ready = seedDemo(store);
const integrations = Object.fromEntries(
  [
    "firebase",
    "razorpay",
    "captionAI",
    "imageAI",
    "cloudinary",
    "instagram",
    "email",
    "sms",
    "scheduler",
    "publishEnabled",
  ].map((k) => [k, false]),
);
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const save = (c: string, id: string, value: any) =>
  store.atomic(async (tx) => tx.put(c, id, value));

export async function demoApi(
  path: string,
  method: string,
  input: unknown,
  token: string,
): Promise<any> {
  await ready;
  const body = (input ?? {}) as Record<string, any>;
  const profile = await store.get<Profile>(
    "users",
    token.replace("browser-demo:", ""),
  );
  ensure(profile, "Choose a sample account to continue.");
  if (path === "/health") return { mode: "browser-demo", integrations };
  if (path === "/me") {
    if (method === "PATCH")
      await save("users", profile.id, {
        ...profile,
        name: body.name || profile.name,
        phone: body.phone || profile.phone,
        address: body.address || profile.address,
      });
    return { profile: await store.get("users", profile.id) };
  }
  if (path === "/products") {
    const products = (await store.list<Product>("products"))
      .filter((p) => p.active)
      .map((p) => {
        if (
          profile.role === "admin" ||
          (profile.role === "dealer" && profile.dealerStatus === "approved")
        )
          return p;
        const { wholesalePrice: _, ...retail } = p;
        return retail;
      });
    return { products };
  }
  if (path === "/orders")
    return {
      orders: await store.list<Order>("orders", {
        field: "uid",
        value: profile.id,
      }),
    };
  if (path === "/services") {
    if (method === "POST") {
      const id = "SAMPLE-SVC-" + clientId();
      const service = {
        ...body,
        id,
        uid: profile.id,
        customerName: profile.name,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      await save("services", id, service);
      return { service };
    }
    return {
      services: await store.list<ServiceRequest>("services", {
        field: "uid",
        value: profile.id,
      }),
    };
  }
  if (path === "/checkout" && method === "POST") {
    ensure(
      profile.role !== "dealer" || profile.dealerStatus === "approved",
      "Dealer approval is required.",
    );
    const cart = new Map<string, number>();
    for (const line of body.items || [])
      cart.set(
        line.productId,
        (cart.get(line.productId) || 0) + Number(line.quantity),
      );
    ensure(cart.size, "Your cart is empty.");
    const products = await store.list<Product>("products");
    const items = [...cart].map(([id, quantity]) => {
      const product = products.find((p) => p.id === id);
      ensure(product?.active, "Product is unavailable.");
      ensure(
        Number.isInteger(quantity) && quantity > 0 && quantity <= product.stock,
        "Please choose an available quantity.",
      );
      ensure(
        profile.role !== "dealer" || quantity >= product.minDealerQty,
        `Minimum dealer quantity: ${product.minDealerQty}`,
      );
      return {
        productId: id,
        name: product.name,
        image: product.image,
        quantity,
        unitPrice: Math.round(
          (profile.role === "dealer"
            ? product.wholesalePrice!
            : product.price) * 100,
        ),
      };
    });
    const at = new Date().toISOString(),
      id = "SAMPLE-" + clientId();
    const order: Order = {
      id,
      uid: profile.id,
      customerName: profile.name,
      email: profile.email,
      role: profile.role,
      items,
      address: body.address,
      amount: items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      ),
      currency: "INR",
      status: "awaiting_payment",
      paymentStatus: "pending",
      createdAt: at,
      updatedAt: at,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      history: [{ status: "awaiting_payment", at }],
    };
    await store.atomic(async (tx) => {
      for (const item of items) {
        const p = products.find((p) => p.id === item.productId)!;
        tx.put("products", p.id, { ...p, stock: p.stock - item.quantity });
      }
      tx.put("orders", id, order);
    });
    return { order, demo: true };
  }
  if (path === "/demo/pay" && method === "POST") {
    const order = await store.get<Order>("orders", body.orderId);
    ensure(order?.uid === profile.id, "Sample order not found.");
    const at = new Date().toISOString();
    const updated = {
      ...order,
      status: "confirmed",
      paymentStatus: "captured",
      updatedAt: at,
      history: [...order.history, { status: "confirmed", at }],
    };
    await save("orders", order.id, updated);
    return { order: updated };
  }
  const cancel = path.match(/^\/orders\/([^/]+)\/cancel$/);
  if (cancel && method === "POST") {
    const order = await store.get<Order>("orders", cancel[1]);
    ensure(
      order?.uid === profile.id && order.status === "awaiting_payment",
      "Only your unpaid sample orders can be cancelled.",
    );
    await store.atomic(async (tx) => {
      for (const item of order.items) {
        const p = await tx.get<Product>("products", item.productId);
        if (p)
          tx.put("products", p.id, { ...p, stock: p.stock + item.quantity });
      }
      tx.put("orders", order.id, {
        ...order,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      });
    });
    return { order: await store.get("orders", order.id) };
  }
  ensure(
    profile.role === "admin",
    "This sample action requires the administrator workspace.",
  );
  if (path === "/admin/overview") {
    const result: Record<string, unknown> = {
      mode: "browser-demo",
      integrations,
    };
    for (const collection of [
      "orders",
      "users",
      "products",
      "services",
      "notifications",
      "posts",
    ])
      result[collection] = await store.list(collection);
    return result;
  }
  const adminRoute = path.match(
    /^\/admin\/(dealers|products|orders|services)\/([^/]+)$/,
  );
  if (adminRoute && ["PATCH", "PUT"].includes(method)) {
    const [, resource, id] = adminRoute,
      collection = resource === "dealers" ? "users" : resource;
    const existing = await store.get<any>(collection, id);
    ensure(existing || resource === "products", "Sample record not found.");
    let value = { ...existing, ...body, id };
    if (resource === "dealers")
      value = { ...existing, dealerStatus: body.status };
    if (resource === "orders") {
      const next: Record<string, string> = {
        confirmed: "processing",
        processing: "shipped",
        shipped: "delivered",
      };
      ensure(
        next[existing.status] === body.status,
        "Choose the next fulfillment step.",
      );
      value.history = [
        ...existing.history,
        { status: body.status, at: new Date().toISOString() },
      ];
    }
    await save(collection, id, value);
    return { ok: true };
  }
  if (path === "/admin/automation/step" && method === "POST") {
    const products = await store.list<Product>("products");
    const product =
      products.find((p) => p.image.includes("countertop-carbon")) ||
      products[0];
    const post = {
      id: "SAMPLE-POST",
      status: "dry_run",
      stage: "done",
      fixture: true,
      exampleImage: true,
      product,
      imageUrl: "/demo/ai-product-visual.jpg",
      caption: `${product.name}: a fresh perspective on everyday water care. Explore the Califnco sample catalogue.\n\n#Califnco #WaterCare #WaterPurifier #ProductSpotlight`,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    await save("posts", post.id, post);
    return { post, done: true };
  }
  throw new Error(
    "This action needs a configured live account. The sample workspace never sends external requests.",
  );
}
