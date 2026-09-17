import assert from "node:assert/strict";
import test from "node:test";
import { planningDate, planningExcelDate, planningInstant, planningBoundary } from "./planning-time";
import { insertActivitySchema, updateActivitySchema } from "./schema";

const zone = "Asia/Novosibirsk";

test("09:00–18:00 in Novosibirsk stays 09:00–18:00 for any viewer", () => {
  const start = planningDate("2026-09-17T02:00:00Z", zone);
  const end = planningDate("2026-09-17T11:00:00Z", zone);
  assert.equal(start.getHours(), 9);
  assert.equal(end.getHours(), 18);
  assert.equal(start.getDate(), 17);
});

test("editing from another zone preserves the original instants", () => {
  const start = "2026-09-17T02:00:00.000Z";
  const end = "2026-09-17T11:00:00.000Z";
  assert.equal(planningInstant(planningDate(start, zone), "09:00", zone).toISOString(), start);
  assert.equal(planningInstant(planningDate(end, zone), "18:00", zone).toISOString(), end);
  assert.equal(planningInstant(new Date(2026, 8, 17), "09:30", "Europe/Moscow").toISOString(), "2026-09-17T06:30:00.000Z");
});

test("month boundary follows the plan's date, not UTC", () => {
  const local = planningDate("2026-08-31T17:30:00Z", zone);
  assert.equal(local.getMonth(), 8);
  assert.equal(local.getDate(), 1);
  assert.equal(local.getHours(), 0);
  assert.equal(local.getMinutes(), 30);
});

test("calendar range preserves selected days and milliseconds", () => {
  assert.equal(planningBoundary(new Date(2026, 8, 1)), "2026-09-01T00:00:00.000Z");
  assert.equal(planningBoundary(new Date(2026, 8, 30, 23, 59, 59, 999)), "2026-09-30T23:59:59.999Z");
});

test("Excel serial dates contain local plan time", () => {
  assert.equal(planningExcelDate("2026-09-17T02:00:00Z", zone).toISOString(), "2026-09-17T09:00:00.000Z");
});

test("unknown legacy zone uses stable UTC, without viewer-dependent shifts", () => {
  assert.equal(planningDate("2026-09-17T09:00:00Z", null).getHours(), 9);
});

test("zone is accepted on create/update and invalid zones are rejected", () => {
  assert.equal(updateActivitySchema.parse({ planningTimeZone: zone }).planningTimeZone, zone);
  assert.equal(updateActivitySchema.safeParse({ planningTimeZone: "invalid-zone" }).success, false);
  const data = { userId: "user", typeId: "type", cityId: "city", title: "plan",
    startDate: new Date("2026-09-17T02:00:00Z"), endDate: new Date("2026-09-17T11:00:00Z"), planningTimeZone: zone };
  assert.equal(insertActivitySchema.parse(data).planningTimeZone, zone);
  assert.equal(insertActivitySchema.safeParse({ ...data, planningTimeZone: "invalid-zone" }).success, false);
});
