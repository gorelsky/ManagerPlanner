import type { ActivityWithDetails, ApprovalStatus } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  in_progress: "В процессе",
  completed: "Выполнено",
  cancelled: "Отменено",
  rescheduled: "Перенесено",
};

const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  created: "Создан",
  approved: "Утверждён",
  rejected: "Отклонён",
};

const COLORS = {
  brand: "384C8B",
  brandDark: "263765",
  brandLight: "E9EDF8",
  white: "FFFFFF",
  text: "1F2937",
  muted: "64748B",
  border: "CBD5E1",
  stripe: "F8FAFC",
  green: "DCFCE7",
  greenText: "166534",
  amber: "FEF3C7",
  amberText: "92400E",
  red: "FEE2E2",
  redText: "991B1B",
  blue: "DBEAFE",
  blueText: "1E40AF",
};

export type PlanReportOptions = {
  periodLabel: string;
  generatedAt?: Date;
};

function safeText(value: string | null | undefined): string {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function formatPersonName(person?: {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
}): string {
  if (!person) return "—";
  return (
    [person.lastName, person.firstName, person.middleName]
      .filter(Boolean)
      .join(" ") || "—"
  );
}

function safeDate(value: Date | string): Date | string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safeText(String(value)) : date;
}

export async function createPlanReportWorkbook(
  activities: ActivityWithDetails[],
  options: PlanReportOptions,
) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Планирование ТМ";
  workbook.created = options.generatedAt ?? new Date();
  workbook.modified = options.generatedAt ?? new Date();
  workbook.subject = "Отчёт по планам территориальных менеджеров";
  workbook.title = `Планы ТМ — ${options.periodLabel}`;

  const sheet = workbook.addWorksheet("Планы ТМ", {
    properties: { defaultRowHeight: 18 },
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ state: "frozen", ySplit: 5, activeCell: "A6", showGridLines: false }],
  });

  sheet.columns = [
    { key: "number", width: 6 },
    { key: "startDate", width: 18 },
    { key: "endDate", width: 18 },
    { key: "manager", width: 27 },
    { key: "type", width: 22 },
    { key: "city", width: 20 },
    { key: "status", width: 18 },
    { key: "approval", width: 17 },
    { key: "employee", width: 27 },
    { key: "title", width: 30 },
    { key: "description", width: 42 },
  ];

  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "ОТЧЁТ ПО ПЛАНАМ ТМ";
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandDark } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells("A2:K2");
  const periodCell = sheet.getCell("A2");
  periodCell.value = `Период: ${safeText(options.periodLabel)}`;
  periodCell.font = { name: "Arial", size: 11, bold: true, color: { argb: COLORS.brandDark } };
  periodCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandLight } };
  periodCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 22;

  sheet.mergeCells("A3:K3");
  const metaCell = sheet.getCell("A3");
  const generatedAt = options.generatedAt ?? new Date();
  metaCell.value = `Количество планов: ${activities.length}    •    Сформировано: ${generatedAt.toLocaleString("ru-RU")}`;
  metaCell.font = { name: "Arial", size: 9, color: { argb: COLORS.muted } };
  metaCell.alignment = { horizontal: "right", vertical: "middle" };

  const headerRowNumber = 5;
  const headerRow = sheet.getRow(headerRowNumber);
  headerRow.values = [
    "№",
    "Дата начала",
    "Дата окончания",
    "Менеджер",
    "Тип плана",
    "Город",
    "Статус",
    "Согласование",
    "Медицинский представитель",
    "Название",
    "Описание",
  ];
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.white } },
      left: { style: "thin", color: { argb: COLORS.white } },
      bottom: { style: "thin", color: { argb: COLORS.white } },
      right: { style: "thin", color: { argb: COLORS.white } },
    };
  });

  activities.forEach((activity, index) => {
    const row = sheet.addRow({
      number: index + 1,
      startDate: safeDate(activity.startDate),
      endDate: safeDate(activity.endDate),
      manager: safeText(activity.managerName || "—"),
      type: safeText(activity.type?.name || "—"),
      city: safeText(activity.city?.name || "—"),
      status: STATUS_LABELS[activity.status] || safeText(activity.status),
      approval: APPROVAL_LABELS[activity.approvalStatus || "created"],
      employee: safeText(formatPersonName(activity.employee)),
      title: safeText(activity.title),
      description: safeText(activity.description || ""),
    });

    row.height = 34;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 9, color: { argb: COLORS.text } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "hair", color: { argb: COLORS.border } },
        left: { style: "hair", color: { argb: COLORS.border } },
        bottom: { style: "hair", color: { argb: COLORS.border } },
        right: { style: "hair", color: { argb: COLORS.border } },
      };
      if (index % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.stripe } };
      }
    });

    row.getCell("A").alignment = { horizontal: "center", vertical: "top" };
    for (const column of ["B", "C"]) {
      const cell = row.getCell(column);
      if (cell.value instanceof Date) cell.numFmt = "dd.mm.yyyy hh:mm";
      cell.alignment = { horizontal: "center", vertical: "top", wrapText: true };
    }

    const statusCell = row.getCell("G");
    const approvalCell = row.getCell("H");
    const statusPalette = activity.status === "completed"
      ? [COLORS.green, COLORS.greenText]
      : activity.status === "cancelled"
        ? [COLORS.red, COLORS.redText]
        : activity.status === "in_progress"
          ? [COLORS.amber, COLORS.amberText]
          : [COLORS.blue, COLORS.blueText];
    const approvalPalette = activity.approvalStatus === "approved"
      ? [COLORS.green, COLORS.greenText]
      : activity.approvalStatus === "rejected"
        ? [COLORS.red, COLORS.redText]
        : [COLORS.amber, COLORS.amberText];

    for (const [cell, palette] of [[statusCell, statusPalette], [approvalCell, approvalPalette]] as const) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette[0] } };
      cell.font = { name: "Arial", size: 9, bold: true, color: { argb: palette[1] } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
  });

  const lastRow = Math.max(headerRowNumber, sheet.rowCount);
  sheet.autoFilter = { from: `A${headerRowNumber}`, to: `K${lastRow}` };
  sheet.pageSetup.printArea = `A1:K${lastRow}`;
  sheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
  sheet.headerFooter.oddHeader = "&LПланирование ТМ&CОтчёт по планам&R&D";
  sheet.headerFooter.oddFooter = "&LВнутренний документ&CСтраница &P из &N&R&T";

  return workbook;
}

export async function downloadPlanReportXlsx(
  activities: ActivityWithDetails[],
  filename: string,
  options: PlanReportOptions,
): Promise<void> {
  const workbook = await createPlanReportWorkbook(activities, options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
