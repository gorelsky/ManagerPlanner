import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import XLSX from 'xlsx';

const root = await mkdtemp(path.join(os.tmpdir(), 'managerplanner-import-'));
const source = path.join(root, 'source.xlsx');
const mapping = path.join(root, 'mapping.xlsx');
function workbook(file, rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  XLSX.writeFile(wb, file);
}
function sourceRows(regions = ['Центральный регион Итого'], quarter = 4) {
  return [['Регион РФ', `План Q${quarter} 2026`, `Факт Q${quarter} 2026`], ...regions.map((r, i) => [r, 100 + i, 50 + i])];
}
workbook(mapping, [['Email', 'Роль', 'Регион'], ['manager@example.test', 'ТМ', 'Центральный']]);
let payload;
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  payload = JSON.parse(Buffer.concat(chunks).toString());
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ imported: 1, fileName: payload.fileName }));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}`;
async function run(regions, extraEnv = {}, quarter = 4) {
  workbook(source, sourceRows(regions, quarter));
  payload = undefined;
  const child = spawn(process.execPath, ['scripts/upload-plan-performance.mjs', source, url, 'synthetic-token'], {
    cwd: process.cwd(),
    env: { ...process.env, PLAN_REGION_MAPPING_FILE: mapping, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => stdout += b);
  child.stderr.on('data', b => stderr += b);
  const [code] = await once(child, 'close');
  return { code, stdout, stderr };
}
try {
  const valid = await run(['Центральный регион Итого']);
  assert.equal(valid.code, 0, valid.stderr);
  assert.equal(payload.fileName, 'plan-performance-q4-2026.csv');
  assert.equal(payload.allowReplace, false);
  assert.match(Buffer.from(payload.fileBase64, 'base64').toString(), /manager@example\.test,Центральный регион,01\.10\.2026,100\.00,50\.00/);

  workbook(mapping, [['Email', 'Роль', 'Регион'], ['one@example.test', 'ТМ', 'Центральный'], ['two@example.test', 'ТМ', 'ЦФО']]);
  const ambiguousMapping = await run(['Центральный регион Итого']);
  assert.notEqual(ambiguousMapping.code, 0);
  assert.match(ambiguousMapping.stderr, /Неоднозначное сопоставление региона/);
  assert.equal(payload, undefined);
  workbook(mapping, [['Email', 'Роль', 'Регион'], ['manager@example.test', 'ТМ', 'Центральный']]);

  const duplicate = await run(['Центральный регион Итого', 'ЦФО Итого']);
  assert.notEqual(duplicate.code, 0);
  assert.match(duplicate.stderr, /несколько раз/);
  assert.equal(payload, undefined);

  const unknown = await run(['Северный регион Итого']);
  assert.notEqual(unknown.code, 0);
  assert.match(unknown.stderr, /точные сопоставления/);
  assert.equal(payload, undefined);

  const oldPeriod = await run(['Центральный регион Итого'], {}, 2);
  assert.notEqual(oldPeriod.code, 0);
  assert.match(oldPeriod.stderr, /устаревший квартал/);
  assert.equal(payload, undefined);

  const deliberateHistory = await run(['Центральный регион Итого'], { PLAN_ALLOW_HISTORICAL_IMPORT: '1' }, 2);
  assert.equal(deliberateHistory.code, 0, deliberateHistory.stderr);
  assert.equal(payload.fileName, 'plan-performance-q2-2026.csv');
  assert.equal(payload.allowReplace, false);

  await run(['Центральный регион Итого'], { PLAN_IMPORT_ALLOW_REPLACE: '1' });
  assert.equal(payload.allowReplace, true);
  console.log('Synthetic Excel import checks passed (valid, duplicate region, unmapped region).');
} finally {
  server.close();
  await rm(root, { recursive: true, force: true });
}
