import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi, employeeApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import type { ActivityWithDetails } from "@shared/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

const MONTH_NAMES_GEN = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря",
];

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end   = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Возвращает понедельник недели, в которую попадает date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=вс
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekRange(weekStart: Date) {
  const start = new Date(weekStart);
  const end   = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const sDay = weekStart.getDate();
  const eDay = end.getDate();
  const sMon = MONTH_NAMES_GEN[weekStart.getMonth()];
  const eMon = MONTH_NAMES_GEN[end.getMonth()];
  const yr   = end.getFullYear();
  if (weekStart.getMonth() === end.getMonth()) {
    return `${sDay}–${eDay} ${sMon} ${yr}`;
  }
  return `${sDay} ${sMon} – ${eDay} ${eMon} ${yr}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { user } = useAuth();

  const [period, setPeriod]       = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  if (user?.role !== "admin" && user?.role !== "director") {
    return (
      <div className="p-4 pb-20">
        <p>Доступ к отчётам есть только у администратора и директора.</p>
        <BottomNavigation />
      </div>
    );
  }

  const { data: allActivities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/activities/all"],
    queryFn: () => activityApi.getAllActivities(),
  });

  const { isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees/all"],
    queryFn: () => employeeApi.getAllEmployees(),
  });

  // ── Диапазон и фильтрация ──
  const range = period === "month"
    ? getMonthRange(currentDate)
    : getWeekRange(weekStart);

  const activitiesInRange: ActivityWithDetails[] = allActivities.filter((a) => {
    const activityStart = new Date(a.startDate);
    const activityEnd = new Date(a.endDate);
    return activityStart <= range.end && activityEnd >= range.start;
  });

  // ── По менеджерам ──
  type ManagerStat = { managerName: string; count: number; cities: Set<string>; employees: Set<string> };
  const managersStats = activitiesInRange.reduce<Record<string, ManagerStat>>((acc, a) => {
    const key = a.managerName || "Не указан";
    if (!acc[key]) acc[key] = { managerName: key, count: 0, cities: new Set(), employees: new Set() };
    acc[key].count += 1;
    if (a.city?.name)   acc[key].cities.add(a.city.name);
    if (a.employeeId)   acc[key].employees.add(a.employeeId);
    return acc;
  }, {});
  const managersArray = Object.values(managersStats).sort((a, b) => b.count - a.count);

  // ── По типам ──
  type TypeStat = { typeName: string; count: number; managers: Set<string> };
  const typesStats = activitiesInRange.reduce<Record<string, TypeStat>>((acc, a) => {
    const key = a.type?.name || "Не указан";
    if (!acc[key]) acc[key] = { typeName: key, count: 0, managers: new Set() };
    acc[key].count += 1;
    if (a.managerName) acc[key].managers.add(a.managerName);
    return acc;
  }, {});
  const typesArray = Object.values(typesStats).sort((a, b) => b.count - a.count);

  // ── По городам ──
  type CityStat = { cityName: string; count: number; managers: Set<string> };
  const citiesStats = activitiesInRange.reduce<Record<string, CityStat>>((acc, a) => {
    const key = a.city?.name || "Не указан";
    if (!acc[key]) acc[key] = { cityName: key, count: 0, managers: new Set() };
    acc[key].count += 1;
    if (a.managerName) acc[key].managers.add(a.managerName);
    return acc;
  }, {});
  const citiesArray = Object.values(citiesStats).sort((a, b) => b.count - a.count);

  const isLoading = activitiesLoading || employeesLoading;

  // ── Навигация ──
  function prevPeriod() {
    if (period === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else {
      setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
    }
  }
  function nextPeriod() {
    if (period === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else {
      setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });
    }
  }

  const periodLabel = period === "month"
    ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : formatWeekLabel(weekStart);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <SideMenu />
        <h1 className="text-lg font-semibold">Отчёты</h1>
        <div className="w-8" />
      </header>

      <div className="p-4 pb-24">

        {/* Переключатель Месяц / Неделя */}
        <div className="flex bg-muted rounded-lg p-1 mb-5">
          <button
            onClick={() => setPeriod("month")}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${
              period === "month" ? "bg-background shadow text-foreground" : "text-muted-foreground"
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod("week")}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${
              period === "week" ? "bg-background shadow text-foreground" : "text-muted-foreground"
            }`}
          >
            Неделя
          </button>
        </div>

        {/* Навигатор периода */}
        <div className="flex items-center justify-center gap-4 mb-5">
          <button
            onClick={prevPeriod}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xl"
          >
            ‹
          </button>
          <span className="text-sm font-semibold min-w-[180px] text-center">{periodLabel}</span>
          <button
            onClick={nextPeriod}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-xl"
          >
            ›
          </button>
        </div>

        {/* Сводные плашки */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="flex-1 min-w-[100px] bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{activitiesInRange.length}</div>
            <div className="text-xs text-blue-500 mt-0.5">Активностей</div>
          </div>
          <div className="flex-1 min-w-[100px] bg-emerald-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{managersArray.length}</div>
            <div className="text-xs text-emerald-500 mt-0.5">Менеджеров</div>
          </div>
          <div className="flex-1 min-w-[100px] bg-violet-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-violet-600">{citiesArray.length}</div>
            <div className="text-xs text-violet-500 mt-0.5">Городов</div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="managers">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="managers" className="flex-1 text-xs">По менеджерам</TabsTrigger>
            <TabsTrigger value="types"    className="flex-1 text-xs">По типам</TabsTrigger>
            <TabsTrigger value="cities"   className="flex-1 text-xs">По городам</TabsTrigger>
          </TabsList>

          {/* ── По менеджерам ── */}
          <TabsContent value="managers">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Активность менеджеров
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Загрузка...</div>
                ) : managersArray.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    За выбранный период нет активностей.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-left py-2 pr-3 font-medium">Менеджер</th>
                          <th className="text-center py-2 pr-3 font-medium">Актив.</th>
                          <th className="text-center py-2 pr-3 font-medium">Городов</th>
                          <th className="text-center py-2 font-medium">МП</th>
                        </tr>
                      </thead>
                      <tbody>
                        {managersArray.map((stat) => (
                          <tr key={stat.managerName} className="border-b last:border-b-0 hover:bg-muted/30">
                            <td className="py-2 pr-3 font-medium">{stat.managerName}</td>
                            <td className="py-2 pr-3 text-center">
                              <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                                {stat.count}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-center text-muted-foreground text-xs">
                              {stat.cities.size || "—"}
                            </td>
                            <td className="py-2 text-center text-muted-foreground text-xs">
                              {stat.employees.size || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── По типам ── */}
          <TabsContent value="types">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Активности по типам
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Загрузка...</div>
                ) : typesArray.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    За выбранный период нет активностей.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {typesArray.map((stat) => {
                      const pct = activitiesInRange.length
                        ? Math.round((stat.count / activitiesInRange.length) * 100)
                        : 0;
                      return (
                        <div key={stat.typeName}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium truncate pr-2">{stat.typeName}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground text-xs">{stat.managers.size} мен.</span>
                              <span className="inline-block bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 text-xs font-semibold min-w-[32px] text-center">
                                {stat.count}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── По городам ── */}
          <TabsContent value="cities">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Активности по городам
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Загрузка...</div>
                ) : citiesArray.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    За выбранный период нет активностей.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {citiesArray.map((stat) => {
                      const pct = activitiesInRange.length
                        ? Math.round((stat.count / activitiesInRange.length) * 100)
                        : 0;
                      return (
                        <div key={stat.cityName}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium truncate pr-2">{stat.cityName}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground text-xs">{stat.managers.size} мен.</span>
                              <span className="inline-block bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 text-xs font-semibold min-w-[32px] text-center">
                                {stat.count}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNavigation />
    </div>
  );
}
