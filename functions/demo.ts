import catalogue from "../shared/catalogue.json" with { type: "json" };
import type { Store } from "./store.js";
export const demoProfiles = [
  {
    id: "demo-admin",
    name: "Monish",
    email: "admin@example.test",
    phone: "",
    role: "admin",
    dealerStatus: "none",
  },
  {
    id: "demo-customer",
    name: "Demo Customer",
    email: "customer@example.test",
    phone: "9876543210",
    role: "customer",
    dealerStatus: "none",
  },
  {
    id: "demo-dealer",
    name: "Aqua Partners",
    email: "dealer@example.test",
    phone: "9876543211",
    role: "dealer",
    dealerStatus: "approved",
    businessName: "Aqua Partners",
  },
  {
    id: "demo-pending",
    name: "Fresh Flow Supplies",
    email: "pending@example.test",
    phone: "9876543212",
    role: "dealer",
    dealerStatus: "pending",
    businessName: "Fresh Flow Supplies",
  },
];
export async function seedDemo(store: Store) {
  if (await store.get("meta", "seed")) return;
  await store.atomic(async (tx) => {
    const at = new Date().toISOString();
    for (const p of catalogue) tx.put("products", p.id, p);
    for (const p of demoProfiles)
      tx.put("users", p.id, { ...p, createdAt: at });
    const statuses = [
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "delivered",
      "delivered",
      "confirmed",
      "processing",
    ];
    for (let n = 0; n < 8; n++) {
      const p = catalogue[n * 3];
      const createdAt = new Date(Date.now() - n * 8 * 3600000).toISOString();
      const id = `DEMO-${2400 + n}`;
      tx.put("orders", id, {
        id,
        uid: n % 2 ? "demo-dealer" : "demo-customer",
        customerName: n % 2 ? "Aqua Partners" : "Demo Customer",
        email: "customer@example.test",
        role: n % 2 ? "dealer" : "customer",
        items: [
          {
            productId: p.id,
            name: p.name,
            image: p.image,
            quantity: n % 2 ? 5 : 1,
            unitPrice: p.price * 100,
          },
        ],
        address: {
          name: "Demo Customer",
          phone: "9876543210",
          line1: "24 Sample Street",
          city: "Chennai",
          state: "Tamil Nadu",
          pincode: "600001",
        },
        amount: p.price * 100 * (n % 2 ? 5 : 1),
        currency: "INR",
        status: statuses[n],
        paymentStatus: "captured",
        createdAt,
        updatedAt: createdAt,
        expiresAt: createdAt,
        history: [{ status: statuses[n], at: createdAt }],
        demo: true,
      });
    }
    tx.put("services", "DEMO-SVC-1", {
      id: "DEMO-SVC-1",
      uid: "demo-customer",
      customerName: "Demo Customer",
      type: "Filter replacement",
      productName: catalogue[0].name,
      description: "Please inspect the filter and confirm a service slot.",
      preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      address: {
        name: "Demo Customer",
        phone: "9876543210",
        line1: "24 Sample Street",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
      },
      status: "open",
      createdAt: at,
    });
    tx.put("meta", "seed", { createdAt: at });
  });
}
