import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const defaultProductionAssetOrigin = "https://managerplanner.up.railway.app";

function getProductionAssetBase() {
  const configuredOrigin =
    process.env.PUBLIC_ASSET_ORIGIN?.trim() || defaultProductionAssetOrigin;

  return `${configuredOrigin.replace(/\/+$/, "")}/`;
}

export default defineConfig(({ command }) => ({
  // Keep development assets local. In production, load the large immutable
  // bundles directly from Railway while the page and API stay on the custom
  // domain. This avoids the failing Cloudflare path for large static files.
  base: command === "build" ? getProductionAssetBase() : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:5002",
        changeOrigin: true,
      },
    },
  },
}));
