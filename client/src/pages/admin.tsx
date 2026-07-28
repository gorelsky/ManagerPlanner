import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, Users, Settings, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import { useAuth } from "@/contexts/auth-context";
import {
  employeeApi,
  userApi,
  activityApi,
  cityApi,
  holidaysApi,
} from "@/lib/api";
import type { EmployeeWithDetails, ActivityWithDetails } from "@shared/schema";

type DayBucket = {
  date: Date;
  weekOfMonth: number;
  activities: ActivityWithDetails[];
};

function getWeekOfMonth(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = firstDay.getDay() || 7;
  return Math.ceil((date.getDate() + offset - 1) / 7);
}

function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export default function Admin() {
  const [csvData, setCsvData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"reps" | "plans">("reps");
  const [uploadTab, setUploadTab] = useState<
    "employees" | "cities" | "manager-cities" | "holidays" | "managers"
  >("employees");

  const [managerFile, setManagerFile] = useState<File | null>(null);
  const [managerRole, setManagerRole] = useState<"manager" | "admin">(
    "manager",
  );
  const [isImportingManagers, setIsImportingManagers] = useState(false);

  const [citiesCsv, setCitiesCsv] = useState("");
  const [isImportingCities, setIsImportingCities] = useState(false);

  const [managerCitiesCsv, setManagerCitiesCsv] = useState("");
  const [isImportingManagerCities, setIsImportingManagerCities] =
    useState(false);

  const [holidaysCsv, setHolidaysCsv] = useState("");
  const [isImportingHolidays, setIsImportingHolidays] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const isReadOnly = user?.role === "director";

  // выбранный менеджер для фильтра
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(
    null,
  );

  if (user?.role !== "admin" && user?.role !== "director") {
    return (
      <div className="p-4 text-center">
        <h1 className="text-xl font-semibold mb-4">Доступ запрещен</h1>
        <p className="text-muted-foreground">
          Эта страница доступна только администраторам
        </p>
        <BottomNavigation />
      </div>
    );
  }

  const { data: allEmployees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees/all"],
    queryFn: () => employeeApi.getAllEmployees(),
  });

  const { data: allManagers = [], isLoading: managersLoading } = useQuery({
    queryKey: ["/api/users/managers"],
    queryFn: () => userApi.getManagersList(),
  });

  const { data: allActivities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/activities/all"],
    queryFn: () => activityApi.getAllActivities(),
  });

  const monthStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );
  const monthEnd = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  );

  const allMonthDates = getDatesInRange(monthStart, monthEnd);

  const dailyActivities: DayBucket[] = allMonthDates.map((date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const activitiesForDay = allActivities.filter((activity) => {
      const start = new Date(activity.startDate);
      return start >= dayStart && start <= dayEnd;
    });

    return {
      date,
      weekOfMonth: getWeekOfMonth(date),
      activities: activitiesForDay,
    };
  });

  const weeksInMonth = dailyActivities.reduce<Record<number, DayBucket[]>>(
    (acc, day) => {
      if (!acc[day.weekOfMonth]) acc[day.weekOfMonth] = [];
      acc[day.weekOfMonth].push(day);
      return acc;
    },
    {},
  );

  const managersFromActivities =
    allActivities
      ?.filter((a) => a.managerName)
      .map((a) => ({
        id: a.managerName as string,
        name: a.managerName as string,
      })) ?? [];

  const uniqueManagers = Array.from(
    new Map(managersFromActivities.map((m) => [m.id, m])).values(),
  );

  const importEmployeesMutation = useMutation({
    mutationFn: (data: string) => employeeApi.importEmployees(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Импорт завершен",
        description: `Импортировано ${result.imported} сотрудников`,
      });
      setCsvData("");
      setIsImporting(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка импорта",
        description: error.message || "Не удалось импортировать данные",
        variant: "destructive",
      });
      setIsImporting(false);
    },
  });

  const importManagersMutation = useMutation({
    mutationFn: (payload: { csvData: string; role: "manager" | "admin" }) =>
      userApi.importUsers(payload.csvData, payload.role),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/managers"] });
      toast({
        title: "Импорт менеджеров завершен",
        description: `Импортировано менеджеров: ${result.imported}`,
      });
      setManagerFile(null);
      setIsImportingManagers(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка импорта менеджеров",
        description: error.message || "Не удалось импортировать менеджеров",
        variant: "destructive",
      });
      setIsImportingManagers(false);
    },
  });

  const deleteManagerMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/managers"] });
      toast({
        title: "Менеджер удалён",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка удаления менеджера",
        description: error.message || "Не удалось удалить менеджера",
        variant: "destructive",
      });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (id: string) => activityApi.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/all"] });
      toast({ title: "Активность удалена" });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка удаления активности",
        description: error.message || "Не удалось удалить активность",
        variant: "destructive",
      });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<ActivityWithDetails> }) =>
      activityApi.updateActivity(payload.id, payload.data),
    onSuccess: (updatedActivity) => {
      queryClient.setQueryData(
        ["/api/activities/all"],
        (old: ActivityWithDetails[] | undefined) =>
          (old ?? []).map((a) =>
            a.id === updatedActivity.id ? updatedActivity : a,
          ),
      );
      toast({
        title: "Активность изменена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка изменения активности",
        description: error.message || "Не удалось изменить активность",
        variant: "destructive",
      });
    },
  });

  const importCitiesMutation = useMutation({
    mutationFn: (data: string) => cityApi.importCities(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cities"] });
      toast({
        title: "Импорт городов завершен",
        description: `Импортировано городов: ${result.imported}`,
      });
      setCitiesCsv("");
      setIsImportingCities(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка импорта городов",
        description: error.message || "Не удалось импортировать города",
        variant: "destructive",
      });
      setIsImportingCities(false);
    },
  });

  const importManagerCitiesMutation = useMutation({
    mutationFn: (data: string) => cityApi.importManagerCities(data),
    onSuccess: (result) => {
      toast({
        title: "Импорт городов менеджеров завершен",
        description: `Импортировано связей: ${result.imported}`,
      });
      setManagerCitiesCsv("");
      setIsImportingManagerCities(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка импорта городов менеджеров",
        description:
          error.message || "Не удалось импортировать связи менеджер ↔ город",
        variant: "destructive",
      });
      setIsImportingManagerCities(false);
    },
  });

  const handleImport = () => {
    if (!csvData.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите данные для импорта",
        variant: "destructive",
      });
      return;
    }
    if (isReadOnly) return;
    setIsImporting(true);
    importEmployeesMutation.mutate(csvData);
  };

  const handleImportManagers = async () => {
    if (isReadOnly) return;
    if (!managerFile) {
      toast({
        title: "Ошибка",
        description: "Выберите CSV-файл с менеджерами",
        variant: "destructive",
      });
      return;
    }

    setIsImportingManagers(true);

    try {
      const text = await managerFile.text();
      importManagersMutation.mutate({ csvData: text, role: managerRole });
    } catch (error: any) {
      toast({
        title: "Ошибка чтения файла",
        description: error.message || "Не удалось прочитать CSV-файл",
        variant: "destructive",
      });
      setIsImportingManagers(false);
    }
  };

  const handleImportCities = () => {
    if (isReadOnly) return;
    if (!citiesCsv.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите CSV с городами",
        variant: "destructive",
      });
      return;
    }
    setIsImportingCities(true);
    importCitiesMutation.mutate(citiesCsv);
  };

  const handleImportManagerCities = () => {
    if (isReadOnly) return;
    if (!managerCitiesCsv.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите CSV с связями менеджер ↔ город",
        variant: "destructive",
      });
      return;
    }
    setIsImportingManagerCities(true);
    importManagerCitiesMutation.mutate(managerCitiesCsv);
  };

  const handleImportHolidays = async () => {
    if (isReadOnly) return;
    if (!holidaysCsv.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите CSV с праздниками",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsImportingHolidays(true);
      const result = await holidaysApi.importHolidays(holidaysCsv);
      toast({
        title: "Импорт праздников завершен",
        description: `Импортировано праздников: ${result.imported ?? 0}`,
      });
      setHolidaysCsv("");
    } catch (error: any) {
      toast({
        title: "Ошибка импорта праздников",
        description: error.message || "Не удалось импортировать праздники",
        variant: "destructive",
      });
    } finally {
      setIsImportingHolidays(false);
    }
  };

  const downloadTemplate = () => {
    if (isReadOnly) return;
    const template =
      "firstName,lastName,middleName,phone,email,city,manager,profileImage";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_employees.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-20">
      <header className="bg-blue-header text-white px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <SideMenu />
          <h1 className="text-lg font-semibold">Админ-панель</h1>
          <Badge
            variant="outline"
            className="bg-white/10 text-white border-white/20"
          >
            Админ
          </Badge>
        </div>
      </header>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Всего МП</p>
                  <p className="text-xl font-semibold">{allEmployees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Менеджеров</p>
                  <p className="text-xl font-semibold">{allManagers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!isReadOnly && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant={uploadTab === "employees" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadTab("employees")}
                className={
                  uploadTab === "employees"
                    ? "bg-blue-header hover:bg-blue-700"
                    : ""
                }
              >
                <Upload className="w-4 h-4 mr-1" />
                Массовая загрузка МП
              </Button>
              <Button
                variant={uploadTab === "cities" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadTab("cities")}
                className={
                  uploadTab === "cities"
                    ? "bg-blue-header hover:bg-blue-700"
                    : ""
                }
              >
                <Upload className="w-4 h-4 mr-1" />
                Массовая загрузка городов
              </Button>
              <Button
                variant={uploadTab === "manager-cities" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadTab("manager-cities")}
                className={
                  uploadTab === "manager-cities"
                    ? "bg-blue-header hover:bg-blue-700"
                    : ""
                }
              >
                <Upload className="w-4 h-4 mr-1" />
                Массовая загрузка городов менеджеров
              </Button>
              <Button
                variant={uploadTab === "holidays" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadTab("holidays")}
                className={
                  uploadTab === "holidays"
                    ? "bg-blue-header hover:bg-blue-700"
                    : ""
                }
              >
                <Upload className="w-4 h-4 mr-1" />
                Массовая загрузка праздничных дней
              </Button>
              <Button
                variant={uploadTab === "managers" ? "default" : "outline"}
                size="sm"
                onClick={() => setUploadTab("managers")}
                className={
                  uploadTab === "managers"
                    ? "bg-blue-header hover:bg-blue-700"
                    : ""
                }
              >
                <Upload className="w-4 h-4 mr-1" />
                Массовая загрузка менеджеров
              </Button>
            </div>

            {uploadTab === "employees" && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="w-5 h-5" />
                    <span>Массовая загрузка МП</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={downloadTemplate}
                      className="flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Скачать шаблон</span>
                    </Button>
                  </div>

                  <div>
                    <Label htmlFor="csv-data">
                      CSV данные (разделитель - запятая)
                    </Label>
                    <Textarea
                      id="csv-data"
                      placeholder="firstName,lastName,middleName,phone,email,city,manager,profileImage"
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                      rows={6}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleImport}
                    disabled={isImporting || !csvData.trim() || isReadOnly}
                    className="w-full"
                  >
                    {isImporting ? "Импортирую..." : "Импортировать МП"}
                  </Button>
                </CardContent>
              </Card>
            )}
            {uploadTab === "cities" && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="w-5 h-5" />
                    <span>Массовая загрузка городов</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="cities-csv">
                      CSV города (колонки: name,region)
                    </Label>
                    <Textarea
                      id="cities-csv"
                      placeholder={`name,region\nМосква,Центральный\nСанкт-Петербург,СЗФО`}
                      value={citiesCsv}
                      onChange={(e) => setCitiesCsv(e.target.value)}
                      rows={6}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleImportCities}
                    disabled={
                      isImportingCities || !citiesCsv.trim() || isReadOnly
                    }
                    className="w-full"
                  >
                    {isImportingCities
                      ? "Импортирую города..."
                      : "Импортировать города"}
                  </Button>
                </CardContent>
              </Card>
            )}
            {uploadTab === "manager-cities" && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="w-5 h-5" />
                    <span>Массовая загрузка городов менеджеров</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="manager-cities-csv">
                      CSV связи менеджер ↔ город (колонки: managerEmail,city)
                    </Label>
                    <Textarea
                      id="manager-cities-csv"
                      placeholder={`managerEmail,city\nt.tolmacheva@sls-pharma.ru,Барнаул\nn.pervakova@sls-pharma.ru,Волгоград`}
                      value={managerCitiesCsv}
                      onChange={(e) => setManagerCitiesCsv(e.target.value)}
                      rows={6}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleImportManagerCities}
                    disabled={
                      isImportingManagerCities ||
                      !managerCitiesCsv.trim() ||
                      isReadOnly
                    }
                    className="w-full"
                  >
                    {isImportingManagerCities
                      ? "Импортирую связи..."
                      : "Импортировать города менеджеров"}
                  </Button>
                </CardContent>
              </Card>
            )}
            {uploadTab === "holidays" && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="w-5 h-5" />
                    <span>Массовая загрузка праздничных дней</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="holidays-csv">
                      CSV праздники (колонки: date,name)
                    </Label>
                    <Textarea
                      id="holidays-csv"
                      placeholder={`date,name\n2026-01-01,Новый год\n2026-01-07,Рождество`}
                      value={holidaysCsv}
                      onChange={(e) => setHolidaysCsv(e.target.value)}
                      rows={6}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleImportHolidays}
                    disabled={
                      isImportingHolidays || !holidaysCsv.trim() || isReadOnly
                    }
                    className="w-full"
                  >
                    {isImportingHolidays
                      ? "Импортирую праздники..."
                      : "Импортировать праздники"}
                  </Button>
                </CardContent>
              </Card>
            )}
            {uploadTab === "managers" && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="w-5 h-5" />
                    <span>Массовая загрузка менеджеров</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="manager-role">Роль для импорта</Label>
                    <select
                      id="manager-role"
                      value={managerRole}
                      onChange={(e) =>
                        setManagerRole(e.target.value as "manager" | "admin")
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                      disabled={isReadOnly}
                    >
                      <option value="manager">Менеджер</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manager-file">CSV файл менеджеров</Label>
                    <Input
                      id="manager-file"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) =>
                        setManagerFile(e.target.files?.[0] || null)
                      }
                      disabled={isReadOnly}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ожидаются колонки:
                      username,password,firstName,lastName,middleName,profileImage
                    </p>
                  </div>

                  <Button
                    onClick={handleImportManagers}
                    disabled={isImportingManagers || !managerFile || isReadOnly}
                    className="w-full"
                  >
                    {isImportingManagers
                      ? "Импортирую менеджеров..."
                      : "Импортировать менеджеров"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Менеджеры</CardTitle>
          </CardHeader>
          <CardContent>
            {managersLoading ? (
              <div className="text-center py-4">Загрузка...</div>
            ) : allManagers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Менеджеры пока не загружены
              </div>
            ) : (
              allManagers.map((manager) => (
                <div
                  key={manager.id}
                  className="flex items-center justify-between mb-3"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center">
                      {manager.profileImage ? (
                        <img
                          src={manager.profileImage}
                          alt={`${manager.firstName} ${manager.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-blue-600 font-semibold text-sm">
                          {manager.firstName.charAt(0)}
                          {manager.lastName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {manager.lastName} {manager.firstName}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReadOnly}
                    onClick={() => {
                      if (isReadOnly) return;
                      deleteManagerMutation.mutate(manager.id);
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="mb-4 flex border-b">
          <button
            type="button"
            className={`px-4 py-2 text-sm ${
              activeTab === "reps"
                ? "border-b-2 border-blue-600 font-semibold"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("reps")}
          >
            МП
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm ${
              activeTab === "plans"
                ? "border-b-2 border-blue-600 font-semibold"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("plans")}
          >
            Внесение (планы менеджеров)
          </button>
        </div>

        {activeTab === "reps" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Все медицинские представители</CardTitle>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="text-center py-4">Загрузка...</div>
              ) : allEmployees.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    МП пока не загружены
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Используйте форму выше для массовой загрузки
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allEmployees.map((employee: EmployeeWithDetails) => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">
                            {employee.firstName.charAt(0)}
                            {employee.lastName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {employee.lastName} {employee.firstName}{" "}
                            {employee.middleName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {employee.city?.name}
                            {employee.city?.region
                              ? ` (${employee.city.region})`
                              : ""}{" "}
                            • {employee.manager?.lastName}{" "}
                            {employee.manager?.firstName}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {employee.position}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "plans" && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setCurrentDate(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle>
                    {currentDate.toLocaleString("ru-RU", {
                      month: "long",
                      year: "numeric",
                    })}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setCurrentDate(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm">Менеджер:</span>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={selectedManagerId ?? ""}
                    onChange={(e) =>
                      setSelectedManagerId(e.target.value || null)
                    }
                  >
                    <option value="">Все</option>
                    {uniqueManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="text-center py-4">Загрузка...</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(weeksInMonth).map(([weekNumber, days]) => (
                    <div key={weekNumber} className="space-y-2">
                      <h2 className="text-base font-semibold">
                        Неделя {weekNumber}
                      </h2>

                      <div className="space-y-2 pl-4 border-l border-muted">
                        {days.map((day) => {
                          const dayActivities = selectedManagerId
                            ? day.activities.filter(
                                (activity) =>
                                  activity.managerName === selectedManagerId,
                              )
                            : day.activities;

                          return (
                            <div
                              key={day.date.toISOString()}
                              className="space-y-2"
                            >
                              <h3 className="text-sm font-semibold text-muted-foreground">
                                {day.date.toLocaleDateString("ru-RU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  weekday: "short",
                                })}
                              </h3>

                              {dayActivities.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  Нет активностей
                                </p>
                              ) : (
                                dayActivities.map((activity) => (
                                  <div
                                    key={activity.id}
                                    className="p-3 border rounded-lg flex items-start justify-between gap-2"
                                  >
                                    <div className="flex flex-col min-w-0">
                                      <p className="font-medium">
                                        {activity.type?.name} •{" "}
                                        {activity.employee?.lastName}{" "}
                                        {activity.employee?.firstName}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {activity.city?.name} •{" "}
                                        {new Date(
                                          activity.startDate,
                                        ).toLocaleString("ru-RU", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}{" "}
                                        —{" "}
                                        {new Date(
                                          activity.endDate,
                                        ).toLocaleString("ru-RU", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}{" "}
                                        • менеджер: {activity.managerName}
                                      </p>
                                    </div>
                                    {confirmingId === activity.id ? (
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          disabled={deleteActivityMutation.isPending}
                                          onClick={() => {
                                            deleteActivityMutation.mutate(activity.id, {
                                              onSuccess: () => setConfirmingId(null),
                                            });
                                          }}
                                        >
                                          {deleteActivityMutation.isPending ? "…" : "Да, удалить"}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          disabled={deleteActivityMutation.isPending}
                                          onClick={() => setConfirmingId(null)}
                                        >
                                          Отмена
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => setConfirmingId(activity.id)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Удалить
                                      </Button>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <BottomNavigation />
      </div>

    </div>
  );
}
