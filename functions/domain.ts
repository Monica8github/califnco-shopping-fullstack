import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Store } from "./store.js";
import type { Product, Profile, Order, OrderStatus } from "../shared/types.js";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new AppError(status, message);
}
export const addressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number"),
  line1: z.string().trim().min(5).max(250),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z
    .string()
    .regex(/^[1-9][0-9]{5}$/, "Enter a six-digit Indian PIN code"),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export const checkoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().regex(/^[\w-]{1,80}$/),
          quantity: z.number().int().min(1).max(500),
        }),
      )
      .min(1)
      .max(50),
    address: addressSchema,
    idempotencyKey: z.string().min(8).max(100),
  })
  .strict();
export const productSchema = z
  .object({
    id: z.string().regex(/^[\w-]{1,80}$/),
    name: z.string().trim().min(3).max(120),
    category: z.enum([
      "Purifiers",
      "Dispensers",
      "Pumps",
      "Filters",
      "Spares",
      "Accessories",
    ]),
    description: z.string().max(2000),
    image: z
      .string()
      .max(1000)
      .refine(
        (v) => /^\/products\/[\w.-]+$/.test(v) || /^https:\/\//.test(v),
        "Use a product asset path or HTTPS URL",
      ),
    imageSource: z.string().max(1000).optional(),
    price: z.number().int().min(1).max(1000000),
    wholesalePrice: z.number().int().min(1),
    stock: z.number().int().min(0).max(1000000),
    minDealerQty: z.number().int().min(1).max(500),
    featured: z.boolean(),
    active: z.boolean(),
    specs: z.record(z.string().max(80), z.string().max(300)),
  })
  .refine(
    (p) => p.wholesalePrice < p.price,
    "Wholesale price must be below retail price",
  );
export function admin(p: Profile) {
  assert(p.role === "admin", 403, "Administrator access required");
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
) {
  return (
    /^[a-f0-9]{64}$/i.test(signature) &&
    safeEqual(
      createHmac("sha256", secret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex"),
      signature,
    )
  );
}
export function priceCart(
  products: Product[],
  items: { productId: string; quantity: number }[],
  profile: Profile,
) {
  assert(
    profile.role !== "admin",
    403,
    "Use a customer account to place an order",
  );
  assert(
    profile.role !== "dealer" || profile.dealerStatus === "approved",
    403,
    "Your dealer application must be approved before ordering",
  );
  const merged = new Map<string, number>();
  for (const i of items)
    merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
  return [...merged].map(([id, quantity]) => {
    const p = products.find((v) => v.id === id);
    assert(p?.active, 404, "A selected product is unavailable");
    assert(quantity <= 500, 400, "Maximum quantity is 500 per product");
    assert(
      p.stock >= quantity,
      409,
      `Only ${p.stock} units of ${p.name} are available`,
    );
    assert(
      profile.role !== "dealer" || quantity >= p.minDealerQty,
      400,
      `${p.name} needs a minimum dealer quantity of ${p.minDealerQty}`,
    );
    const price = profile.role === "dealer" ? p.wholesalePrice : p.price;
    assert(price && price > 0, 409, "Product pricing is unavailable");
    return {
      productId: p.id,
      name: p.name,
      image: p.image,
      quantity,
      unitPrice: Math.round(price * 100),
    };
  });
}
export async function reserveOrder(
  store: Store,
  profile: Profile,
  input: unknown,
  now = new Date(),
) {
  const body = checkoutSchema.parse(input),
    id =
      "CF-" +
      createHash("sha256")
        .update(profile.id + ":" + body.idempotencyKey)
        .digest("hex")
        .slice(0, 20);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ items: body.items, address: body.address }))
    .digest("hex");
  return store.atomic(async (tx) => {
    const previous = await tx.get<Order & { fingerprint: string }>(
      "orders",
      id,
    );
    if (previous) {
      assert(
        previous.fingerprint === fingerprint,
        409,
        "This checkout key belongs to a different cart",
      );
      return { order: previous, created: false };
    }
    const fresh = await tx.get<Profile>("users", profile.id);
    assert(fresh, 401, "Profile not found");
    const ids = [...new Set(body.items.map((i) => i.productId))];
    const products = (
      await Promise.all(ids.map((id) => tx.get<Product>("products", id)))
    ).filter(Boolean) as Product[];
    const items = priceCart(products, body.items, fresh),
      at = now.toISOString();
    const order: Order & { fingerprint: string } = {
      id,
      uid: fresh.id,
      customerName: fresh.name,
      email: fresh.email,
      role: fresh.role,
      items,
      address: body.address,
      amount: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      currency: "INR",
      status: "awaiting_payment",
      paymentStatus: "pending",
      createdAt: at,
      updatedAt: at,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      history: [{ status: "awaiting_payment", at }],
      fingerprint,
    };
    for (const item of items) {
      const p = products.find((p) => p.id === item.productId)!;
      tx.put("products", p.id, { ...p, stock: p.stock - item.quantity });
    }
    tx.put("orders", id, order);
    return { order, created: true };
  });
}
export async function releaseOrder(
  store: Store,
  id: string,
  status: "cancelled" | "payment_failed",
  actor?: Profile,
  expiredBefore?: Date,
) {
  return store.atomic(async (tx) => {
    const o = await tx.get<Order>("orders", id);
    assert(o, 404, "Order not found");
    if (actor)
      assert(
        o.uid === actor.id || actor.role === "admin",
        403,
        "Order access denied",
      );
    if (o.status === status) return o;
    assert(
      o.status === "awaiting_payment",
      409,
      "Only unpaid orders can be cancelled",
    );
    if (expiredBefore)
      assert(
        o.expiresAt && Date.parse(o.expiresAt) <= expiredBefore.getTime(),
        409,
        "Reservation is not expired",
      );
    for (const i of o.items) {
      const p = await tx.get<Product>("products", i.productId);
      if (p) tx.put("products", p.id, { ...p, stock: p.stock + i.quantity });
    }
    const at = new Date().toISOString();
    const updated = {
      ...o,
      status,
      paymentStatus:
        status === "payment_failed" ? ("failed" as const) : o.paymentStatus,
      updatedAt: at,
      history: [...o.history, { status, at }],
    };
    tx.put("orders", id, updated);
    return updated;
  });
}
export async function expireUnpaidReservations(store: Store, now = new Date()) {
  const pending = await store.list<Order>(
      "orders",
      { field: "status", value: "awaiting_payment" },
      500,
    ),
    expired: string[] = [];
  for (const o of pending) {
    if (!o.expiresAt || Date.parse(o.expiresAt) > now.getTime()) continue;
    try {
      await releaseOrder(store, o.id, "cancelled", undefined, now);
      expired.push(o.id);
    } catch (e) {
      if (!(e instanceof AppError && e.status === 409)) throw e;
    }
  }
  return { scanned: pending.length, expired, limit: 500 };
}
export async function markCaptured(
  store: Store,
  id: string,
  payment: {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  },
) {
  return store.atomic(async (tx) => {
    const o = await tx.get<Order>("orders", id);
    assert(o, 404, "Order not found");
    assert(
      payment.status === "captured",
      409,
      "Payment is not captured yet; retry verification shortly",
    );
    assert(
      payment.order_id === o.razorpayOrderId &&
        payment.amount === o.amount &&
        payment.currency === "INR",
      400,
      "Payment details do not match this order",
    );
    if (o.paymentStatus === "captured" || o.paymentStatus === "review")
      return o;
    const review = o.status !== "awaiting_payment",
      status: OrderStatus = review ? "paid_needs_review" : "confirmed";
    const at = new Date().toISOString();
    const updated = {
      ...o,
      status,
      paymentStatus: review ? ("review" as const) : ("captured" as const),
      razorpayPaymentId: payment.id,
      updatedAt: at,
      history: [...o.history, { status, at }],
    };
    tx.put("orders", id, updated);
    return updated;
  });
}
const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  confirmed: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
};
export async function changeOrderStatus(
  store: Store,
  actor: Profile,
  id: string,
  status: OrderStatus,
) {
  admin(actor);
  return store.atomic(async (tx) => {
    const o = await tx.get<Order>("orders", id);
    assert(o, 404, "Order not found");
    assert(
      o.paymentStatus === "captured",
      409,
      "Only captured payments can be fulfilled",
    );
    assert(
      transitions[o.status]?.includes(status),
      400,
      "Invalid order status transition",
    );
    const at = new Date().toISOString(),
      updated = {
        ...o,
        status,
        updatedAt: at,
        history: [...o.history, { status, at }],
      };
    tx.put("orders", id, updated);
    return updated;
  });
}
