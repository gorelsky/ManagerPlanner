import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import type { ActivityWithDetails } from "@shared/schema";
import { createPlanReportWorkbook } from "./plan-report-xlsx";

const activities = [
  {
    id: "activity-1",
    userId: "manager-1",
    typeId: "type-1",
    cityId: "city-1",
    employeeId: "employee-1",
    title: "Совместный визит",
    description: "Визит в аптечную сеть и встреча с медицинским представителем",
    startDate: new Date("2026-09-08T07:00:00.000Z"),
    endDate: new Date("2026-09-08T15:00:00.000Z"),
    status: "completed",
    approvalStatus: "approved",
    reviewedBy: null,
    reviewedAt: null,
    completedAt: new Date("2026-09-08T15:00:00.000Z"),
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-08T15:00:00.000Z"),
    managerName: "Иванова Мария Петровна",
    type: { id: "type-1", name: "Совместный визит", requiresEmployee: true, visitEquivalent: "1.0" },
    city: { id: "city-1", name: "Москва", region: "Москва" },
    employee: {
      id: "employee-1",
      firstName: "Анна",
      lastName: "Смирнова",
      middleName: "Олеговна",
      managerId: "manager-1",
      cityId: "city-1",
      profileImage: null,
      position: "Медицинский представитель",
      phone: null,
      email: null,
      isOnMaternityLeave: false,
    },
  },
] as unknown as ActivityWithDetails[];

test("создаёт оформленный и подготовленный к печати XLSX-отчёт", async () => {
  const workbook = await createPlanReportWorkbook(activities, {
    periodLabel: "сентябрь 2026",
    generatedAt: new Date("2026-09-08T12:00:00.000Z"),
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(buffer);

  const sheet = restored.getWorksheet("Планы ТМ");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "ОТЧЁТ ПО ПЛАНАМ ТМ");
  assert.equal(sheet.getCell("A5").value, "№");
  assert.equal(sheet.getCell("D6").value, "Иванова Мария Петровна");
  assert.equal(sheet.getCell("G6").value, "Выполнено");
  assert.equal(sheet.getCell("H6").value, "Утверждён");
  assert.equal(sheet.pageSetup.orientation, "landscape");
  assert.equal(sheet.pageSetup.fitToWidth, 1);
  assert.equal(sheet.pageSetup.printArea, "A1:K6");
  assert.equal(sheet.pageSetup.printTitlesRow, "5:5");
  assert.equal(sheet.autoFilter, "A5:K6");
  assert.equal(sheet.views[0]?.state, "frozen");
  assert.equal(sheet.getCell("H6").fill.type, "pattern");
});
