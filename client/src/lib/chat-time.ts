export function formatChatTime(value: string | null, senderTimeZone?: string | null): string {
  if (!value) return "Время не указано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Время недоступно";
  let timeZone = senderTimeZone || undefined;
  try { new Intl.DateTimeFormat("ru-RU", { timeZone }); }
  catch { timeZone = undefined; }
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    timeZone, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset",
  }).format(date);
  return `Отправлено ${formatted} · ${timeZone ? `время отправителя (${timeZone})` : "ваше местное время; пояс отправителя неизвестен"}`;
}
