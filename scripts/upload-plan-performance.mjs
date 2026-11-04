import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const [sourcePath, apiUrl, importToken] = process.argv.slice(2);
const filePath = sourcePath?.toLowerCase().endsWith(".xlsx")
  ? sourcePath
  : path.join(sourcePath || "", "plan-performance.xlsx");

if (!sourcePath || !apiUrl || !importToken) {
  throw new Error("Usage: node upload-plan-performance.mjs <xlsx-file-or-folder> <api-url> <token>");
}

const normalize = value => String(value ?? "")
  .replace(/\u00a0/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const normalizeRegion = value => {
  let region = normalize(value)
    .replace(/["'«».,]/g, "")
    .replace(/\b(регион|федеральный округ|фо)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const aliases = new Map([
    ["цфо", "центральный"],
    ["юфо", "южный"],
    ["сибирь", "сибирский"],
    ["сибирский федеральный", "сибирский"],
  ]);
  if (region.includes("цфо") || region.includes("центральн")) return "центральный";
  if (region.includes("юфо") || region.includes("южн")) return "южный";
  if (region.includes("сибир")) return "сибирский";
  if (region.includes("поволж")) return "поволжский";
  return aliases.get(region) || region;
};

const escapeCsv = value => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const parseAmount = value => {
  const parsed = Number(String(value ?? "")
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/[₽$€]/g, "")
    .replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Некорректная сумма (ожидается число не меньше нуля): "${value ?? ""}"`);
  return parsed.toFixed(2);
};

const findHeaderRow = rows => rows.findIndex(row => {
  const headers = row.map(normalize);
  return (
    headers.some(value => /^план q[1-4] \d{4}$/.test(value))
      && headers.some(value => /^факт q[1-4] \d{4}$/.test(value))
  ) || (
    headers.some(value => value.startsWith("план текущего кв"))
      && headers.some(value => value.startsWith("факт текущего кв"))
  );
});

const parseQuarterPeriod = value => {
  const match = /^q([1-4])\s+(\d{2}|\d{4})$/i.exec(String(value ?? "").trim());
  if (!match) return undefined;
  const year = Number(match[2].length === 2 ? `20${match[2]}` : match[2]);
  return { quarter: Number(match[1]), year, key: year * 10 + Number(match[1]) };
};

const formatExcelDate = value => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${value.getFullYear()}`;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 20_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + numeric * 86_400_000);
    return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
  }
  const text = String(value ?? "").trim();
  return text || undefined;
};

const mappingFromWorkbook = rows => {
  const mapping = new Map();
  const headerIndex = rows.findIndex(row => row.map(normalize).some(value =>
    ["email", "e-mail", "электронная почта"].includes(value),
  ));
  const headers = headerIndex >= 0 ? rows[headerIndex].map(normalize) : [];
  const emailIndex = headers.findIndex(value => ["email", "e-mail", "электронная почта"].includes(value));
  const regionIndex = headers.findIndex(value => value === "регион" || value === "region");
  const roleIndex = headers.findIndex(value => value === "роль" || value === "role");
  const weekStartIndex = headers.indexOf("weekstart");
  for (const row of rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0)) {
    // Доступ пользователей.xlsx: B=Email, C=Роль, D=Регион.
    const values = row.map(value => String(value ?? "").trim());
    const role = String(roleIndex >= 0 ? row[roleIndex] ?? "" : values[2] ?? "").trim();
    if (!/^тм$/i.test(role)) continue;
    const email = String(emailIndex >= 0 ? row[emailIndex] ?? "" : values[1] ?? "").trim();
    if (!email) continue;
    const region = String(regionIndex >= 0 ? row[regionIndex] ?? "" : values[3] ?? "").trim();
    if (!region) continue;
    const key = normalizeRegion(region);
    if (mapping.has(key)) {
      throw new Error(`Неоднозначное сопоставление региона "${region}": дублируется ключ "${key}" в книге доступа`);
    }
    mapping.set(key, {
      email,
      weekStart: weekStartIndex >= 0 ? formatExcelDate(row[weekStartIndex]) : undefined,
    });
  }
  return mapping;
};

const sourceWorkbook = XLSX.read(await fs.readFile(filePath), { cellDates: true, sheets: 0 });
const mappingCandidates = [
  process.env.PLAN_REGION_MAPPING_FILE,
  path.join(path.dirname(filePath), "Доступ пользователей.xlsx"),
  path.resolve(path.dirname(process.argv[1]), "..", "входные данные", "Доступ пользователей.xlsx"),
  path.resolve(path.dirname(process.argv[1]), "..", "Доступ пользователей.xlsx"),
].filter(Boolean);
const mappingPath = mappingCandidates.find(candidate => {
  try { return require("node:fs").existsSync(candidate); } catch { return false; }
}) || mappingCandidates[0];
let fileName = path.basename(filePath);
let file = await fs.readFile(filePath);

// The master workbook is a large reporting file. Detect the quarterly layout
// by its first-sheet headers (the file may be named "Доступ МП2.xlsx", etc.)
// and convert the newest quarter totals into the compact CSV contract.
const sourceSheet = sourceWorkbook.Sheets[sourceWorkbook.SheetNames[0]];
const sourceRows = sourceSheet
  ? XLSX.utils.sheet_to_json(sourceSheet, { header: 1, defval: "" })
  : [];
if (findHeaderRow(sourceRows) >= 0) {
  let mappingBuffer;
  try {
    mappingBuffer = await fs.readFile(mappingPath);
  } catch {
    throw new Error(`Не найден файл сопоставления регионов и email: ${mappingPath}`);
  }
  const mappingWorkbook = XLSX.read(mappingBuffer, { cellDates: true });
  const mappingRows = mappingWorkbook.SheetNames
    .flatMap(sheetName => XLSX.utils.sheet_to_json(mappingWorkbook.Sheets[sheetName], { header: 1, defval: "" }));
  const regionToEmail = mappingFromWorkbook(mappingRows);
  if (regionToEmail.size === 0) throw new Error("В книге сопоставления не найдены пользователи с ролью ТМ и регионом");
  if (!sourceSheet) throw new Error('В файле отсутствует лист "План-факт тотал в рублях"');
  const rows = sourceRows;
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) throw new Error("Не найдены парные квартальные колонки План Qn YYYY и Факт Qn YYYY");
  const headers = rows[headerIndex].map(normalize);
  const periodIndex = headers.findIndex(value => value === "период");
  const newFormat = headers.some(value => value.startsWith("план текущего кв"));
  let selectedQuarter;
  let planIndex;
  let actualIndex;
  let selectedPeriod;
  if (newFormat) {
    planIndex = headers.findIndex(value => value.startsWith("план текущего кв"));
    actualIndex = headers.findIndex(value => value.startsWith("факт текущего кв"));
    const periods = rows.slice(headerIndex + 1)
      .map(row => parseQuarterPeriod(row[periodIndex]))
      .filter(Boolean)
      .sort((a, b) => b.key - a.key);
    selectedQuarter = periods[0];
    selectedPeriod = rows.slice(headerIndex + 1).find(row => parseQuarterPeriod(row[periodIndex])?.key === selectedQuarter?.key)?.[periodIndex];
  } else {
    const quarterColumns = new Map();
    headers.forEach((value, index) => {
      const match = /^(план|факт) q([1-4]) (\d{4})$/.exec(value);
      if (!match) return;
      const key = `${match[3]}-${match[2]}`;
      const entry = quarterColumns.get(key) || { quarter: Number(match[2]), year: Number(match[3]) };
      entry[match[1] === "план" ? "planIndex" : "actualIndex"] = index;
      quarterColumns.set(key, entry);
    });
    selectedQuarter = [...quarterColumns.values()]
      .filter(entry => Number.isInteger(entry.planIndex) && Number.isInteger(entry.actualIndex))
      .sort((a, b) => (b.year * 10 + b.quarter) - (a.year * 10 + a.quarter))[0];
    planIndex = selectedQuarter?.planIndex;
    actualIndex = selectedQuarter?.actualIndex;
    // In the report the displayed pair is Plan immediately followed by Fact.
    // Prefer the adjacent Fact column when several repeated quarter columns
    // exist in the workbook.
    if (Number.isInteger(planIndex) && selectedQuarter && planIndex + 1 < headers.length) {
      // The report's visible regional totals are laid out as Plan, Fact, %.
      // The Fact header is merged in Excel and may be blank in the cell grid.
      const adjacent = headers[planIndex + 1];
      if (!adjacent || /^факт q[1-4] \d{4}$/.test(adjacent)) actualIndex = planIndex + 1;
    }
  }
  if (!selectedQuarter || !Number.isInteger(planIndex) || !Number.isInteger(actualIndex)) {
    throw new Error("Не найдены парные колонки плана и факта для одного квартала");
  }
  const { quarter, year } = selectedQuarter;
  const now = new Date();
  const currentKey = now.getFullYear() * 10 + Math.floor(now.getMonth() / 3) + 1;
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const previousKey = previousDate.getFullYear() * 10 + Math.floor(previousDate.getMonth() / 3) + 1;
  const selectedKey = year * 10 + quarter;
  if (process.env.PLAN_ALLOW_HISTORICAL_IMPORT !== "1" && selectedKey < previousKey) {
    throw new Error(`Книга содержит только устаревший квартал Q${quarter} ${year}; текущий период Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}. Для осознанной исторической загрузки задайте PLAN_ALLOW_HISTORICAL_IMPORT=1.`);
  }
  if (selectedKey > currentKey) throw new Error(`Книга содержит будущий квартал Q${quarter} ${year}; импорт отменён`);
  console.log(`Selected quarter Q${quarter} ${year}: plan="${headers[planIndex]}", fact="${headers[actualIndex]}"`);
  const regionIndex = newFormat ? headers.findIndex(value => value === "регион рф") : 0;
  const quarterStartMonth = (quarter - 1) * 3 + 1;
  const quarterStart = `01.${String(quarterStartMonth).padStart(2, "0")}.${year}`;
  const output = ["managerEmail,region,weekStart,planAmount,actualAmount"];
  const missingRegions = [];
  const preparedRegionKeys = new Set();
  for (const row of rows.slice(headerIndex + 1)) {
    if (newFormat && parseQuarterPeriod(row[periodIndex])?.key !== selectedQuarter.key) continue;
    const rawRegion = String(row[regionIndex] ?? "").trim();
    if (!/итог(?:о)?\s*$/i.test(rawRegion) || /общий итог/i.test(rawRegion)) continue;
    const region = rawRegion.replace(/\s+итог(?:о)?\s*$/i, "").trim();
    const sourceRegionKey = normalizeRegion(region);
    const mapping = regionToEmail.get(sourceRegionKey);
    if (!mapping) {
      missingRegions.push(region);
      continue;
    }
    if (preparedRegionKeys.has(sourceRegionKey)) {
      throw new Error(`Регион "${region}" встречается в выбранном квартале несколько раз; импорт отменён`);
    }
    preparedRegionKeys.add(sourceRegionKey);
    console.log(`Prepared region ${region}: plan=${row[planIndex]} fact=${row[actualIndex]}`);
    const mappingDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(mapping.weekStart || "");
    const mappingMatchesQuarter = mappingDate
      && Number(mappingDate[3]) === year
      && Math.ceil(Number(mappingDate[2]) / 3) === quarter;
    const weekStart = mappingMatchesQuarter ? mapping.weekStart : quarterStart;
    output.push([
      mapping.email,
      region,
      weekStart,
      parseAmount(row[planIndex]),
      parseAmount(row[actualIndex]),
    ].map(escapeCsv).join(","));
  }
  if (missingRegions.length) throw new Error(`Не найдены точные сопоставления регионам: ${[...new Set(missingRegions)].join(", ")}`);
  if (output.length === 1) throw new Error("В листе не найдены строки регионов с итогами");
  fileName = `plan-performance-q${quarter}-${year}.csv`;
  file = Buffer.from(output.join("\n"), "utf8");
  console.log(`Prepared ${output.length - 1} regional Q${quarter} ${year} rows from ${path.basename(filePath)}`);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);
let response;
try {
  response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/plan-performance/import-file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Plan-Import-Token": importToken.trim(),
    },
    body: JSON.stringify({
      fileName,
      fileBase64: file.toString("base64"),
      allowReplace: process.env.PLAN_IMPORT_ALLOW_REPLACE === "1",
    }),
    signal: controller.signal,
  });
} catch (error) {
  if (error?.name === "AbortError") {
    throw new Error(`Сервер импорта не ответил за 30 секунд: ${apiUrl}`);
  }
  throw new Error(`Не удалось подключиться к серверу импорта ${apiUrl}: ${error?.message || error}`);
} finally {
  clearTimeout(timeout);
}

const body = await response.text();
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${body}`);
}

let result;
try {
  result = JSON.parse(body);
} catch {
  throw new Error(`Некорректный ответ сервера: ${body.slice(0, 500)}`);
}

console.log(`Imported file ${result.fileName}: ${result.imported} rows`);
