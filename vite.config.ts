import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function getProductionAssetBase() {
  const configuredOrigin = process.env.PUBLIC_ASSET_ORIGIN?.trim();
  if (!configuredOrigin) return "/";
  return `${configuredOrigin.replace(/\/+$/, "")}/`;
}

export default defineConfig(({ command }) => ({
  // Keep production assets on the same Yandex Cloud origin as the page and API.
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
