import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { databasePoolConfig } from "./database-config";

export const pool = new pg.Pool(databasePoolConfig());

// Set the schema explicitly for every session. Some managed PostgreSQL
// proxies ignore startup options, which otherwise leaves search_path empty.
pool.on("connect", client => {
  void client.query("SET search_path TO public");
});

export const db = drizzle(pool, { schema });
