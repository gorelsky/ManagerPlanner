import assert from "node:assert/strict";
import test from "node:test";
import {
  getLatestAllowedPlanWeek,
  parsePlanPerformanceWeek,
} from "./plan-performance";

const referenceDate = new Date(2026, 8, 14, 12, 0, 0);

test("разбирает русскую, американскую и серийную дату Excel", () => {
  assert.equal(
    parsePlanPerformanceWeek("07.09.2026", referenceDate).getFullYear(),
    2026,
  );
  assert.equal(
    parsePlanPerformanceWeek("9/7/26", referenceDate).getFullYear(),
    2026,
  );
  assert.equal(
    parsePlanPerformanceWeek("46272", referenceDate).getUTCFullYear(),
    2026,
  );
});

test("не принимает ошибочную дату из далёкого будущего", () => {
  assert.throws(
    () => parsePlanPerformanceWeek("1/1/36", referenceDate),
    /вне допустимого периода/,
  );
});

test("верхняя граница зависит от текущей даты", () => {
  assert.equal(getLatestAllowedPlanWeek(referenceDate).getFullYear(), 2028);
});
