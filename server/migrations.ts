import { pool } from "./db";

export async function runDatabaseMigrations(): Promise<void> {
  await pool.query(`
    ALTER TABLE activities
      ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'created',
      ADD COLUMN IF NOT EXISTS reviewed_by varchar,
      ADD COLUMN IF NOT EXISTS reviewed_at timestamp,
      ADD COLUMN IF NOT EXISTS completed_at timestamp;

    CREATE INDEX IF NOT EXISTS activities_approval_status_idx
      ON activities (approval_status);

    UPDATE activities
    SET
      approval_status = 'approved',
      completed_at = COALESCE(completed_at, updated_at, created_at, NOW())
    WHERE status = 'completed'
      AND approval_status = 'created';

  `);

  console.log("Database migrations applied");
}
