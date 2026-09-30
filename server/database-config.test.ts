import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolConfig } from "./database-config";

const source = "postgresql://fixture@source.invalid/test";
const target = {
  DATABASE_TARGET: "yandex", DATABASE_URL: source,
  YANDEX_PG_HOST: "target.invalid", YANDEX_PG_DATABASE: "managerplanner",
  YANDEX_PG_USER: "fixture", YANDEX_PG_PASSWORD: "test-only",
  YANDEX_PG_SSL_CA_FILE: "fixture.pem",
};
const certificate = () => "-----BEGIN CERTIFICATE-----\ntest-fixture\n-----END CERTIFICATE-----";

test("existing Railway/Supabase connection is unchanged by default", () => {
  assert.deepEqual(databasePoolConfig({ DATABASE_URL: source }), { connectionString: source });
});
test("Yandex requires explicit selection and verifies TLS", () => {
  const config = databasePoolConfig(target, certificate);
  assert.equal(config.database, "managerplanner");
  assert.equal(config.port, 6432);
  assert.equal(config.connectionString, undefined);
  assert.equal(typeof config.ssl === "object" && config.ssl.rejectUnauthorized, true);
});
test("missing credentials fail closed instead of falling back to Supabase", () => {
  assert.throws(() => databasePoolConfig({ ...target, YANDEX_PG_PASSWORD: "" }, certificate), /YANDEX_PG_PASSWORD/);
  assert.throws(() => databasePoolConfig({ ...target, YANDEX_PG_SSL_CA_FILE: "" }, certificate), /YANDEX_PG_SSL_CA_FILE/);
});
test("invalid selection, port, or certificate are rejected", () => {
  assert.throws(() => databasePoolConfig({ DATABASE_TARGET: "unknown" }), /DATABASE_TARGET/);
  assert.throws(() => databasePoolConfig({ ...target, YANDEX_PG_PORT: "0" }, certificate), /YANDEX_PG_PORT/);
  assert.throws(() => databasePoolConfig(target, () => ""), /certificate/);
});
