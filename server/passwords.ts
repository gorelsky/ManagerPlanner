import { randomInt } from "crypto";
import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль").max(128),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Новый пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`)
      .max(128, "Новый пароль слишком длинный")
      .regex(/[A-Za-zА-Яа-яЁё]/, "Добавьте в новый пароль хотя бы одну букву")
      .regex(/\d/, "Добавьте в новый пароль хотя бы одну цифру"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Новый пароль должен отличаться от текущего",
    path: ["newPassword"],
  });

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%";
const ALL_TEMPORARY_PASSWORD_CHARS = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

function randomCharacter(characters: string): string {
  return characters[randomInt(characters.length)];
}

export function createTemporaryPassword(length = 14): string {
  if (length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Temporary password must contain at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const characters = [
    randomCharacter(UPPERCASE),
    randomCharacter(LOWERCASE),
    randomCharacter(DIGITS),
    randomCharacter(SYMBOLS),
  ];

  while (characters.length < length) {
    characters.push(randomCharacter(ALL_TEMPORARY_PASSWORD_CHARS));
  }

  for (let index = characters.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}
