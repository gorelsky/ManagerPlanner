import "dotenv/config";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcrypt";
import { pool } from "../server/db";
import { runDatabaseMigrations } from "../server/migrations";
import { createTemporaryPassword } from "../server/passwords";

type UserRow = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: string;
};

type TemporaryAccess = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  temporaryPassword: string;
};

const APP_URL = "https://sls-planner.ru/";

function argumentValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function csvValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildCsv(records: TemporaryAccess[]): string {
  const rows = ["ФИО;Логин;Временный пароль;Роль"];
  for (const record of records) {
    rows.push(
      [record.fullName, record.email, record.temporaryPassword, record.role]
        .map(csvValue)
        .join(";"),
    );
  }
  return `\uFEFF${rows.join("\r\n")}\r\n`;
}

function buildLetters(records: TemporaryAccess[]): string {
  const sections = records.map(
    (record) => `## ${record.fullName}

Кому: ${record.email}
Тема: Доступ к приложению «Планирование ТМ»

Здравствуйте, ${record.fullName}!

Новое приложение «Планирование ТМ» готово к работе.

Ссылка для входа: ${APP_URL}
Логин: ${record.email}
Временный пароль: ${record.temporaryPassword}

При первом входе приложение попросит обязательно заменить временный пароль на личный. Новый пароль должен содержать не менее 10 символов, хотя бы одну букву и одну цифру. Не пересылайте временный или новый пароль другим людям.

Если возникнут сложности со входом, пожалуйста, сообщите администратору.

С уважением,
Администратор приложения «Планирование ТМ»
`,
  );

  return `# Персональные письма для рассылки

Сформировано: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} (Москва)

${sections.join("\n---\n\n")}`;
}

async function main() {
  if (!process.argv.includes("--apply")) {
    throw new Error(
      "Команда не выполнена: добавьте --apply, чтобы подтвердить смену паролей пользователей.",
    );
  }

  const outputDirectory = path.resolve(argumentValue("--output") || ".local/temporary-access");
  const csvPath = path.join(outputDirectory, "temporary-passwords.csv");
  const lettersPath = path.join(outputDirectory, "mailing-letters.md");
  const client = await pool.connect();
  let filesCreated = false;

  try {
    await runDatabaseMigrations();
    await client.query("BEGIN");

    const result = await client.query<UserRow>(`
      SELECT id, username, first_name, last_name, middle_name, role
      FROM users
      WHERE role <> 'admin'
      ORDER BY last_name, first_name, middle_name, username
      FOR UPDATE
    `);

    if (result.rows.length === 0) {
      throw new Error("Пользователи для рассылки не найдены.");
    }

    const records: TemporaryAccess[] = [];
    for (const user of result.rows) {
      const temporaryPassword = createTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      const updateResult = await client.query(
        `UPDATE users
         SET password = $1, must_change_password = true
         WHERE id = $2`,
        [passwordHash, user.id],
      );
      if (updateResult.rowCount !== 1) {
        throw new Error(`Не удалось обновить пользователя ${user.id}`);
      }

      records.push({
        id: user.id,
        email: user.username,
        fullName: [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" "),
        role: user.role,
        temporaryPassword,
      });
    }

    await mkdir(outputDirectory, { recursive: true });
    await writeFile(csvPath, buildCsv(records), { encoding: "utf8", mode: 0o600 });
    await writeFile(lettersPath, buildLetters(records), { encoding: "utf8", mode: 0o600 });
    filesCreated = true;

    const verification = await client.query<{
      id: string;
      password: string;
      must_change_password: boolean;
    }>(
      `SELECT id, password, must_change_password
       FROM users
       WHERE id = ANY($1::varchar[])`,
      [records.map((record) => record.id)],
    );
    const verificationById = new Map(verification.rows.map((row) => [row.id, row]));
    for (const record of records) {
      const storedUser = verificationById.get(record.id);
      if (
        !storedUser?.must_change_password ||
        !(await bcrypt.compare(record.temporaryPassword, storedUser.password))
      ) {
        throw new Error(`Проверка временного пароля не пройдена для пользователя ${record.id}`);
      }
    }

    await client.query("COMMIT");
    console.log(`Временные пароли установлены для пользователей: ${records.length}`);
    console.log(`Список доступов: ${csvPath}`);
    console.log(`Письма для рассылки: ${lettersPath}`);
    console.log("Администраторы исключены из операции.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (filesCreated) {
      await Promise.all([
        rm(csvPath, { force: true }),
        rm(lettersPath, { force: true }),
      ]).catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Неизвестная ошибка");
  process.exitCode = 1;
});
