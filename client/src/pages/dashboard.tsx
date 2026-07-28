import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Download,
  Trash2,
  Check,
  X,
  Filter,
  BarChart3,
  Calendar as CalendarIcon,
  List,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import UserProfile from "@/components/user-profile";
import SideMenu from "@/components/side-menu";
import DateNavigation from "@/components/date-navigation";
import ActivityCard from "@/components/activity-card";
import CreateActivityModal from "@/components/create-activity-modal";
import BottomNavigation from "@/components/bottom-navigation";
import { useAuth } from "@/contexts/auth-context";
import { activityApi, holidaysApi, userApi } from "@/lib/api";
import type { ActivityWithDetails, User } from "@shared/schema";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ─── Types & constants ───────────────────────────────────────────────────────

type CalendarStats = {
  date: string; // "YYYY-MM-DD"
  planned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
};

type ViewMode = "list" | "calendar" | "analytics";
type GroupBy = "date" | "manager" | "type" | "city";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planned:     { label: "Запланировано", color: "#3b82f6", bg: "bg-blue-500" },
  in_progress: { label: "В процессе",    color: "#f59e0b", bg: "bg-amber-500" },
  completed:   { label: "Выполнено",     color: "#10b981", bg: "bg-emerald-500" },
  cancelled:   { label: "Отменено",      color: "#ef4444", bg: "bg-red-500" },
  rescheduled: { label: "Перенесено",    color: "#8b5cf6", bg: "bg-violet-500" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatManagerName(u: User) {
  const full = `${u.lastName || ""} ${u.firstName || ""} ${u.middleName || ""}`.trim();
  return full || u.username;
}

function escapeCsv(value: string | number | undefined) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportActivitiesToCsv(activities: ActivityWithDetails[], filename: string) {
  const headers = [
    "Дата начала",
    "Дата окончания",
    "Менеджер",
    "Тип",
    "Город",
    "Статус",
    "Сотрудник",
    "Название",
    "Описание",
  ];
  const rows = activities.map((a) => [
    format(new Date(a.startDate), "dd.MM.yyyy HH:mm", { locale: ru }),
    format(new Date(a.endDate), "dd.MM.yyyy HH:mm", { locale: ru }),
    a.managerName || "—",
    a.type?.name || "—",
    a.city?.name || "—",
    STATUS_CONFIG[a.status]?.label || a.status,
    a.employee
      ? `${a.employee.lastName || ""} ${a.employee.firstName || ""}`.trim()
      : "—",
    a.title,
    a.description || "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityWithDetails | null>(null);

  // Admin/director-only state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isPrivileged = user?.role === "admin" || user?.role === "director";

  // Dates
  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  // Managers list (for filters)
  const { data: managers = [] } = useQuery({
    queryKey: ["/api/users/managers"],
    queryFn: () => userApi.getManagersList(),
    enabled: isPrivileged,
  });

  // Activities: один источник данных для всех ролей
  const {
    data: activities = [],
    isLoading: activitiesLoading,
    error: activitiesError,
  } = useQuery({
    queryKey: ["supabase/activities/all", startDate.toISOString(), endDate.toISOString()],
    queryFn: () => activityApi.getAllActivities(startDate, endDate),
    enabled: !!user?.id,
  });

  // Calendar stats: остаётся только для менеджера,
  // админ/директор сейчас тоже могут использовать общий календарь из activities
  const {
    data: calendarStatsData = { items: [] as CalendarStats[] },
    isLoading: isCalendarLoading,
    error: calendarError,
  } = useQuery({
    queryKey: ["supabase/activities/calendar/user", user?.id, startDate, endDate],
    queryFn: () => activityApi.getActivityCalendarStatsByUser(user!.id, startDate, endDate),
    enabled: !!user?.id,
  });

  // Holidays
  const calendarYear = currentDate.getFullYear();
  const { data: calendarHolidays = [] } = useQuery({
    queryKey: ["/api/holidays", calendarYear],
    queryFn: () =>
      holidaysApi.getHolidaysForYear(calendarYear) as Promise<{ date: string; name: string }[]>,
  });

  const holidayDates = useMemo(
    () =>
      new Set(
        (Array.isArray(calendarHolidays) ? calendarHolidays : []).map(
          (h: any) => new Date(h.date).toISOString().slice(0, 10),
        ),
      ),
    [calendarHolidays],
  );

  // ── Data for view ───────────────────────────────────────────
  const baseActivities = activities;
  const isLoading = activitiesLoading;
  const hasError = activitiesError || calendarError;

  const filteredActivities = useMemo(() => {
    let list = [...baseActivities];

    if (isPrivileged) {
      if (managerFilter !== "all") {
        list = list.filter((a) => a.userId === managerFilter || a.managerName === managerFilter);
      }
      if (statusFilter !== "all") {
        list = list.filter((a) => a.status === statusFilter);
      }
      if (typeFilter !== "all") {
        list = list.filter((a) => a.typeId === typeFilter || a.type?.name === typeFilter);
      }
      if (cityFilter !== "all") {
        list = list.filter((a) => a.cityId === cityFilter || a.city?.name === cityFilter);
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((a) => {
        const title = a.title?.toLowerCase() ?? "";
        const desc = a.description?.toLowerCase() ?? "";
        const city = a.city?.name?.toLowerCase() ?? "";
        const manager = a.managerName?.toLowerCase() ?? "";
        const typeName = a.type?.name?.toLowerCase() ?? "";
        return (
          title.includes(q) ||
          desc.includes(q) ||
          city.includes(q) ||
          manager.includes(q) ||
          typeName.includes(q)
        );
      });
    }

    return list;
  }, [baseActivities, isPrivileged, managerFilter, statusFilter, typeFilter, cityFilter, searchTerm]);

  // Grouping for privileged list view
  const groupedActivities = useMemo(() => {
    if (!isPrivileged || groupBy === "date") {
      return filteredActivities.reduce((groups, a) => {
        const key = format(new Date(a.startDate), "yyyy-MM-dd");
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
        return groups;
      }, {} as Record<string, ActivityWithDetails[]>);
    }

    if (groupBy === "manager") {
      return filteredActivities.reduce((groups, a) => {
        const key = a.managerName || "Не указан";
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
        return groups;
      }, {} as Record<string, ActivityWithDetails[]>);
    }

    if (groupBy === "type") {
      return filteredActivities.reduce((groups, a) => {
        const key = a.type?.name || "Не указан";
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
        return groups;
      }, {} as Record<string, ActivityWithDetails[]>);
    }

    // city
    return filteredActivities.reduce((groups, a) => {
      const key = a.city?.name || "Не указан";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
      return groups;
    }, {} as Record<string, ActivityWithDetails[]>);
  }, [filteredActivities, isPrivileged, groupBy]);

  // Calendar map for privileged view (computed from all activities)
  const privilegedCalendarMap = useMemo(() => {
    const map: Record<string, CalendarStats> = {};
    for (const a of filteredActivities) {
      const dayKey = format(new Date(a.startDate), "yyyy-MM-dd");
      if (!map[dayKey]) {
        map[dayKey] = { date: dayKey, planned: 0, inProgress: 0, completed: 0, cancelled: 0, rescheduled: 0 };
      }
      const { status } = a;
      if (status === "planned") map[dayKey].planned += 1;
      else if (status === "in_progress") map[dayKey].inProgress += 1;
      else if (status === "completed") map[dayKey].completed += 1;
      else if (status === "cancelled") map[dayKey].cancelled += 1;
      else if (status === "rescheduled") map[dayKey].rescheduled += 1;
    }
    return map;
  }, [filteredActivities]);

  const calendarStatsMap = useMemo(() => {
    if (isPrivileged) return privilegedCalendarMap;
    const map: Record<string, CalendarStats> = {};
    for (const item of calendarStatsData.items || []) {
      const dayKey = new Date(item.date).toISOString().slice(0, 10);
      map[dayKey] = item;
    }
    return map;
  }, [calendarStatsData, privilegedCalendarMap, isPrivileged]);

  // ── Stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = filteredActivities.length;
    const completed = filteredActivities.filter((a) => a.status === "completed").length;
    const inProgress = filteredActivities.filter((a) => a.status === "in_progress").length;
    const planned = filteredActivities.filter((a) => a.status === "planned").length;
    const cancelled = filteredActivities.filter((a) => a.status === "cancelled").length;
    const rescheduled = filteredActivities.filter((a) => a.status === "rescheduled").length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, planned, cancelled, rescheduled, completionRate };
  }, [filteredActivities]);

  const statusChartData = useMemo(() => {
    return [
      { name: "Запланировано", value: stats.planned, color: STATUS_CONFIG.planned.color },
      { name: "В процессе", value: stats.inProgress, color: STATUS_CONFIG.in_progress.color },
      { name: "Выполнено", value: stats.completed, color: STATUS_CONFIG.completed.color },
      { name: "Отменено", value: stats.cancelled, color: STATUS_CONFIG.cancelled.color },
      { name: "Перенесено", value: stats.rescheduled, color: STATUS_CONFIG.rescheduled.color },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const managerChartData = useMemo(() => {
    if (!isPrivileged) return [];
    const map: Record<string, number> = {};
    for (const a of filteredActivities) {
      const key = a.managerName || "Не указан";
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredActivities, isPrivileged]);

  // ── Mutations ───────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => activityApi.updateActivityStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/calendar/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/all"] });
      toast({ title: "Успешно", description: "Статус активности обновлён" });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить статус", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => activityApi.deleteActivity(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/calendar/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/all"] });
      toast({ title: "Успешно", description: "Активности удалены" });
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить активности", variant: "destructive" });
    },
  });

  const handlePreviousMonth = () => setCurrentDate((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));

  const handleMarkComplete = (id: string) => updateStatusMutation.mutate({ id, status: "completed" });
  const handleCancel = (id: string) => updateStatusMutation.mutate({ id, status: "cancelled" });
  const handleEdit = (activity: ActivityWithDetails) => {
    setEditingActivity(activity);
    setCreateModalOpen(true);
  };

  const handleBulkComplete = () => {
    const ids = Array.from(selectedIds);
    Promise.all(ids.map((id) => activityApi.updateActivityStatus(id, "completed"))).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/calendar/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/all"] });
      toast({ title: "Успешно", description: `Завершено активностей: ${ids.length}` });
      setSelectedIds(new Set());
    });
  };

  const handleBulkCancel = () => {
    const ids = Array.from(selectedIds);
    Promise.all(ids.map((id) => activityApi.updateActivityStatus(id, "cancelled"))).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/calendar/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/all"] });
      toast({ title: "Успешно", description: `Отменено активностей: ${ids.length}` });
      setSelectedIds(new Set());
    });
  };

  const handleBulkDelete = () => {
    deleteMutation.mutate(Array.from(selectedIds));
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = filteredActivities.map((a) => a.id);
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const uniqueTypes = useMemo(() => {
    const map = new Map<string, string>();
    baseActivities.forEach((a) => {
      if (a.type) map.set(a.type.id, a.type.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [baseActivities]);

  const uniqueCities = useMemo(() => {
    const map = new Map<string, string>();
    baseActivities.forEach((a) => {
      if (a.city) map.set(a.city.id, a.city.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [baseActivities]);

  // ── Calendar grid ───────────────────────────────────────────
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    );
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

        <div className="flex justify-between items-center mt-2">
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

        {/* View switcher */}
        <div className="mt-3 flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={viewMode === "list" ? "default" : "outline"}
            className={viewMode === "list" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-600 text-emerald-700"}
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4 mr-1" /> Список
          </Button>
          <Button
            size="sm"
            variant={viewMode === "calendar" ? "default" : "outline"}
            className={viewMode === "calendar" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-600 text-emerald-700"}
            onClick={() => setViewMode("calendar")}
          >
            <CalendarIcon className="w-4 h-4 mr-1" /> Календарь
          </Button>
          {isPrivileged && (
            <Button
              size="sm"
              variant={viewMode === "analytics" ? "default" : "outline"}
              className={viewMode === "analytics" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-600 text-emerald-700"}
              onClick={() => setViewMode("analytics")}
            >
              <BarChart3 className="w-4 h-4 mr-1" /> Аналитика
            </Button>
          )}
        </div>
      </header>

      {/* Search and date navigation */}
      <div className="px-4 py-4 bg-card">
        {viewMode === "list" && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Поиск по названию, городу, менеджеру, типу"
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

      {/* Admin/Director: analytics strip (visible in list/calendar too) */}
      {isPrivileged && viewMode !== "analytics" && (
        <div className="px-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-[10px] text-blue-500 uppercase">Всего</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-100">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-emerald-700">{stats.completed}</div>
                <div className="text-[10px] text-emerald-500 uppercase">Выполнено</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-100">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-amber-700">{stats.inProgress}</div>
                <div className="text-[10px] text-amber-500 uppercase">В процессе</div>
              </CardContent>
            </Card>
            <Card className="bg-violet-50 border-violet-100">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-violet-700">{stats.planned}</div>
                <div className="text-[10px] text-violet-500 uppercase">Запланировано</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-100">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-red-700">{stats.cancelled}</div>
                <div className="text-[10px] text-red-500 uppercase">Отменено</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-100">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-slate-700">{stats.completionRate}%</div>
                <div className="text-[10px] text-slate-500 uppercase">Выполнение</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Admin/Director: filters and bulk actions */}
      {isPrivileged && viewMode === "list" && (
        <div className="px-4 mb-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className={filtersOpen ? "bg-muted" : ""}
            >
              <Filter className="w-4 h-4 mr-1" /> Фильтры
              <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportActivitiesToCsv(
                  filteredActivities,
                  `activities_${format(currentDate, "yyyy-MM", { locale: ru })}.csv`,
                )
              }
            >
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground">{selectedIds.size} выбрано</span>
                <Button size="sm" variant="outline" onClick={handleBulkComplete}>
                  <Check className="w-4 h-4 mr-1 text-green-600" /> Выполнить
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkCancel}>
                  <X className="w-4 h-4 mr-1 text-red-600" /> Отменить
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Trash2 className="w-4 h-4 mr-1 text-red-600" /> Удалить
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить активности?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Будет удалено {selectedIds.size} активностей. Это действие необратимо.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Снять
                </Button>
              </div>
            )}
          </div>

          {filtersOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-muted rounded-lg">
              <Select value={managerFilter} onValueChange={setManagerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Менеджер" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все менеджеры</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {formatManagerName(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Тип активности" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  {uniqueTypes.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Город" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все города</SelectItem>
                  {uniqueCities.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Grouping */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Группировать:</span>
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="date" className="text-xs px-2">
                  По датам
                </TabsTrigger>
                <TabsTrigger value="manager" className="text-xs px-2">
                  По менеджерам
                </TabsTrigger>
                <TabsTrigger value="type" className="text-xs px-2">
                  По типам
                </TabsTrigger>
                <TabsTrigger value="city" className="text-xs px-2">
                  По городам
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      )}

      {/* Main content */}
      {viewMode === "list" ? (
        <div className="px-4">
          {hasError ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Ошибка загрузки активностей. Попробуйте обновить страницу или проверьте права в Supabase.
              </p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Загрузка активностей...</p>
            </div>
          ) : Object.keys(groupedActivities).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Нет активностей для отображения</p>
            </div>
          ) : (
            <>
              {isPrivileged && (
                <div className="flex items-center gap-3 mb-3">
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    Выбрать все
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Снять выделение
                  </Button>
                </div>
              )}
              {Object.entries(groupedActivities)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupKey, dayActivities]) => {
                  const isTodayGroup =
                    groupBy === "date" && format(new Date(), "yyyy-MM-dd") === groupKey;

                  const groupTitle =
                    groupBy === "date"
                      ? format(new Date(groupKey), "d MMMM, EEEEEE", { locale: ru })
                      : groupKey;

                  return (
                    <div
                      key={groupKey}
                      className={[
                        "mb-6 rounded-lg",
                        isTodayGroup ? "bg-blue-header-light/60" : "",
                      ].join(" ")}
                    >
                      <h5
                        className={[
                          "text-sm font-medium mb-3 px-2 pt-2",
                          isTodayGroup ? "text-blue-header" : "text-muted-foreground",
                        ].join(" ")}
                        data-testid="day-header"
                      >
                        {groupTitle}
                        {isTodayGroup && (
                          <span className="ml-2 text-xs font-normal uppercase tracking-wide">
                            Сегодня
                          </span>
                        )}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          ({dayActivities.length})
                        </span>
                      </h5>

                      <div className="space-y-2 pb-2 px-2">
                        {dayActivities.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-2">
                            {isPrivileged && (
                              <div className="pt-2">
                                <Checkbox
                                  checked={selectedIds.has(activity.id)}
                                  onCheckedChange={() => toggleSelection(activity.id)}
                                />
                              </div>
                            )}
                            <div className="flex-1">
                              <ActivityCard
                                activity={activity}
                                onMarkComplete={handleMarkComplete}
                                onEdit={handleEdit}
                                onCancel={handleCancel}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      ) : viewMode === "calendar" ? (
        <div className="px-4 py-4">
          {hasError ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Ошибка загрузки календаря. Проверьте функцию get_activity_calendar_stats_by_user и права на таблицы.
              </p>
            </div>
          ) : isLoading || isCalendarLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Загрузка календаря...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 text-xs text-muted-foreground mb-2">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                  <div key={d} className="text-center">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-rows-6 gap-1">
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((day) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      const stats = calendarStatsMap[dateKey];

                      const isToday = isSameDay(day, new Date());
                      const inCurrentMonth = isSameMonth(day, monthStart);
                      const dayOfWeek = day.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isHoliday = holidayDates.has(dateKey);

                      return (
                        <div
                          key={dateKey}
                          className={[
                            "border rounded-md p-1 min-h-[60px] flex flex-col",
                            isToday ? "border-blue-header text-blue-header" : "",
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
                              isHoliday ? "text-orange-600" : isWeekend ? "text-red-600" : "",
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
                              {stats.inProgress > 0 && (
                                <div className="flex items-center justify-between text-amber-600">
                                  <span>В пр</span>
                                  <span>{stats.inProgress}</span>
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
                              {stats.rescheduled > 0 && (
                                <div className="flex items-center justify-between text-violet-600">
                                  <span>Перен</span>
                                  <span>{stats.rescheduled}</span>
                                </div>
                              )}
                              {stats.planned === 0 &&
                                stats.inProgress === 0 &&
                                stats.completed === 0 &&
                                stats.cancelled === 0 &&
                                stats.rescheduled === 0 && (
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

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>План</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>В процессе</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>Выполнено</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span>Отменено</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  <span>Перенесено</span>
                </div>
              </div>

              {calendarStatsData.items.length > 0 && !isPrivileged && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Период: {format(startDate, "dd.MM.yyyy", { locale: ru })} —{" "}
                  {format(endDate, "dd.MM.yyyy", { locale: ru })}
                  <br />
                  Занятых дней:{" "}
                  {calendarStatsData.items.filter(
                    (d) =>
                      d.planned +
                        d.inProgress +
                        d.completed +
                        d.rescheduled +
                        d.cancelled >
                      0,
                  ).length}
                  <br />
                  Плановых активностей (по дням):{" "}
                  {calendarStatsData.items.reduce(
                    (sum, d) => sum + d.planned,
                    0,
                  )}
                  <br />
                  Завершённых активностей (по дням):{" "}
                  {calendarStatsData.items.reduce(
                    (sum, d) => sum + d.completed,
                    0,
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Analytics view */
        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-[10px] text-blue-500 uppercase">Всего</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-100">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700">{stats.completed}</div>
                <div className="text-[10px] text-emerald-500 uppercase">Выполнено</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-100">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{stats.inProgress}</div>
                <div className="text-[10px] text-amber-500 uppercase">В процессе</div>
              </CardContent>
            </Card>
            <Card className="bg-violet-50 border-violet-100">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-violet-700">{stats.planned}</div>
                <div className="text-[10px] text-violet-500 uppercase">Запланировано</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-100">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{stats.cancelled}</div>
                <div className="text-[10px] text-red-500 uppercase">Отменено</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-100">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-slate-700">{stats.completionRate}%</div>
                <div className="text-[10px] text-slate-500 uppercase">Выполнение</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Распределение по статусам</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = filteredActivities.filter((a) => a.status === key).length;
                  const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{cfg.label}</span>
                        <span className="text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {managerChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Активности по менеджерам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={managerChartData}
                      layout="vertical"
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
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
          if (!open) setEditingActivity(null);
        }}
        userId={user?.id || ""}
        activityToEdit={editingActivity}
      />
    </div>
  );
}