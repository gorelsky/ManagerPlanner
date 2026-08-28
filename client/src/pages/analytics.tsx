import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import UserProfile from "@/components/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { activityApi, holidaysApi } from "@/lib/api";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
} from "date-fns";


type Period = "week" | "month" | "quarter";


export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  const { user } = useAuth();
  const canViewAllPlans =
    user?.role === "admin" ||
    user?.role === "director" ||
    user?.role === "hr_director";


  const getPeriodDates = (period: Period) => {
    const now = new Date();
    switch (period) {
      case "week":
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
    }
  };


  const { start, end } = getPeriodDates(selectedPeriod);


  // Для руководителей — общая аналитика, для менеджера — только собственная.
  const { data: activities = [] } = useQuery({
    queryKey: [
      canViewAllPlans ? "/api/activities/all" : "/api/activities/user",
      user?.id,
      start,
      end,
    ],
    queryFn: () => canViewAllPlans
      ? activityApi.getAllActivities(start, end)
      : activityApi.getActivitiesByUser(user!.id, {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
  });


  // Праздники для года начала периода
  const periodYear = start.getFullYear();
  const { data: holidays = [] } = useQuery({
    queryKey: ["/api/holidays", periodYear],
    queryFn: () =>
      holidaysApi.getHolidaysForYear(periodYear) as Promise<
        { date: string; name: string }[]
      >,
  });


  // Множество дат-праздников "YYYY-MM-DD"
  const holidayDates = new Set(
    holidays.map((h: any) =>
      new Date(h.date).toISOString().slice(0, 10),
    ),
  );


  // Статистика
  const totalActivities = activities.length;
  const completedActivities = activities.filter(
    (a) => a.status === "completed",
  ).length;
  const inProgressActivities = activities.filter(
    (a) => a.status === "in_progress",
  ).length;
  const cancelledActivities = activities.filter(
    (a) => a.status === "cancelled" || a.status === "rescheduled",
  ).length;


  const typeBreakdown = activities.reduce((acc, activity) => {
    const typeName = activity.type.name;
    acc[typeName] = (acc[typeName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);


  // Данные для графика
  const chartData = (() => {
    const days: {
      label: string;
      completed: number;
      isWeekend: boolean;
      isHoliday: boolean;
    }[] = [];


    const cursor = new Date(start);


    while (cursor <= end) {
      const dayKey = cursor.toISOString().slice(0, 10); // "YYYY-MM-DD"


      const completedForDay = activities.filter((a) => {
        const dateStr =
          a.startDate instanceof Date
            ? a.startDate.toISOString().slice(0, 10)
            : String(a.startDate).slice(0, 10);
        return a.status === "completed" && dateStr === dayKey;
      }).length;


      const dayOfWeek = cursor.getDay(); // 0 - воскресенье, 6 - суббота
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidayDates.has(dayKey);


      const day = cursor.getDate().toString().padStart(2, "0");
      const month = (cursor.getMonth() + 1).toString().padStart(2, "0");


      days.push({
        label: `${day}.${month}`,
        completed: completedForDay,
        isWeekend,
        isHoliday,
      });


      cursor.setDate(cursor.getDate() + 1);
    }


    return days;
  })();
console.log("chartData[0]", chartData[0]);
console.log("chartData[1]", chartData[1]);
console.log("ANALYTICS chartData", chartData);
console.log("ANALYTICS period", start.toISOString(), end.toISOString());
console.log("ANALYTICS holidays", holidays);
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-blue-header text-white px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <SideMenu />
          <h1 className="text-lg font-semibold">Аналитика</h1>
          <div></div>
        </div>


        {user && <UserProfile user={user} />}
      </header>


      <div className="p-6">
        {/* Period Filters */}
        <div className="mb-6">
          <div className="flex space-x-2 mb-4">
            {[
              { key: "week", label: "Неделя" },
              { key: "month", label: "Месяц" },
              { key: "quarter", label: "Квартал" },
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={selectedPeriod === key ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedPeriod(key as Period)}
                data-testid={`button-period-${key}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>


        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div
            className="bg-muted rounded-lg p-4 text-center"
            data-testid="stat-total"
          >
            <div className="text-2xl font-bold text-blue-600">
              {totalActivities}
            </div>
            <div className="text-sm text-muted-foreground">
              Всего активностей
            </div>
          </div>
          <div
            className="bg-muted rounded-lg p-4 text-center"
            data-testid="stat-completed"
          >
            <div className="text-2xl font-bold text-green-600">
              {completedActivities}
            </div>
            <div className="text-sm text-muted-foreground">Выполнено</div>
          </div>
          <div
            className="bg-muted rounded-lg p-4 text-center"
            data-testid="stat-in-progress"
          >
            <div className="text-2xl font-bold text-orange-600">
              {inProgressActivities}
            </div>
            <div className="text-sm text-muted-foreground">В процессе</div>
          </div>
          <div
            className="bg-muted rounded-lg p-4 text-center"
            data-testid="stat-cancelled"
          >
            <div className="text-2xl font-bold text-red-600">
              {cancelledActivities}
            </div>
            <div className="text-sm text-muted-foreground">Отменено</div>
          </div>
        </div>


        {/* Chart */}
        <div className="bg-muted rounded-lg p-6 mb-6">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Выполнение за период
          </h4>
          <div className="h-32 flex flex-col items-stretch justify-between">
            <div className="flex justify-center">
              <span className="text-sm font-semibold text-foreground">
                {completedActivities}
              </span>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis
  dataKey="label"
  axisLine={false}
  tickLine={false}
  tick={(props: any) => {
    const { x, y, payload, index } = props;
    const item = chartData[index];


    const isWeekend = item?.isWeekend;
    const isHoliday = item?.isHoliday;


    let fill = "#6b7280"; // обычный серый (text-muted-foreground)
    if (isWeekend) fill = "#ef4444"; // выходной — красный
    if (isHoliday) fill = "#f97316"; // праздник — оранжевый


    return (
      <text
        x={x}
        y={y + 10}
        textAnchor="middle"
        fill={fill}
        fontSize={10}
      >
        {payload.value}
      </text>
    );
  }}
/>
                  <YAxis hide />
                  <Bar
                    dataKey="completed"
                    radius={[4, 4, 0, 0]}
                  >
                    {chartData.map((entry, index) => {
                      let color = "hsl(211, 26%, 46%)"; // обычный день
                      if (entry.isWeekend) color = "#EF4444"; // выходной — красный
                      if (entry.isHoliday) color = "#F97316"; // праздник — оранжевый


                      return <Cell key={index} fill={color} />;
                    })}
                    <LabelList
                      dataKey="completed"
                      position="top"
                      className="fill-white text-[0px] font-bold"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>


        {/* Activity Types Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            По типам активностей
          </h4>
          <div className="space-y-2">
            {Object.entries(typeBreakdown).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between"
                data-testid={`type-${type}`}
              >
                <span className="text-sm text-foreground">{type}</span>
                <span className="text-sm font-medium text-foreground">
                  {count}
                </span>
              </div>
            ))}
            {Object.keys(typeBreakdown).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Нет данных для отображения
              </p>
            )}
          </div>
        </div>
      </div>


      <BottomNavigation />
    </div>
  );
}
