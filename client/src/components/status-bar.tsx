import { useEffect, useMemo, useState } from "react";

export function StatusBar() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formattedTime = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(currentTime),
    [currentTime],
  );

  return (
    <div className="flex justify-between items-center px-4 py-2 text-white text-sm bg-blue-header">
      <span>{formattedTime}</span>
      <div className="flex space-x-1">
        <div className="w-4 h-3 bg-white/60 rounded-sm" />
        <div className="w-4 h-3 bg-white/60 rounded-sm" />
        <div className="w-4 h-3 bg-white rounded-sm" />
      </div>
    </div>
  );
}