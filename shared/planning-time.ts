// A plan keeps its real instant for completion checks, but is displayed in the
// time zone in which it was entered, never in the viewer's time zone.
export function planningParts(value: Date | string, timeZone?: string | null): number[] {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return ["year", "month", "day", "hour", "minute", "second"].map(key => Number(parts.find(p => p.type === key)!.value));
}

export function planningDate(value: Date | string, timeZone?: string | null): Date {
  const [y, m, d, h, min, s] = planningParts(value, timeZone);
  // Local Date is only a display/calendar adapter, not an instant to persist.
  return new Date(y, m - 1, d, h, min, s, new Date(value).getUTCMilliseconds());
}

export function planningExcelDate(value: Date | string, timeZone?: string | null): Date {
  const [y, m, d, h, min, s] = planningParts(value, timeZone);
  return new Date(Date.UTC(y, m - 1, d, h, min, s, new Date(value).getUTCMilliseconds()));
}

// Calendar filters describe dates selected on screen, not absolute instants.
export function planningBoundary(value: Date | string): string {
  const date = new Date(value);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds())).toISOString();
}

export function planningInstant(date: Date, time: string, timeZone: string): Date {
  const [h, min] = time.split(":").map(Number);
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), h, min);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const [y, m, d, hh, mm, ss] = planningParts(new Date(instant), timeZone);
    const difference = target - Date.UTC(y, m - 1, d, hh, mm, ss);
    if (!difference) return new Date(instant);
    instant += difference;
  }
  throw new Error("Выбранное время не существует в часовом поясе плана");
}
