import { sql } from "drizzle-orm";
import type { Migration } from "./types"; // если у тебя есть общий тип

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