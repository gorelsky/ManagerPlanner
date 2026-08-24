import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

type Migration = (
  db: NodePgDatabase<typeof import("@shared/schema")>,
) => Promise<void>;

export const up: Migration = async (db) => {
  await db.execute(
    sql`ALTER TABLE users ADD COLUMN email text;`,
  );
};

export const down: Migration = async (db) => {
  await db.execute(
    sql`ALTER TABLE users DROP COLUMN email;`,
  );
};
