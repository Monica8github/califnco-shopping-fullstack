import { randomUUID } from "node:crypto";
import type { Store } from "../functions/store.js";
import type { Product } from "../shared/types.js";
import { assert } from "../functions/domain.js";
import { notify } from "../functions/notifications.js";
import {
  realProviders,
  fixtureProviders,
  type SocialProviders,
} from "./providers.js";
type PostState =
  | "selected"
  | "caption_ready"
  | "image_ready"
  | "container_ready"
  | "publishing"
  | "published"
  | "dry_run"
  | "needs_review"
  | "failed";
export interface Post {
  id: string;
  day: string;
  product: Product;
  status: PostState;
  caption?: string;
  imageUrl?: string;
  aiGenerated?: boolean;
  containerId?: string;
  mediaId?: string;
  createdAt: string;
  updatedAt: string;
  dryRun: boolean;
  fixture: boolean;
  attempts: number;
  error?: string;
  leaseOwner?: string;
  leaseUntil?: number;
  publishedAt?: string;
}
const complete = (status: string) =>
  ["published", "dry_run", "needs_review", "failed"].includes(status);
function dateInZone(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.AUTOMATION_TIMEZONE || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export async function runDailyStep(
  store: Store,
  options: {
    dryRun: boolean;
    fixture?: boolean;
    now?: Date;
    providers?: SocialProviders;
  },
) {
  assert(
    !options.fixture || options.dryRun,
    400,
    "Fixture mode cannot publish",
  );
  const now = options.now || new Date(),
    day = dateInZone(now),
    id = `${day}-${options.dryRun ? "draft" : "live"}`,
    owner = randomUUID();
  const providers =
    options.providers || (options.fixture ? fixtureProviders : realProviders);
  const candidates = (await store.list<Product>("products"))
    .filter((p) => p.active && p.stock > 0)
    .sort(
      (a, b) =>
        (a.lastPostedAt || "").localeCompare(b.lastPostedAt || "") ||
        a.id.localeCompare(b.id),
    );
  assert(candidates.length, 409, "No in-stock products are available");
  const locked = await store.atomic(async (tx) => {
    let p = await tx.get<Post>("posts", id);
    if (p && complete(p.status)) return { post: p, acquired: false };
    if (p?.leaseUntil && p.leaseUntil > now.getTime())
      return { post: p, acquired: false };
    if (p?.status === "publishing") {
      p = {
        ...p,
        status: "needs_review",
        error:
          "Publish outcome is uncertain. Reconcile the saved container with Instagram before retrying.",
        updatedAt: now.toISOString(),
      };
      tx.put("posts", id, p);
      return { post: p, acquired: false };
    }
    if (!p)
      p = {
        id,
        day,
        product: candidates[0],
        status: "selected",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        dryRun: options.dryRun,
        fixture: !!options.fixture,
        attempts: 0,
      };
    p = { ...p, leaseOwner: owner, leaseUntil: now.getTime() + 120000 };
    tx.put("posts", id, p);
    return { post: p, acquired: true };
  });
  if (!locked.acquired)
    return {
      done: complete(locked.post.status),
      post: locked.post,
      locked: !complete(locked.post.status),
    };
  let current = locked.post;
  async function update(patch: Partial<Post>) {
    current = await store.atomic(async (tx) => {
      const p = await tx.get<Post>("posts", id);
      assert(p?.leaseOwner === owner, 409, "Automation lease was replaced");
      const updated = { ...p, ...patch, updatedAt: new Date().toISOString() };
      tx.put("posts", id, updated);
      return updated;
    });
  }
  try {
    if (current.status === "selected")
      await update({
        caption: await providers.caption(current.product),
        status: "caption_ready",
        attempts: 0,
      });
    else if (current.status === "caption_ready") {
      const image = await providers.image(current.product);
      assert(
        options.fixture || image.generated,
        502,
        "Live provider must return an AI-generated image",
      );
      await update({
        imageUrl: image.url,
        aiGenerated: image.generated,
        status: "image_ready",
        attempts: 0,
      });
    } else if (current.status === "image_ready") {
      if (options.dryRun) await update({ status: "dry_run" });
      else {
        assert(
          current.aiGenerated,
          400,
          "An AI-generated image is required to publish",
        );
        const fresh = await store.get<Product>("products", current.product.id);
        assert(
          fresh?.active && fresh.price === current.product.price,
          409,
          "Product price or availability changed; review this draft",
        );
        await update({
          containerId: await providers.container(
            current.imageUrl!,
            current.caption!,
          ),
          status: "container_ready",
          attempts: 0,
        });
      }
    } else if (current.status === "container_ready") {
      const state = await providers.containerStatus(current.containerId!);
      if (state === "ERROR" || state === "EXPIRED")
        await update({
          status: "failed",
          error: `Instagram container is ${state}`,
        });
      else if (state === "PUBLISHED")
        await update({
          status: "needs_review",
          error:
            "Container is already published; reconcile the media ID manually",
        });
      else if (state === "FINISHED") {
        // Persist the dangerous boundary before publishing; never auto-retry media_publish.
        await update({ status: "publishing" });
        const response = await providers.publish(current.containerId!);
        await store.atomic(async (tx) => {
          const p = await tx.get<Post>("posts", id);
          assert(p?.leaseOwner === owner, 409, "Lease changed");
          const product = await tx.get<Product>("products", current.product.id);
          const timestamp = new Date().toISOString();
          current = {
            ...p,
            status: "published",
            mediaId: response.id,
            publishedAt: timestamp,
            updatedAt: timestamp,
          };
          tx.put("posts", id, current);
          if (product)
            tx.put("products", product.id, {
              ...product,
              lastPostedAt: timestamp,
            });
        });
      }
    }
  } catch (e) {
    const attempts = current.attempts + 1;
    await update({
      attempts,
      status:
        current.status === "publishing"
          ? "needs_review"
          : attempts >= 3
            ? "failed"
            : current.status,
      error: e instanceof Error ? e.message : "Automation step failed",
    });
  } finally {
    await update({ leaseUntil: 0 });
  }
  if (complete(current.status))
    await notify(
      store,
      {
        id: "automation-" + id + "-" + current.status,
        email: process.env.AUTOMATION_ALERT_EMAIL,
        title: `Califnco daily post: ${current.status}`,
        body: `Product: ${current.product.name}\nState: ${current.status}\n${current.error || current.mediaId || "No Instagram post was published."}`,
      },
      !!options.fixture,
    );
  return { done: complete(current.status), post: current, locked: false };
}
