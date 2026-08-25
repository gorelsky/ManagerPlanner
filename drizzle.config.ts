import { defineConfig } from "drizzle-kit";

if (!process.env.DRIZZLE_DATABASE_URL) {
  throw new Error("DRIZZLE_DATABASE_URL must be set for Drizzle migrations");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DRIZZLE_DATABASE_URL,
  },
});
