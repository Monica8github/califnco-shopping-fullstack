import { getStore, demoMode } from "../functions/app.js";
import { runDailyStep } from "./engine.js";
const store = await getStore();
for (let i = 0; i < 12; i++) {
  const r = await runDailyStep(store, {
    dryRun: process.env.INSTAGRAM_PUBLISH_ENABLED !== "true",
    fixture: demoMode(),
  });
  console.log(
    JSON.stringify({
      id: r.post.id,
      status: r.post.status,
      done: r.done,
      error: r.post.error,
    }),
  );
  if (r.done) {
    if (["failed", "needs_review"].includes(r.post.status))
      process.exitCode = 1;
    break;
  }
  await new Promise((r) => setTimeout(r, 5000));
  if (i === 11) {
    console.error(
      "Workflow is still pending; rerun to resume its saved state.",
    );
    process.exitCode = 1;
  }
}
