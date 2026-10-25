import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { handle } from "./app.js";
// Native clients use the API origin for catalogue images as well. In production
// Vercel serves these assets; keep the same URLs working in local development.
createServer(async (req, res) => {
  const path = new URL(req.url || "/", "http://localhost").pathname;
  if (
    ["GET", "HEAD"].includes(req.method || "GET") &&
    /^\/products\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/.test(path)
  ) {
    try {
      const data = await readFile(
        new URL("../apps/admin/public" + path, import.meta.url),
      );
      const extension = path.split(".").pop();
      res.setHeader(
        "Content-Type",
        extension === "webp"
          ? "image/webp"
          : extension === "png"
            ? "image/png"
            : "image/jpeg",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Length", data.length);
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.statusCode = 404;
      res.end("Product image not found");
    }
    return;
  }
  await handle(req, res);
}).listen(8787, "0.0.0.0", () =>
  console.log("Califnco API: http://localhost:8787"),
);
