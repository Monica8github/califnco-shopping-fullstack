import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../functions/store.js";
import { runDailyStep, type Post } from "../automation/engine.js";
import type { SocialProviders } from "../automation/providers.js";
import catalogue from "../shared/catalogue.json" with { type: "json" };
const now = new Date("2026-10-23T04:30:00Z");
async function setup() {
  const s = new MemoryStore();
  await s.atomic(async (t) => {
    t.put("products", catalogue[0].id, catalogue[0]);
    t.put("products", catalogue[1].id, {
      ...catalogue[1],
      lastPostedAt: "2026-10-22T00:00:00Z",
    });
  });
  return s;
}
function providers() {
  let published = 0;
  const api: SocialProviders = {
    caption: async (p) => "AI test caption for " + p.name,
    image: async () => ({
      url: "https://example.test/image.jpg",
      generated: true,
    }),
    container: async () => "container-1",
    containerStatus: async () => "FINISHED",
    publish: async () => {
      published++;
      return { id: "media-1" };
    },
  };
  return { api, count: () => published };
}
test("dry run generates image and caption, records draft, never publishes", async () => {
  const s = await setup(),
    p = providers();
  let result;
  for (let i = 0; i < 3; i++)
    result = await runDailyStep(s, { dryRun: true, now, providers: p.api });
  assert.equal(result!.post.status, "dry_run");
  assert.equal(result!.post.aiGenerated, true);
  assert.equal(p.count(), 0);
  assert.equal(result!.post.product.id, catalogue[0].id);
});
test("daily live job publishes once across concurrent and repeated invocations", async () => {
  const s = await setup(),
    p = providers();
  for (let i = 0; i < 6; i++)
    await Promise.all([
      runDailyStep(s, { dryRun: false, now, providers: p.api }),
      runDailyStep(s, { dryRun: false, now, providers: p.api }),
    ]);
  const post = await s.get<Post>("posts", "2026-10-23-live");
  assert.equal(post?.status, "published");
  assert.equal(p.count(), 1);
  assert.equal(post?.mediaId, "media-1");
  assert.ok((await s.get("products", catalogue[0].id))?.lastPostedAt);
});
test("ambiguous publish failure never auto-retries publishing", async () => {
  const s = await setup(),
    p = providers();
  let attempts = 0;
  p.api.publish = async () => {
    attempts++;
    throw new Error("response lost");
  };
  for (let i = 0; i < 6; i++)
    await runDailyStep(s, { dryRun: false, now, providers: p.api });
  assert.equal(
    (await s.get<Post>("posts", "2026-10-23-live"))?.status,
    "needs_review",
  );
  assert.equal(attempts, 1);
});
test("provider failure is bounded and visible", async () => {
  const s = await setup(),
    p = providers();
  p.api.caption = async () => {
    throw new Error("quota exhausted");
  };
  for (let i = 0; i < 4; i++)
    await runDailyStep(s, { dryRun: true, now, providers: p.api });
  const post = await s.get<Post>("posts", "2026-10-23-draft");
  assert.equal(post?.status, "failed");
  assert.equal(post?.attempts, 3);
  assert.equal(post?.error, "quota exhausted");
});
test("fixture mode cannot be used to publish", async () => {
  const s = await setup();
  await assert.rejects(
    () => runDailyStep(s, { dryRun: false, fixture: true, now }),
    /cannot publish/,
  );
});
test("local fixture is honestly marked as non-AI", async () => {
  const s = await setup();
  let result;
  for (let i = 0; i < 3; i++)
    result = await runDailyStep(s, { dryRun: true, fixture: true, now });
  assert.equal(result!.post.aiGenerated, false);
  assert.match(result!.post.caption!, /NOT AI GENERATED/);
});
