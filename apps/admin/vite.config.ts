import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  envDir: "../..",
  server: { allowedHosts: true, proxy: { "/api": "http://127.0.0.1:8787" } },
  build: { outDir: "dist", chunkSizeWarningLimit: 700 },
});
