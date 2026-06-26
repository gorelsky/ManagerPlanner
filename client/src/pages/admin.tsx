import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, Users, Settings } from "lucide-react";

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
import { employeeApi, userApi, activityApi, cityApi } from "@/lib/api";
import type { EmployeeWithDetails, ActivityWithDetails } from "@shared/schema";

export default function Admin() {
  const [csvData, setCsvData] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [managerFile, setManagerFile] = useState<File | null>(null);
  const [managerRole, setManagerRole] = useState<"manager" | "admin">("manager");
  const [isImportingManagers, setIsImportingManagers] = useState(false);

  // NEW: состояние для импорта городов
  const [citiesCsv, setCitiesCsv] = useState("");
  const [isImportingCities, setIsImportingCities] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Только для админов
  if (user?.role !== "admin") {
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

  const {
    data: allActivities = [],
    isLoading: activitiesLoading,
  } = useQuery({
    queryKey: ["/api/activities/all"],
    queryFn: () => activityApi.getAllActivities(),
  });

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
    onSuccess: (_data, deletedId) => {
      queryClient.setQueryData(
        ["/api/activities/all"],
        (old: ActivityWithDetails[] | undefined) =>
          (old ?? []).filter((activity) => activity.id !== deletedId)
      );
      toast({
        title: "Активность удалена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка удаления активности",
        description: error.message || "Не удалось удалить активность",
        variant: "destructive",
      });
    },
  });

  // NEW: мутация для импорта городов
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

  const handleImport = () => {
    if (!csvData.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите данные для импорта",
        variant: "destructive",
      });
      return;
    }
    setIsImporting(true);
    importEmployeesMutation.mutate(csvData);
  };

  const handleImportManagers = async () => {
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

  // NEW: обработчик импорта городов
  const handleImportCities = () => {
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

  const downloadTemplate = () => {
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
      {/* Header */}
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
        {/* Stats Cards */}
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

        {/* Import Employees Section */}
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
                data-testid="button-download-template"
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
                data-testid="textarea-csv-data"
              />
            </div>

            <Button
              onClick={handleImport}
              disabled={isImporting || !csvData.trim()}
              className="w-full"
              data-testid="button-import"
            >
              {isImporting ? "Импортирую..." : "Импортировать МП"}
            </Button>
          </CardContent>
        </Card>

        {/* NEW: Import Cities Section */}
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
              disabled={isImportingCities || !citiesCsv.trim()}
              className="w-full"
            >
              {isImportingCities
                ? "Импортирую города..."
                : "Импортировать города"}
            </Button>
          </CardContent>
        </Card>

        {/* Managers Import Section */}
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
              />
              <p className="text-xs text-muted-foreground">
                Ожидаются колонки:
                username,password,firstName,lastName,middleName,profileImage
              </p>
            </div>

            <Button
              onClick={handleImportManagers}
              disabled={isImportingManagers || !managerFile}
              className="w-full"
            >
              {isImportingManagers
                ? "Импортирую менеджеров..."
                : "Импортировать менеджеров"}
            </Button>
          </CardContent>
        </Card>

        {/* Managers List */}
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
                    onClick={() => deleteManagerMutation.mutate(manager.id)}
                  >
                    Удалить
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* All Employees */}
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
                          {employee.city?.region ? ` (${employee.city.region})` : ""} •{" "}
                          {employee.manager?.lastName} {employee.manager?.firstName}
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

        {/* All Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Все активности</CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="text-center py-4">Загрузка...</div>
            ) : allActivities.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Активности пока не созданы
              </div>
            ) : (
              <div className="space-y-3">
                {allActivities.map((activity: ActivityWithDetails) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex flex-col">
                      <p className="font-medium">
                        {activity.type?.name} •{" "}
                        {activity.employee?.lastName}{" "}
                        {activity.employee?.firstName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activity.date} • {activity.user?.lastName}{" "}
                        {activity.user?.firstName}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        deleteActivityMutation.mutate(activity.id)
                      }
                    >
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <BottomNavigation />
      </div>
    </div>
  );
}