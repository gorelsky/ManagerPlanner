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

    ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS is_on_maternity_leave boolean NOT NULL DEFAULT false;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS user_login_sessions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      username text NOT NULL,
      full_name text NOT NULL,
      login_at timestamptz NOT NULL DEFAULT NOW(),
      last_activity_at timestamptz NOT NULL DEFAULT NOW(),
      logout_at timestamptz,
      duration_seconds integer NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS user_login_sessions_user_idx
      ON user_login_sessions (user_id);

    CREATE INDEX IF NOT EXISTS user_login_sessions_login_at_idx
      ON user_login_sessions (login_at DESC);

  `);

  console.log("Database migrations applied");
}
