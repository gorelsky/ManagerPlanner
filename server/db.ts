import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { databasePoolConfig } from "./database-config";

export const pool = new pg.Pool(databasePoolConfig());

// A transient PostgreSQL/pgbouncer connection error must not terminate the
// Serverless Container process. The pool will discard the broken client and
// create a fresh connection for the next request.
pool.on("error", error => {
  console.error("PostgreSQL pool error:", error instanceof Error ? error.message : error);
});

// Managed PostgreSQL connections may be proxied through pgbouncer and ignore
// the startup `options` parameter. Set the application schema explicitly for
// every newly opened session so unqualified Drizzle and migration queries
// resolve the public tables consistently.
pool.on("connect", client => {
  void client.query("SET search_path TO public").catch(error => {
    console.error("PostgreSQL search_path error:", error instanceof Error ? error.message : error);
  });
});

export const db = drizzle(pool, { schema });
