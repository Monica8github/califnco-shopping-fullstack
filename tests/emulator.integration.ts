import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createServer, type Server } from "node:http";
let env: RulesTestEnvironment,
  server: Server,
  base: string,
  token: string,
  uid: string;
before(async () => {
  process.env.DEMO_MODE = "false";
  process.env.FIREBASE_PROJECT_ID = "demo-califnco";
  env = await initializeTestEnvironment({
    projectId: "demo-califnco",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
  await env.clearFirestore();
  const { handle } = await import("../functions/app.js");
  server = createServer(handle);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + (server.address() as any).port;
  const r = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `qa-${Date.now()}@example.test`,
        password: "Test-only-pass123!",
        returnSecureToken: true,
      }),
    },
  );
  const d = await r.json();
  assert.ok(d.idToken);
  token = d.idToken;
  uid = d.localId;
});
after(async () => {
  await env.cleanup();
  await new Promise<void>((r) => server.close(() => r()));
});
test("Firebase Auth emulator token creates profile through API and reads back from Firestore", async () => {
  const r = await fetch(base + "/api/profile", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Emulator User",
      phone: "9876543210",
      role: "customer",
    }),
  });
  assert.equal(r.status, 200);
  const own = env.authenticatedContext(uid).firestore();
  const snapshot = await assertSucceeds(getDoc(doc(own, "users", uid)));
  assert.equal(snapshot.data()?.role, "customer");
  const me = await fetch(base + "/api/me", {
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).profile.id, uid);
});
test("Firestore rules deny self-promotion, direct orders, wholesale reads and cross-user reads", async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "products", "p"), {
      id: "p",
      price: 100,
      wholesalePrice: 70,
    });
    await setDoc(doc(db, "users", "other"), { id: "other", role: "customer" });
    await setDoc(doc(db, "orders", "o"), { uid: "other", amount: 100 });
  });
  const db = env.authenticatedContext(uid).firestore();
  await assertFails(
    setDoc(doc(db, "users", uid), { role: "admin" }, { merge: true }),
  );
  await assertFails(
    setDoc(doc(db, "orders", "forged"), {
      uid,
      amount: 1,
      paymentStatus: "captured",
    }),
  );
  await assertFails(getDoc(doc(db, "products", "p")));
  await assertFails(getDoc(doc(db, "users", "other")));
  await assertFails(getDoc(doc(db, "orders", "o")));
});
test("Firestore rules permit explicitly bootstrapped admins and reject anonymous reads", async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "users", "administrator"), {
      id: "administrator",
      role: "admin",
    });
  });
  await assertSucceeds(
    getDoc(
      doc(
        env.authenticatedContext("administrator").firestore(),
        "products",
        "p",
      ),
    ),
  );
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), "products", "p")),
  );
});
