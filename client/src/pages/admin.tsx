import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Plus, Download, Users, Settings } from "lucide-react";
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
import { employeeApi, userApi } from "@/lib/api";
import type { EmployeeWithDetails, User } from "@shared/schema";

export default function Admin() {
  const [csvData, setCsvData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Только для админов
  if (user?.role !== "admin") {
    return (
      <div className="p-4 text-center">
        <h1 className="text-xl font-semibold mb-4">Доступ запрещен</h1>
        <p className="text-muted-foreground">Эта страница доступна только администраторам</p>
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

  const downloadTemplate = () => {
    const template = `firstName,lastName,middleName,phone,email,city,manager,profileImage
Иван,Петров,Сергеевич,+7(900)123-45-67,i.petrov@company.ru,Москва,pervakova,https://example.com/photo1.jpg
Анна,Сидорова,Михайловна,+7(900)234-56-78,a.sidorova@company.ru,Санкт-Петербург,pervakova,https://example.com/photo2.jpg`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_employees.csv';
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
          <Badge variant="outline" className="bg-white/10 text-white border-white/20">
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

      {/* Import Section */}
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
            <Label htmlFor="csv-data">CSV данные (разделитель - запятая)</Label>
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

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle>Все медицинские представители</CardTitle>
        </CardHeader>
        <CardContent>
          {employeesLoading ? (
            <div className="text-center py-4">Загрузка...</div>
          ) : allEmployees.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">МП пока не загружены</p>
              <p className="text-sm text-muted-foreground">
                Используйте форму выше для массовой загрузки
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allEmployees.map((employee: EmployeeWithDetails) => (
                <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {employee.lastName} {employee.firstName} {employee.middleName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {employee.city?.name} • {employee.manager?.lastName} {employee.manager?.firstName}
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

      <BottomNavigation />
    </div>
    </div>
  );
}