import { getAuth } from "firebase-admin/auth";
import { getStore, demoMode } from "../functions/app.js";
import { firebaseApp } from "../functions/store.js";
import type { Profile } from "../shared/types.js";
const email = process.argv[2];
if (!email || !email.includes("@"))
  throw new Error(
    "Usage: npm run bootstrap:admin -- admin@example.com (existing Firebase Auth user)",
  );
if (demoMode())
  throw new Error(
    "Disable DEMO_MODE before bootstrapping a real Firebase administrator.",
  );
const store = await getStore();
const account = await getAuth(firebaseApp()).getUserByEmail(email);
await store.atomic(async (tx) => {
  const old = await tx.get<Profile>("users", account.uid);
  tx.put("users", account.uid, {
    ...old,
    id: account.uid,
    email: account.email!,
    name: old?.name || account.displayName || "Administrator",
    phone: old?.phone || "",
    role: "admin",
    dealerStatus: "none",
    createdAt: old?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});
console.log("Administrator role set for the specified existing account.");
