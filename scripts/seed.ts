import { readFile } from "node:fs/promises";
import { getStore, demoMode } from "../functions/app.js";
import { productSchema } from "../functions/domain.js";
const store = await getStore();
const catalogue = JSON.parse(
  await readFile(new URL("../shared/catalogue.json", import.meta.url), "utf8"),
) as unknown[];
const products = catalogue.map((p) => productSchema.parse(p));
let created = 0,
  existing = 0;
for (const p of products) {
  await store.atomic(async (tx) => {
    if (await tx.get("products", p.id)) {
      existing++;
      return;
    }
    tx.put("products", p.id, p);
    created++;
  });
}
console.log(
  JSON.stringify({
    mode: demoMode() ? "local-demo" : "firebase",
    created,
    existing,
    total: products.length,
  }),
);
// Existing records are deliberately preserved: seeding must not reset stock or edits.
