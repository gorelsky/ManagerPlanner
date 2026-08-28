import { useEffect, useState } from "react";

export const StatusBar: React.FC = () => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

 const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const rawDate = dateFormatter.format(now);
const dateString = rawDate
  .replace(" г.", "")
  .replace(".", "")
  .replace(" ", ".");

const timeString = now.toLocaleTimeString("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

return (
  <div className="w-full px-4 py-1.5 flex items-center justify-end gap-3 bg-gradient-to-r from-[#160b72] to-[#2514b7] text-white/90 text-xs font-medium tracking-wide">
    <span>{dateString}</span>
    <span>{timeString}</span>
  </div>
);
};
