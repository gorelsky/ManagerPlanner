import { useQuery } from "@tanstack/react-query";
import { Plus, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/bottom-navigation";
import { employeeApi } from "@/lib/api";
import type { Employee } from "@shared/schema";

export default function Representatives() {
  const userId = "8f4eb15b-8b68-4cf1-bebe-8f5e7c2d9b41"; // TODO: Get from auth context

  const { data: representatives = [], isLoading } = useQuery({
    queryKey: ["/api/employees/manager", userId],
    queryFn: () => employeeApi.getEmployeesByManager(userId),
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="text-center">Загрузка...</div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Медицинские представители
        </h1>
        <Button size="sm" data-testid="button-add-representative">
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>

      {representatives.length === 0 ? (
        <Card className="text-center py-8" data-testid="empty-representatives">
          <CardContent>
            <div className="text-muted-foreground mb-4">
              У вас пока нет закрепленных медицинских представителей
            </div>
            <Button data-testid="button-add-first-representative">
              <Plus className="w-4 h-4 mr-2" />
              Добавить первого МП
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {representatives.map((rep: Employee) => (
            <Card key={rep.id} className="p-4" data-testid={`card-representative-${rep.id}`}>
              <div className="flex items-start space-x-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {getInitials(rep.firstName, rep.lastName)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground" data-testid={`text-name-${rep.id}`}>
                      {rep.lastName} {rep.firstName}
                      {rep.middleName && ` ${rep.middleName}`}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      МП
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4" />
                      <span>+7 (900) 123-45-67</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4" />
                      <span>{rep.firstName.toLowerCase()}.{rep.lastName.toLowerCase()}@company.ru</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>Москва, Центральный округ</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" size="sm" data-testid={`button-edit-${rep.id}`}>
                      Редактировать
                    </Button>
                    <Button variant="outline" size="sm" data-testid={`button-activities-${rep.id}`}>
                      Активности
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}