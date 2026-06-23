import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import { useAuth } from "@/contexts/auth-context";
import { activityApi } from "@/lib/api";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";

type Period = "week" | "month" | "quarter";

export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  const { user } = useAuth();

  const getPeriodDates = (period: Period) => {
    const now = new Date();
    switch (period) {
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
    }
  };

  const { start, end } = getPeriodDates(selectedPeriod);

  const { data: activities = [] } = useQuery({
    queryKey: ["/api/activities/user", user?.id, start, end],
    queryFn: () => activityApi.getActivitiesByUser(user?.id!, start, end),
    enabled: !!user?.id,
  });

  // Calculate statistics
  const totalActivities = activities.length;
  const completedActivities = activities.filter(a => a.status === "completed").length;
  const inProgressActivities = activities.filter(a => a.status === "in_progress").length;
  const cancelledActivities = activities.filter(a => a.status === "cancelled" || a.status === "rescheduled").length;

  // Activity types breakdown
  const typeBreakdown = activities.reduce((acc, activity) => {
    const typeName = activity.type.name;
    acc[typeName] = (acc[typeName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Chart data for completion by day
  const chartData = [
    { day: "Пн", completed: 3 },
    { day: "Вт", completed: 4 },
    { day: "Ср", completed: 2 },
    { day: "Чт", completed: 5 },
    { day: "Пт", completed: 3 },
    { day: "Сб", completed: 2 },
    { day: "Вс", completed: 4 },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-blue-header text-white px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <SideMenu />
          <h1 className="text-lg font-semibold">Аналитика</h1>
          <div></div>
        </div>
      </header>

      <div className="p-6">
        {/* Period Filters */}
        <div className="mb-6">
          <div className="flex space-x-2 mb-4">
            {[
              { key: "week", label: "Неделя" },
              { key: "month", label: "Месяц" },
              { key: "quarter", label: "Квартал" }
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
          <div className="bg-muted rounded-lg p-4 text-center" data-testid="stat-total">
            <div className="text-2xl font-bold text-blue-600">{totalActivities}</div>
            <div className="text-sm text-muted-foreground">Всего активностей</div>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center" data-testid="stat-completed">
            <div className="text-2xl font-bold text-green-600">{completedActivities}</div>
            <div className="text-sm text-muted-foreground">Выполнено</div>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center" data-testid="stat-in-progress">
            <div className="text-2xl font-bold text-orange-600">{inProgressActivities}</div>
            <div className="text-sm text-muted-foreground">В процессе</div>
          </div>
          <div className="bg-muted rounded-lg p-4 text-center" data-testid="stat-cancelled">
            <div className="text-2xl font-bold text-red-600">{cancelledActivities}</div>
            <div className="text-sm text-muted-foreground">Отменено</div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-muted rounded-lg p-6 mb-6">
          <h4 className="text-sm font-medium text-foreground mb-4">Выполнение по дням</h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Bar dataKey="completed" fill="hsl(221.2, 83.2%, 53.3%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Types Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">По типам активностей</h4>
          <div className="space-y-2">
            {Object.entries(typeBreakdown).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between" data-testid={`type-${type}`}>
                <span className="text-sm text-foreground">{type}</span>
                <span className="text-sm font-medium text-foreground">{count}</span>
              </div>
            ))}
            {Object.keys(typeBreakdown).length === 0 && (
              <p className="text-sm text-muted-foreground">Нет данных для отображения</p>
            )}
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}
