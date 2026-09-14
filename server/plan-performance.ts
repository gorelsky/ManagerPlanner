const EARLIEST_ALLOWED_WEEK = new Date(2020, 0, 1);

export function getLatestAllowedPlanWeek(referenceDate = new Date()): Date {
  return new Date(
    referenceDate.getFullYear() + 2,
    referenceDate.getMonth(),
    referenceDate.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function parsePlanPerformanceWeek(
  rawValue: string,
  referenceDate = new Date(),
): Date {
  const value = rawValue.trim();
  const russianDateMatch = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+.*)?$/.exec(value);
  const excelSerialDate =
    /^\d+(\.\d+)?$/.test(value) && Number(value) > 20_000
      ? new Date(Date.UTC(1899, 11, 30) + Number(value) * 86_400_000)
      : undefined;
  const weekStart = russianDateMatch
    ? new Date(
        Number(russianDateMatch[3]),
        Number(russianDateMatch[2]) - 1,
        Number(russianDateMatch[1]),
      )
    : excelSerialDate ?? new Date(value);

  if (Number.isNaN(weekStart.getTime())) {
    throw new Error(`некорректная дата "${rawValue}"`);
  }

  const latestAllowedWeek = getLatestAllowedPlanWeek(referenceDate);
  if (weekStart < EARLIEST_ALLOWED_WEEK || weekStart > latestAllowedWeek) {
    throw new Error(
      `дата "${rawValue}" вне допустимого периода 2020–${latestAllowedWeek.getFullYear()}`,
    );
  }

  return weekStart;
}
