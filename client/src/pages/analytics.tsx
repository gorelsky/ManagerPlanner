import { useState } from "react";
import { planningDate } from "@shared/planning-time";
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
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import UserProfile from "@/components/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { activityApi, analyticsApi, holidaysApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  format,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ru } from "date-fns/locale";


type Period = "week" | "month" | "quarter";


export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  const [reportWeek, setReportWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
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

  const reportWeekStart = startOfWeek(reportWeek, { weekStartsOn: 1 });
  const reportWeekEnd = endOfWeek(reportWeek, { weekStartsOn: 1 });
  const { data: planEntryReport = [] } = useQuery({
    queryKey: ["/api/analytics/plan-entry-report", reportWeekStart.toISOString(), reportWeekEnd.toISOString()],
    queryFn: () => analyticsApi.getPlanEntryReport(reportWeekStart, reportWeekEnd),
    enabled: canViewAllPlans,
    refetchOnWindowFocus: true,
  });
  const planEntrySummary = Object.values(planEntryReport.reduce<Record<string, {
    managerName: string;
    managerUsername: string;
    firstEntry: string | null;
    lastEntry: string | null;
    planCount: number;
  }>>((summary, row) => {
    const current = summary[row.managerId] || {
      managerName: row.managerName,
      managerUsername: row.managerUsername,
      firstEntry: null,
      lastEntry: null,
      planCount: 0,
    };
    const timestamp = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
    if (Number.isFinite(timestamp)) {
      const iso = new Date(timestamp).toISOString();
      if (!current.firstEntry || iso < current.firstEntry) current.firstEntry = iso;
      if (!current.lastEntry || iso > current.lastEntry) current.lastEntry = iso;
    }
    current.planCount += 1;
    summary[row.managerId] = current;
    return summary;
  }, {})).sort((a, b) => (a.firstEntry || "").localeCompare(b.firstEntry || ""));

  const downloadPlanEntryReport = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ManagerPlanner";
    const sheet = workbook.addWorksheet("Внесение планов", {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    sheet.columns = [
      { header: "Менеджер", key: "manager", width: 28 },
      { header: "Логин / e-mail", key: "username", width: 30 },
      { header: "Начало внесения", key: "createdDate", width: 18 },
      { header: "День начала", key: "createdDay", width: 16 },
      { header: "Окончание внесения", key: "updatedDate", width: 18 },
      { header: "День окончания", key: "updatedDay", width: 16 },
      { header: "Планов внесено", key: "planCount", width: 16 },
    ];
    sheet.addRow({
      manager: `Недельный срез: ${format(reportWeekStart, "dd.MM.yyyy")}–${format(reportWeekEnd, "dd.MM.yyyy")}`,
    });
    sheet.mergeCells("A1:G1");
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF243A8F" } };
    sheet.getRow(1).alignment = { horizontal: "center" };
    sheet.spliceRows(2, 0, []);
    sheet.addRow({
      manager: "Менеджер",
      username: "Логин / e-mail",
      createdDate: "Начало внесения",
      createdDay: "День недели",
      updatedDate: "Окончание внесения",
      updatedDay: "День недели",
      planCount: "Планов внесено",
    });
    const header = sheet.getRow(3);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    planEntrySummary.forEach((row) => {
      const created = row.firstEntry ? new Date(row.firstEntry) : null;
      const updated = row.lastEntry ? new Date(row.lastEntry) : null;
      sheet.addRow({
        manager: row.managerName,
        username: row.managerUsername,
        createdDate: created ? format(created, "dd.MM.yyyy HH:mm") : "—",
        createdDay: created ? format(created, "EEEE", { locale: ru }) : "—",
        updatedDate: updated ? format(updated, "dd.MM.yyyy HH:mm") : "—",
        updatedDay: updated ? format(updated, "EEEE", { locale: ru }) : "—",
        planCount: row.planCount,
      });
    });
    sheet.autoFilter = { from: "A3", to: "G3" };
    sheet.eachRow((row, index) => {
      if (index >= 4) row.alignment = { vertical: "top", wrapText: true };
    });
    sheet.pageSetup.printTitlesRow = "1:3";
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Отчет_внесения_планов_${format(reportWeekStart, "yyyy-MM-dd")}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };


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
      format(new Date(h.date), "yyyy-MM-dd"),
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
  const now = new Date();
  const approvedPendingCompletion = activities.filter(
    (a) => a.approvalStatus === "approved" && a.status !== "completed" && a.status !== "cancelled",
  ).length;
  const overdueIncomplete = activities.filter(
    (a) => a.approvalStatus === "approved" && a.status !== "completed" && a.status !== "cancelled" && new Date(a.endDate) < now,
  ).length;
  const rejectedActivities = activities.filter((a) => a.approvalStatus === "rejected").length;
  const approvalRate = totalActivities > 0
    ? Math.round((activities.filter((a) => a.approvalStatus === "approved").length / totalActivities) * 100)
    : 0;
  const managerExecutionSummary = Object.values(activities.reduce<Record<string, {
    name: string;
    total: number;
    approved: number;
    completed: number;
    overdue: number;
    rejected: number;
  }>>((summary, activity) => {
    const key = activity.userId;
    const current = summary[key] || {
      name: activity.managerName || "Без менеджера",
      total: 0,
      approved: 0,
      completed: 0,
      overdue: 0,
      rejected: 0,
    };
    current.total += 1;
    if (activity.approvalStatus === "approved") current.approved += 1;
    if (activity.status === "completed") current.completed += 1;
    if (activity.approvalStatus === "rejected") current.rejected += 1;
    if (activity.approvalStatus === "approved" && activity.status !== "completed" && activity.status !== "cancelled" && new Date(activity.endDate) < now) {
      current.overdue += 1;
    }
    summary[key] = current;
    return summary;
  }, {})).sort((a, b) => b.overdue - a.overdue || b.total - a.total);


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
      const dayKey = format(cursor, "yyyy-MM-dd");
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);


      const completedForDay = activities.filter((a) => {
        const activityStart = planningDate(a.startDate, a.planningTimeZone);
        const activityEnd = planningDate(a.endDate, a.planningTimeZone);
        return (
          a.status === "completed" &&
          activityStart <= dayEnd &&
          activityEnd >= dayStart
        );
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
            <div className="text-2xl font-bold text-primary">
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
          <div className="bg-amber-100 rounded-lg p-4 text-center border border-amber-300" data-testid="stat-overdue">
            <div className="text-2xl font-bold text-amber-800">{overdueIncomplete}</div>
            <div className="text-sm text-amber-900">Просрочено и не выполнено</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200" data-testid="stat-pending-completion">
            <div className="text-2xl font-bold text-blue-800">{approvedPendingCompletion}</div>
            <div className="text-sm text-blue-900">Утверждено, ждёт выполнения</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200" data-testid="stat-rejected">
            <div className="text-2xl font-bold text-red-800">{rejectedActivities}</div>
            <div className="text-sm text-red-900">Отклонено</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 text-center border border-emerald-200" data-testid="stat-approval-rate">
            <div className="text-2xl font-bold text-emerald-800">{approvalRate}%</div>
            <div className="text-sm text-emerald-900">Доля утверждённых</div>
          </div>
        </div>

        {canViewAllPlans && (
          <div className="bg-muted rounded-lg p-4 mb-6" data-testid="manager-execution-summary">
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground">Контроль исполнения по менеджерам</h4>
              <p className="text-xs text-muted-foreground">Показывает просроченные и невыполненные утверждённые планы за выбранный период.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-3">Менеджер</th>
                    <th className="py-2 pr-3">Всего</th>
                    <th className="py-2 pr-3">Утверждено</th>
                    <th className="py-2 pr-3">Выполнено</th>
                    <th className="py-2 pr-3">Просрочено</th>
                    <th className="py-2">Отклонено</th>
                  </tr>
                </thead>
                <tbody>
                  {managerExecutionSummary.map((row) => (
                    <tr key={row.name} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{row.name}</td>
                      <td className="py-2 pr-3">{row.total}</td>
                      <td className="py-2 pr-3">{row.approved}</td>
                      <td className="py-2 pr-3 text-emerald-700">{row.completed}</td>
                      <td className={cn("py-2 pr-3 font-semibold", row.overdue > 0 ? "text-amber-700" : "text-muted-foreground")}>{row.overdue}</td>
                      <td className="py-2 text-red-700">{row.rejected}</td>
                    </tr>
                  ))}
                  {managerExecutionSummary.length === 0 && (
                    <tr><td colSpan={6} className="py-5 text-center text-muted-foreground">За выбранный период планов нет.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}


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
                      let color = "hsl(246, 82%, 42%)"; // корпоративный цвет
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
        {canViewAllPlans && (
          <div className="bg-muted rounded-lg p-4 mb-6" data-testid="plan-entry-report">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Внесение планов менеджерами</h4>
                <p className="text-xs text-muted-foreground">
                  Период: {format(reportWeekStart, "dd.MM.yyyy")} — {format(reportWeekEnd, "dd.MM.yyyy")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setReportWeek(subWeeks(reportWeekStart, 1))} aria-label="Предыдущая неделя">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setReportWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Текущая неделя</Button>
                <Button variant="outline" size="icon" onClick={() => setReportWeek(addWeeks(reportWeekStart, 1))} aria-label="Следующая неделя">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={downloadPlanEntryReport} disabled={planEntrySummary.length === 0}>
                  <Download className="w-4 h-4 mr-1" /> Excel
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-3">Менеджер</th>
                    <th className="py-2 pr-3">Начало внесения</th>
                    <th className="py-2 pr-3">День начала</th>
                    <th className="py-2 pr-3">Окончание внесения</th>
                    <th className="py-2 pr-3">День окончания</th>
                    <th className="py-2">Планов</th>
                  </tr>
                </thead>
                <tbody>
                  {planEntrySummary.map((row) => {
                    const created = row.firstEntry ? new Date(row.firstEntry) : null;
                    const updated = row.lastEntry ? new Date(row.lastEntry) : null;
                    return (
                      <tr key={row.managerUsername} className="border-b border-border/60 align-top">
                        <td className="py-2 pr-3 font-medium">{row.managerName}<div className="text-muted-foreground">{row.managerUsername}</div></td>
                        <td className="py-2 pr-3 whitespace-nowrap">{created ? format(created, "dd.MM.yyyy HH:mm") : "—"}</td>
                        <td className="py-2 pr-3">{created ? format(created, "EEEE", { locale: ru }) : "—"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{updated ? format(updated, "dd.MM.yyyy HH:mm") : "—"}</td>
                        <td className="py-2 pr-3">{updated ? format(updated, "EEEE", { locale: ru }) : "—"}</td>
                        <td className="py-2">{row.planCount}</td>
                      </tr>
                    );
                  })}
                  {planEntrySummary.length === 0 && (
                    <tr><td colSpan={6} className="py-5 text-center text-muted-foreground">За выбранную неделю планов не внесено.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
