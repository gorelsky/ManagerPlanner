import assert from "node:assert/strict";
import test from "node:test";
import { changePasswordSchema, createTemporaryPassword, PASSWORD_MIN_LENGTH } from "./passwords";

test("password policy accepts a strong password", () => {
  assert.equal(
    changePasswordSchema.safeParse({
      currentPassword: "Temporary7!",
      newPassword: "NewSecure42!",
    }).success,
    true,
  );
});

test("password policy rejects short, letter-only and unchanged passwords", () => {
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: "Old123456", newPassword: "Short1" }).success,
    false,
  );
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: "Old123456", newPassword: "OnlyLetters" }).success,
    false,
  );
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: "SamePassword1", newPassword: "SamePassword1" }).success,
    false,
  );
});

test("temporary passwords satisfy the application policy", () => {
  for (let index = 0; index < 100; index++) {
    const password = createTemporaryPassword();
    assert.ok(password.length >= PASSWORD_MIN_LENGTH);
    assert.match(password, /[A-Za-z]/);
    assert.match(password, /\d/);
    assert.match(password, /[!@#$%]/);
  }
});
