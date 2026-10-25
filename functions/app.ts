import { createHash, createHmac, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getAuth } from "firebase-admin/auth";
import { z, ZodError } from "zod";
import {
  FirestoreStore,
  MemoryStore,
  firebaseApp,
  type Store,
} from "./store.js";
import {
  AppError,
  assert,
  admin,
  addressSchema,
  productSchema,
  reserveOrder,
  releaseOrder,
  markCaptured,
  changeOrderStatus,
  verifySignature,
  safeEqual,
  expireUnpaidReservations,
} from "./domain.js";
import { razorpay, required } from "./providers.js";
import { notify } from "./notifications.js";
import { seedDemo, demoProfiles } from "./demo.js";
import { runDailyStep } from "../automation/engine.js";
import type {
  Profile,
  Product,
  Order,
  ServiceRequest,
  OrderStatus,
} from "../shared/types.js";
let storePromise: Promise<Store> | undefined;
export function demoMode() {
  return (
    process.env.DEMO_MODE === "true" &&
    !process.env.VERCEL &&
    process.env.NODE_ENV !== "production"
  );
}
export function configured() {
  return firebaseConfigurationIssues().length === 0;
}
function firebaseConfigurationIssues() {
  const issues: string[] = [];
  if (!process.env.FIREBASE_PROJECT_ID) issues.push("FIREBASE_PROJECT_ID");
  if (
    !process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !process.env.FIRESTORE_EMULATOR_HOST
  )
    issues.push(
      "FIREBASE_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS / FIRESTORE_EMULATOR_HOST)",
    );
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      const serviceAccount = JSON.parse(raw);
      if (
        serviceAccount.project_id &&
        process.env.FIREBASE_PROJECT_ID &&
        serviceAccount.project_id !== process.env.FIREBASE_PROJECT_ID
      )
        issues.push("FIREBASE_SERVICE_ACCOUNT_JSON.project_id must match FIREBASE_PROJECT_ID");
    } catch {
      issues.push("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON");
    }
  }
  return issues;
}
export function getStore(): Promise<Store> {
  return (storePromise ??= (async () => {
    if (demoMode()) {
      const s = await new MemoryStore(
        process.env.DEMO_DATA_FILE || ".local/demo.json",
      ).load();
      await seedDemo(s);
      return s;
    }
    assert(
      configured(),
      503,
      "Firebase is not configured. Follow docs/SETUP.md.",
    );
    return new FirestoreStore();
  })());
}
export function integrationStatus() {
  return {
    firebase: configured(),
    razorpay: Boolean(
      process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") &&
      process.env.RAZORPAY_KEY_SECRET,
    ),
    captionAI: Boolean(process.env.GEMINI_API_KEY),
    imageAI: Boolean(
      process.env.HF_TOKEN ||
      (process.env.GEMINI_API_KEY && process.env.GEMINI_IMAGE_MODEL),
    ),
    cloudinary: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_SECRET,
    ),
    instagram: Boolean(
      process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID,
    ),
    email: Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM),
    sms: Boolean(process.env.TEXTBEE_API_KEY && process.env.TEXTBEE_DEVICE_ID),
    scheduler: Boolean(process.env.CRON_SECRET),
    publishEnabled: process.env.INSTAGRAM_PUBLISH_ENABLED === "true",
  };
}
async function identity(req: IncomingMessage) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  assert(token, 401, "Please sign in");
  if (demoMode()) {
    const user = demoProfiles.find((p) => p.id === token);
    assert(user, 401, "Invalid local demo session");
    return { uid: user.id, email: user.email };
  }
  try {
    const decoded = await getAuth(firebaseApp()).verifyIdToken(token, true);
    assert(decoded.email, 401, "An email account is required");
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw new AppError(401, "Session expired. Please sign in again");
  }
}
async function profile(req: IncomingMessage, store: Store) {
  const who = await identity(req);
  const p = await store.get<Profile>("users", who.uid);
  assert(p, 403, "Complete your account profile first");
  return p;
}
async function bodyOf(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const b = Buffer.from(chunk);
    size += b.length;
    assert(size <= 500000, 413, "Request is too large");
    chunks.push(b);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function handle(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  const send = (status: number, data: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  };
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers.origin;
  const allow = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
  if (origin && allow.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization,Content-Type,Idempotency-Key",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    );
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  try {
    const url = new URL(req.url || "/", "http://local");
    const route = url.searchParams.get("route");
    const path = route ? "/api/" + route : url.pathname.replace(/\/$/, "");
    const method = req.method || "GET";
    if (path === "/api/health" && method === "GET")
      return send(200, {
        service: "califnco",
        firebaseProjectId: process.env.FIREBASE_PROJECT_ID || null,
        configurationIssues: firebaseConfigurationIssues(),
        mode: demoMode()
          ? "local-demo"
          : configured()
            ? "firebase"
            : "setup-required",
        integrations: integrationStatus(),
      });
    const raw =
      req.body !== undefined
        ? typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body)
        : ["POST", "PUT", "PATCH", "DELETE"].includes(method)
          ? await bodyOf(req)
          : "";
    const body = raw ? JSON.parse(raw) : {};
    const store = await getStore();
    if (path === "/api/payments/webhook" && method === "POST") {
      const signature = String(req.headers["x-razorpay-signature"] || "");
      assert(
        safeEqual(
          createHmac("sha256", required("RAZORPAY_WEBHOOK_SECRET"))
            .update(raw)
            .digest("hex"),
          signature,
        ),
        401,
        "Invalid webhook signature",
      );
      if (body.event === "payment.captured") {
        const payment = body.payload?.payment?.entity;
        assert(
          payment?.id && payment?.order_id,
          400,
          "Invalid webhook payload",
        );
        const orders = await store.list<Order>(
          "orders",
          { field: "razorpayOrderId", value: payment.order_id },
          1,
        );
        assert(orders[0], 404, "Order is not recorded yet; webhook can retry");
        const order = await markCaptured(store, orders[0].id, payment);
        await orderNotice(store, order);
      }
      return send(200, { received: true });
    }
    if (path === "/api/automation/daily" && method === "POST") {
      assert(
        safeEqual(
          req.headers.authorization || "",
          `Bearer ${required("CRON_SECRET")}`,
        ),
        401,
        "Invalid scheduler credential",
      );
      const result = await runDailyStep(store, {
        dryRun: process.env.INSTAGRAM_PUBLISH_ENABLED !== "true",
        fixture: demoMode(),
      });
      return send(200, result);
    }
    if (path === "/api/maintenance/expire-orders" && method === "POST") {
      assert(
        safeEqual(
          req.headers.authorization || "",
          `Bearer ${required("CRON_SECRET")}`,
        ),
        401,
        "Invalid scheduler credential",
      );
      return send(200, await expireUnpaidReservations(store));
    }
    if (path === "/api/products" && method === "GET") {
      let p: Profile | undefined;
      if (req.headers.authorization) p = await profile(req, store);
      const products = await store.list<Product>("products");
      return send(200, {
        products: products
          .filter((v) => v.active)
          .map((v) => {
            if (
              p?.role === "admin" ||
              (p?.role === "dealer" && p.dealerStatus === "approved")
            )
              return v;
            const { wholesalePrice, ...retailProduct } = v;
            return retailProduct;
          }),
      });
    }
    if (path === "/api/profile" && method === "POST") {
      const who = await identity(req);
      const data = z
        .object({
          name: z.string().trim().min(2).max(100),
          phone: z
            .string()
            .regex(/^\+?[0-9]{10,15}$/)
            .or(z.literal("")),
          role: z.enum(["customer", "dealer"]),
          businessName: z.string().max(100).optional(),
        })
        .parse(body);
      assert(
        data.role !== "dealer" || data.businessName?.trim(),
        400,
        "Business name is required",
      );
      const p = await store.atomic(async (tx) => {
        const old = await tx.get<Profile>("users", who.uid);
        if (old) return old;
        const user: Profile = {
          id: who.uid,
          email: who.email,
          name: data.name,
          phone: data.phone,
          role: data.role,
          dealerStatus: data.role === "dealer" ? "pending" : "none",
          ...(data.businessName ? { businessName: data.businessName } : {}),
          createdAt: new Date().toISOString(),
        };
        tx.put("users", who.uid, user);
        return user;
      });
      return send(200, { profile: p });
    }
    const p = await profile(req, store);
    if (path === "/api/me" && method === "GET")
      return send(200, { profile: p });
    if (path === "/api/me" && method === "PATCH") {
      const data = z
        .object({
          name: z.string().trim().min(2).max(100),
          phone: z
            .string()
            .regex(/^\+?[0-9]{10,15}$/)
            .or(z.literal("")),
          address: addressSchema.optional(),
        })
        .strict()
        .parse(body);
      const updated = await store.atomic(async (tx) => {
        const current = await tx.get<Profile>("users", p.id);
        assert(current, 404, "Profile not found");
        const v = { ...current, ...data, updatedAt: new Date().toISOString() };
        tx.put("users", p.id, v);
        return v;
      });
      return send(200, { profile: updated });
    }
    if (path === "/api/devices" && method === "POST") {
      const data = z
        .object({ token: z.string().min(20).max(4096) })
        .parse(body);
      const id = createHash("sha256").update(data.token).digest("hex");
      await store.atomic(async (tx) => {
        tx.put("devices", id, {
          id,
          uid: p.id,
          token: data.token,
          updatedAt: new Date().toISOString(),
        });
      });
      return send(200, { registered: true });
    }
    if (path === "/api/devices" && method === "DELETE") {
      const data = z
        .object({ token: z.string().min(20).max(4096) })
        .parse(body);
      const id = createHash("sha256").update(data.token).digest("hex");
      await store.atomic(async (tx) => {
        const d = await tx.get("devices", id);
        if (d?.uid === p.id) tx.remove("devices", id);
      });
      return send(200, { removed: true });
    }
    if (path === "/api/orders" && method === "GET")
      return send(200, {
        orders: (
          await store.list<Order>("orders", { field: "uid", value: p.id })
        ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      });
    if (path === "/api/checkout" && method === "POST") {
      if (!demoMode()) {
        required("RAZORPAY_KEY_SECRET");
        assert(
          required("RAZORPAY_KEY_ID").startsWith("rzp_test_"),
          503,
          "Test-mode payments must be configured",
        );
      }
      const { order, created } = await reserveOrder(store, p, body);
      assert(
        order.status === "awaiting_payment",
        409,
        `This checkout is already ${order.status}; start a new checkout`,
      );
      if (!created && !order.razorpayOrderId)
        throw new AppError(
          409,
          "Payment order is being prepared or needs reconciliation. Retry shortly.",
        );
      let result: Order = order;
      if (created) {
        try {
          const external = demoMode()
            ? { id: "order_demo_" + randomUUID().slice(0, 8) }
            : await razorpay("orders", {
                amount: order.amount,
                currency: "INR",
                receipt: order.id,
                notes: { califncoOrderId: order.id },
              });
          result = await store.atomic(async (tx) => {
            const current = await tx.get<Order>("orders", order.id);
            assert(current, 404, "Order not found");
            const updated = { ...current, razorpayOrderId: external.id };
            tx.put("orders", order.id, updated);
            return updated;
          });
        } catch {
          await releaseOrder(store, order.id, "payment_failed");
          throw new AppError(
            502,
            "Payment preparation failed. Stock was released; start a new checkout.",
          );
        }
      }
      return send(200, {
        order: result,
        keyId: demoMode()
          ? "demo-not-a-payment-key"
          : process.env.RAZORPAY_KEY_ID,
        demo: demoMode(),
      });
    }
    if (path === "/api/payments/verify" && method === "POST") {
      const data = z
        .object({
          orderId: z.string(),
          razorpay_payment_id: z.string(),
          razorpay_signature: z.string(),
        })
        .parse(body);
      const order = await store.get<Order>("orders", data.orderId);
      assert(order && order.uid === p.id, 404, "Order not found");
      assert(order.razorpayOrderId, 409, "Payment order is not ready");
      assert(
        verifySignature(
          order.razorpayOrderId,
          data.razorpay_payment_id,
          data.razorpay_signature,
          required("RAZORPAY_KEY_SECRET"),
        ),
        400,
        "Payment signature is invalid",
      );
      const payment = await razorpay(
        "payments/" + encodeURIComponent(data.razorpay_payment_id),
      );
      const updated = await markCaptured(store, order.id, payment);
      await orderNotice(store, updated);
      return send(200, { order: updated });
    }
    if (path === "/api/demo/pay" && method === "POST") {
      assert(demoMode(), 404, "Not found");
      const order = await store.get<Order>("orders", String(body.orderId));
      assert(order && order.uid === p.id, 404, "Order not found");
      const updated = await markCaptured(store, order.id, {
        id: "demo_payment_" + randomUUID(),
        order_id: order.razorpayOrderId!,
        status: "captured",
        amount: order.amount,
        currency: "INR",
      });
      await orderNotice(store, updated);
      return send(200, { order: updated, simulated: true });
    }
    const cancel = path.match(/^\/api\/orders\/([\w-]+)\/cancel$/);
    if (cancel && method === "POST")
      return send(200, {
        order: await releaseOrder(store, cancel[1], "cancelled", p),
      });
    if (path === "/api/services" && method === "GET")
      return send(200, {
        services: await store.list("services", { field: "uid", value: p.id }),
      });
    if (path === "/api/services" && method === "POST") {
      const data = z
        .object({
          type: z.enum([
            "Installation",
            "Filter replacement",
            "Repair",
            "Annual maintenance",
          ]),
          productName: z.string().min(3).max(120),
          description: z.string().min(10).max(1000),
          preferredDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .refine((v) => {
              const d = Date.parse(v + "T00:00:00Z");
              return (
                Number.isFinite(d) &&
                d >= Date.now() - 86400000 &&
                d < Date.now() + 366 * 86400000
              );
            }, "Choose a valid upcoming date"),
          address: addressSchema,
        })
        .parse(body);
      const service: ServiceRequest = {
        ...data,
        id: "SVC-" + randomUUID().slice(0, 12),
        uid: p.id,
        customerName: p.name,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      await store.atomic(async (tx) => {
        tx.put("services", service.id, service);
      });
      await notify(
        store,
        {
          id: service.id,
          uid: p.id,
          email: p.email,
          title: "Service request received",
          body: `Your ${data.type.toLowerCase()} request ${service.id} is open. A time will be confirmed separately.`,
        },
        demoMode(),
      );
      return send(201, { service });
    }
    if (path.startsWith("/api/admin/")) admin(p);
    if (path === "/api/admin/overview" && method === "GET") {
      const [orders, users, products, services, notifications, posts] =
        await Promise.all(
          [
            "orders",
            "users",
            "products",
            "services",
            "notifications",
            "posts",
          ].map((c) => store.list(c)),
        );
      return send(200, {
        orders: orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        users,
        products,
        services,
        notifications,
        posts,
        integrations: integrationStatus(),
        mode: demoMode() ? "local-demo" : "firebase",
      });
    }
    const dealer = path.match(/^\/api\/admin\/dealers\/([\w-]+)$/);
    if (dealer && method === "PATCH") {
      const { status } = z
        .object({ status: z.enum(["approved", "rejected"]) })
        .parse(body);
      const updated = await store.atomic(async (tx) => {
        const u = await tx.get<Profile>("users", dealer[1]);
        assert(u?.role === "dealer", 404, "Dealer not found");
        const v = {
          ...u,
          dealerStatus: status,
          updatedAt: new Date().toISOString(),
        };
        tx.put("users", u.id, v);
        return v;
      });
      await notify(
        store,
        {
          id: `dealer-${updated.id}-${updated.updatedAt}`,
          uid: updated.id,
          email: updated.email,
          title: "Dealer application updated",
          body: `Your dealer application is ${status}.`,
        },
        demoMode(),
      );
      return send(200, { profile: updated });
    }
    const product = path.match(/^\/api\/admin\/products\/([\w-]+)$/);
    if (product && method === "PUT") {
      const data = productSchema.parse(body);
      assert(data.id === product[1], 400, "Product IDs must match");
      await store.atomic(async (tx) => {
        const old = await tx.get("products", data.id);
        tx.put("products", data.id, { ...old, ...data });
      });
      return send(200, { product: data });
    }
    const orderStatus = path.match(/^\/api\/admin\/orders\/([\w-]+)$/);
    if (orderStatus && method === "PATCH") {
      const status = z
        .enum(["processing", "shipped", "delivered"])
        .parse(body.status);
      const order = await changeOrderStatus(
        store,
        p,
        orderStatus[1],
        status as OrderStatus,
      );
      await orderNotice(store, order);
      return send(200, { order });
    }
    const serviceStatus = path.match(/^\/api\/admin\/services\/([\w-]+)$/);
    if (serviceStatus && method === "PATCH") {
      const data = z
        .object({
          status: z.enum([
            "open",
            "scheduled",
            "in_progress",
            "resolved",
            "cancelled",
          ]),
          notes: z.string().max(1000),
        })
        .parse(body);
      const service = await store.atomic(async (tx) => {
        const old = await tx.get<ServiceRequest>("services", serviceStatus[1]);
        assert(old, 404, "Service request not found");
        const updated = { ...old, ...data };
        tx.put("services", old.id, updated);
        return updated;
      });
      return send(200, { service });
    }
    if (path === "/api/admin/automation/step" && method === "POST")
      return send(
        200,
        await runDailyStep(store, { dryRun: true, fixture: demoMode() }),
      );
    throw new AppError(404, "Endpoint not found");
  } catch (e) {
    if (e instanceof ZodError)
      return send(400, {
        error: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (e instanceof SyntaxError)
      return send(400, { error: "Invalid JSON body" });
    if (e instanceof AppError) return send(e.status, { error: e.message });
    console.error(
      "Request failed",
      e instanceof Error ? e.name : "UnknownError",
    );
    if (process.env.FIRESTORE_EMULATOR_HOST) console.error(e);
    return send(500, {
      error: "The request could not be completed. Check the server logs.",
    });
  }
}
async function orderNotice(store: Store, o: Order) {
  await notify(
    store,
    {
      id: `order-${o.id}-${o.status}`,
      uid: o.uid,
      email: o.email,
      phone: o.address.phone,
      title: `Order ${o.id}: ${o.status.replaceAll("_", " ")}`,
      body: `Your order total is INR ${(o.amount / 100).toFixed(2)}. You can track it in Califnco.`,
    },
    demoMode(),
  );
}
