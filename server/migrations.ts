import { pool } from "./db";

export async function runDatabaseMigrations(): Promise<void> {
  const statements = [
    "ALTER TABLE activities ADD COLUMN IF NOT EXISTS planning_time_zone text",
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_time_zone text",
    "ALTER TABLE activities ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'created'",
    "ALTER TABLE activities ADD COLUMN IF NOT EXISTS reviewed_by varchar",
    "ALTER TABLE activities ADD COLUMN IF NOT EXISTS reviewed_at timestamp",
    "ALTER TABLE activities ADD COLUMN IF NOT EXISTS completed_at timestamp",
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_on_maternity_leave boolean NOT NULL DEFAULT false",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email text",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_subject text",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'",
    "CREATE TABLE IF NOT EXISTS message_reads (message_id varchar NOT NULL REFERENCES messages(id) ON DELETE CASCADE, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, read_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY (message_id, user_id))",
    "CREATE INDEX IF NOT EXISTS message_reads_user_idx ON message_reads(user_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_subject_idx ON users (oidc_subject) WHERE oidc_subject IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email))",
    "CREATE TABLE IF NOT EXISTS user_login_sessions (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar REFERENCES users(id) ON DELETE SET NULL, username text NOT NULL, full_name text NOT NULL, login_at timestamptz NOT NULL DEFAULT NOW(), last_activity_at timestamptz NOT NULL DEFAULT NOW(), logout_at timestamptz, duration_seconds integer NOT NULL DEFAULT 0, is_test_session boolean NOT NULL DEFAULT false, initiated_by_username text)",
    "CREATE INDEX IF NOT EXISTS user_login_sessions_user_idx ON user_login_sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS user_login_sessions_login_at_idx ON user_login_sessions(login_at DESC)",
    "CREATE TABLE IF NOT EXISTS manager_plan_performance (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), manager_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, region text NOT NULL, week_start timestamp NOT NULL, plan_amount numeric(14,2) NOT NULL, actual_amount numeric(14,2) NOT NULL, updated_at timestamp NOT NULL DEFAULT NOW(), CONSTRAINT manager_plan_performance_unique_week UNIQUE (manager_id, region, week_start))",
    "CREATE INDEX IF NOT EXISTS manager_plan_performance_manager_idx ON manager_plan_performance(manager_id)",
    "CREATE INDEX IF NOT EXISTS manager_plan_performance_week_idx ON manager_plan_performance(week_start DESC)",
    "CREATE TABLE IF NOT EXISTS activity_history (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), activity_id varchar NOT NULL REFERENCES activities(id) ON DELETE CASCADE, actor_id varchar REFERENCES users(id) ON DELETE SET NULL, event_type text NOT NULL, from_value text, to_value text, details text, created_at timestamptz NOT NULL DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS activity_history_activity_idx ON activity_history(activity_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS activity_history_actor_idx ON activity_history(actor_id)"
  ];
  for (const statement of statements) {
    try { await pool.query(statement); }
    catch (error) { console.warn("Database migration skipped:", error instanceof Error ? error.message : String(error)); }
  }
  console.log("Database migrations applied");
}
