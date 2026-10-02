import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

// Explicit selection prevents a partial migration from silently switching the
// live application, or falling back to a different database after an outage.
export function databasePoolConfig(
  env: NodeJS.ProcessEnv = process.env,
  readCertificate: (path: string) => string = path => readFileSync(path, "utf8"),
): PoolConfig {
  const target = env.DATABASE_TARGET || "supabase";
  if (target === "supabase") {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL must be set");
    return { connectionString: env.DATABASE_URL };
  }
  if (target !== "yandex") throw new Error("DATABASE_TARGET must be supabase or yandex");

  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`${name} must be set for Yandex PostgreSQL`);
    return value;
  };
  const port = Number(env.YANDEX_PG_PORT || "6432");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid YANDEX_PG_PORT");
  const host = required("YANDEX_PG_HOST");
  const database = required("YANDEX_PG_DATABASE");
  const user = required("YANDEX_PG_USER");
  const password = required("YANDEX_PG_PASSWORD");
  const ca = readCertificate(required("YANDEX_PG_SSL_CA_FILE"));
  if (!ca.includes("-----BEGIN CERTIFICATE-----")) throw new Error("Invalid Yandex PostgreSQL CA certificate");
  return {
    host, port, database, user, password,
    ssl: { rejectUnauthorized: true, ca },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5,
    application_name: "managerplanner",
    options: "-c search_path=public",
  };
}
