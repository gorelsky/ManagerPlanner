import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import UserProfile from "@/components/user-profile";
import SideMenu from "@/components/side-menu";
import DateNavigation from "@/components/date-navigation";
import ActivityCard from "@/components/activity-card";
import CreateActivityModal from "@/components/create-activity-modal";
import BottomNavigation from "@/components/bottom-navigation";
import { useAuth } from "@/contexts/auth-context";
import { activityApi, holidaysApi } from "@/lib/api";
import type { ActivityWithDetails } from "@shared/schema";

type CalendarStats = {
  date: string; // "YYYY-MM-DD"
  planned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
};

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [editingActivity, setEditingActivity] =
    useState<ActivityWithDetails | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Эти даты оставляем для календарной статистики, но НЕ режем ими список
  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  // Список активностей (для режима "Список") — БЕЗ фильтра по месяцу
const { data: activities = [], isLoading } = useQuery({
  queryKey: [
    "/api/activities/user",
    user?.id,
    startDate.toISOString(),
    endDate.toISOString(),
  ],
  queryFn: () =>
    activityApi.getActivitiesByUser(user!.id, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
  enabled: !!user?.id,
});

  // Календарная статистика (для режима "Календарь")
  const {
    data: calendarStatsData = { items: [] as CalendarStats[] },
    isLoading: isCalendarLoading,
  } = useQuery({
    queryKey: ["/api/activities/calendar/user", user?.id, startDate, endDate],
    queryFn: () =>
      activityApi.getActivityCalendarStatsByUser(
        user!.id,
        startDate,
        endDate,
      ),
    enabled: !!user?.id,
  });

  // Праздники для года календаря
  const calendarYear = currentDate.getFullYear();
  const { data: calendarHolidays = [] } = useQuery({
    queryKey: ["/api/holidays", calendarYear],
    queryFn: () =>
      holidaysApi.getHolidaysForYear(calendarYear) as Promise<
        { date: string; name: string }[]
      >,
  });

  // Множество дат-праздников "YYYY-MM-DD"
  const holidayDates = useMemo(
    () =>
      new Set(
        calendarHolidays.map((h: any) =>
          new Date(h.date).toISOString().slice(0, 10),
        ),
      ),
    [calendarHolidays],
  );

  const calendarStatsMap = useMemo(() => {
    const map: Record<string, CalendarStats> = {};

    for (const item of calendarStatsData.items || []) {
      const dateObj = new Date(item.date);
      const dayKey = dateObj.toISOString().slice(0, 10);
      map[dayKey] = item;
    }

    return map;
  }, [calendarStatsData]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      activityApi.updateActivityStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/activities/user", user?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/activities/calendar/user", user?.id],
      });
      toast({
        title: "Успешно",
        description: "Статус активности обновлён",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive",
      });
    },
  });

  const handlePreviousMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleMarkComplete = (id: string) => {
    updateStatusMutation.mutate({ id, status: "completed" });
  };

  // Клик по иконке "редактировать" в карточке
  const handleEdit = (activity: ActivityWithDetails) => {
    setEditingActivity(activity);
    setCreateModalOpen(true);
  };

  const handleCancel = (id: string) => {
    updateStatusMutation.mutate({ id, status: "cancelled" });
  };

  // Фильтрация для списка (защита от undefined + пустой запрос)
  const filteredActivities = activities.filter((activity) => {
    if (!searchTerm.trim()) return true;

    const q = searchTerm.toLowerCase();
    const title = activity.title?.toLowerCase() ?? "";
    const desc = activity.description?.toLowerCase() ?? "";
    const city = activity.city?.name?.toLowerCase() ?? "";

    return title.includes(q) || desc.includes(q) || city.includes(q);
  });

  // Группировка по датам (для списка)
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const dateKey = format(new Date(activity.startDate), "yyyy-MM-dd");
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
    return groups;
  }, {} as Record<string, ActivityWithDetails[]>);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  // Построение сетки календаря для текущего месяца
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ru, weekStartsOn: 1 });
  const weeks: Date[][] = [];
  let current = calendarStart;

  while (current <= monthEnd || weeks.length < 6) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(current);
      current = addDays(current, 1);
    }
    weeks.push(week);
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-blue-header text-white px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <SideMenu />
          <h1 className="text-lg font-semibold">План-факт активностей</h1>
          <div></div>
        </div>

        <UserProfile user={user} />

        <div className="flex justify между items-center mt-2">
          <h3 className="text-white font-medium">План-факт активностей</h3>
          <Button
            className="ml-auto px-3 py-1 rounded bg-green-600 text-white text-sm"
            onClick={() => {
              setEditingActivity(null);
              setCreateModalOpen(true);
            }}
            data-testid="button-add-activity"
          >
            <Plus className="w-4 h-4 mr-1" /> Добавь
          </Button>
        </div>

{/* Переключатель режимов */}
<div className="mt-3 flex gap-2">
  <Button
    size="sm"
    variant={viewMode === "list" ? "default" : "outline"}
    className={
      viewMode === "list"
        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
        : "border-emerald-600 text-emerald-700"
    }
    onClick={() => setViewMode("list")}
  >
    Список
  </Button>
  <Button
    size="sm"
    variant={viewMode === "calendar" ? "default" : "outline"}
    className={
      viewMode === "calendar"
        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
        : "border-emerald-600 text-emerald-700"
    }
    onClick={() => setViewMode("calendar")}
  >
    Календарь
  </Button>
</div>
      </header>

      {/* Search and Filters */}
      <div className="px-4 py-4 bg-card">
        {viewMode === "list" && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Поиск"
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>
        )}

        <DateNavigation
          currentDate={currentDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
        />
      </div>

      {/* Основной контент: список или календарь */}
      {viewMode === "list" ? (
        <div className="px-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Загрузка активностей...</p>
            </div>
          ) : Object.keys(groupedActivities).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Нет активностей для отображения
              </p>
            </div>
          ) : (
            Object.entries(groupedActivities)
              .sort(([a, b]) => a.localeCompare(b))
              .map(([dateKey, dayActivities]) => {
                const isTodayGroup =
                  format(new Date(), "yyyy-MM-dd") === dateKey;

                return (
                  <div
                    key={dateKey}
                    className={[
                      "mb-6 rounded-lg",
                      isTodayGroup ? "bg-blue-header-light/60" : "",
                    ].join(" ")}
                  >
                    <h5
                      className={[
                        "text-sm font-medium mb-3 px-2 pt-2",
                        isTodayGroup
                          ? "text-blue-header"
                          : "text-muted-foreground",
                      ].join(" ")}
                      data-testid="day-header"
                    >
                      {format(new Date(dateKey), "d MMMM, EEEEEE", {
                        locale: ru,
                      })}
                      {isTodayGroup && (
                        <span className="ml-2 text-xs font-normal uppercase tracking-wide">
                          Сегодня
                        </span>
                      )}
                    </h5>

                    <div className="space-y-2 pb-2 px-2">
                      {dayActivities.map((activity) => (
                        <ActivityCard
                          key={activity.id}
                          activity={activity}
                          onMarkComplete={handleMarkComplete}
                          onEdit={handleEdit}
                          onCancel={handleCancel}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      ) : (
        <div className="px-4 py-4">
          {isCalendarLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Загрузка календаря...</p>
            </div>
          ) : (
            <>
              {/* Заголовок дней недели */}
              <div className="grid grid-cols-7 text-xs text-muted-foreground mb-2">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                  <div key={d} className="text-center">
                    {d}
                  </div>
                ))}
              </div>

              {/* Сетка календаря */}
              <div className="grid grid-rows-6 gap-1">
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((day) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      const stats = calendarStatsMap[dateKey];

                      const isToday = isSameDay(day, new Date());
                      const inCurrentMonth = isSameMonth(day, monthStart);

                      const dayKey = format(day, "yyyy-MM-dd");
                      const dayOfWeek = day.getDay(); // 0 - вс, 6 - сб
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isHoliday = holidayDates.has(dayKey);

                      return (
                        <div
                          key={dateKey}
                          className={[
                            "border rounded-md p-1 min-h-[60px] flex flex-col",
                            isToday
                              ? "border-blue-header text-blue-header"
                              : "",
                            isHoliday
                              ? "bg-orange-100"
                              : isWeekend
                              ? "bg-red-100"
                              : inCurrentMonth
                              ? "bg-card"
                              : "bg-muted/40",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "text-xs font-medium mb-1 text-right",
                              isHoliday
                                ? "text-orange-600"
                                : isWeekend
                                ? "text-red-600"
                                : "",
                            ].join(" ")}
                          >
                            {format(day, "d", { locale: ru })}
                          </div>

                          {stats ? (
                            <div className="mt-auto space-y-0.5 text-[10px]">
                              {stats.planned > 0 && (
                                <div className="flex items-center justify-between text-blue-600">
                                  <span>План</span>
                                  <span>{stats.planned}</span>
                                </div>
                              )}
                              {stats.completed > 0 && (
                                <div className="flex items-center justify-between text-emerald-600">
                                  <span>Вып</span>
                                  <span>{stats.completed}</span>
                                </div>
                              )}
                              {stats.cancelled > 0 && (
                                <div className="flex items-center justify-between text-red-600">
                                  <span>Отм</span>
                                  <span>{stats.cancelled}</span>
                                </div>
                              )}
                              {stats.planned === 0 &&
                                stats.completed === 0 &&
                                stats.cancelled === 0 && (
                                  <div className="text-[10px] text-muted-foreground text-center">
                                    —
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div className="mt-auto text-[10px] text-muted-foreground text-center">
                              —
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Легенда */}
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>План</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>Выполнено</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span>Отменено</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-header text-white rounded-full shadow-lg hover:bg-green-600 transition-colors flex items-center justify-center"
        onClick={() => {
          setEditingActivity(null);
          setCreateModalOpen(true);
        }}
        data-testid="button-floating-add"
      >
        <Plus className="w-6 h-6" />
      </button>

      <BottomNavigation />

      <CreateActivityModal
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) {
            setEditingActivity(null);
          }
        }}
        userId={user?.id || ""}
        activityToEdit={editingActivity}
      />
    </div>
  );
}