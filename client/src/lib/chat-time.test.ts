import test from "node:test";
import assert from "node:assert/strict";
import { formatChatTime } from "./chat-time";

test("sender timezone determines time and calendar date", () => {
  assert.match(formatChatTime("2026-09-16T15:00:00Z", "Asia/Omsk"), /21:00/);
  assert.match(formatChatTime("2026-09-16T15:00:00Z", "Europe/Moscow"), /18:00/);
  assert.match(formatChatTime("2026-09-16T21:30:00Z", "Asia/Omsk"), /17\.09\.2026.*03:30/);
});

test("old messages and invalid timezone use explicit local fallback", () => {
  assert.match(formatChatTime("2026-09-16T15:00:00Z", null), /пояс отправителя неизвестен/);
  assert.match(formatChatTime("2026-09-16T15:00:00Z", "invalid"), /пояс отправителя неизвестен/);
  assert.equal(formatChatTime(null), "Время не указано");
  assert.equal(formatChatTime("bad"), "Время недоступно");
});
