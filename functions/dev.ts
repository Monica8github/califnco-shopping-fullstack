import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { handle } from "./app.js";
const productImageDirectory = resolve(
  process.cwd(),
  "apps/admin/public/products",
);
const server = createServer(async (req, res) => {
  const path = new URL(req.url || "/", "http://localhost").pathname;
  if (
    ["GET", "HEAD"].includes(req.method || "GET") &&
    /^\/products\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/.test(path)
  ) {
    try {
      const data = await readFile(
        resolve(productImageDirectory, path.slice("/products/".length)),
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
});
const port = Number.parseInt(process.env.PORT || "8787", 10);
server.listen(port, "0.0.0.0", () =>
  console.log(`Califnco API listening on port ${port}`),
);
