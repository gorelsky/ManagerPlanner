import { useQuery } from "@tanstack/react-query";
import { Plus, Phone, Mail, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import UserProfile from "@/components/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { employeeApi } from "@/lib/api";
import type { EmployeeWithDetails } from "@shared/schema";

export default function Representatives() {
  const { user } = useAuth();

  const { data: representatives = [], isLoading } = useQuery({
    queryKey: ["/api/employees/manager", user?.id],
    queryFn: () => employeeApi.getEmployeesByManager(user?.id!),
    enabled: !!user?.id,
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
    <div className="pb-20">
      <header className="bg-blue-header text-white px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <SideMenu />
          <h1 className="text-lg font-semibold">Медицинские представители</h1>
          <div></div>
        </div>
        {/* Профиль текущего менеджера */}
        {user && <UserProfile user={user} />}
      </header>

      <div className="p-4">
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
            {representatives.map((rep: EmployeeWithDetails) => (
              <Card
                key={rep.id}
                className="p-4"
                data-testid={`card-representative-${rep.id}`}
              >
                <div className="flex items-start space-x-4">
                  <Avatar className="w-16 h-16">
                    {rep.profileImage ? (
                      <AvatarImage
                        src={rep.profileImage}
                        alt={`${rep.firstName} ${rep.lastName}`}
                      />
                    ) : null}
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
                      {getInitials(rep.firstName, rep.lastName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3
                          className="font-semibold text-foreground text-lg"
                          data-testid={`text-name-${rep.id}`}
                        >
                          {rep.lastName} {rep.firstName}
                          {rep.middleName && ` ${rep.middleName}`}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {rep.position || "Медицинский представитель"}
                          {rep.city?.region ? ` (${rep.city.region} регион)` : ""}
                          {rep.city?.name && " • локация г. "}
                          {rep.city?.name}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        МП
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      {rep.phone && (
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          {/* Телефон как ссылка tel: */}
                          <a
                            href={`tel:${rep.phone}`}
                            className="hover:underline"
                            aria-label={`Позвонить по номеру ${rep.phone}`}
                          >
                            {rep.phone}
                          </a>
                        </div>
                      )}

                      {rep.email && (
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          {/* Email как ссылка mailto: */}
                          <a
                            href={`mailto:${rep.email}`}
                            className="hover:underline"
                            aria-label={`Написать письмо на ${rep.email}`}
                          >
                            {rep.email}
                          </a>
                        </div>
                      )}

                      {rep.city && (
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{rep.city.name}</span>
                        </div>
                      )}

                      {rep.manager && (
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <User className="w-4 h-4" />
                          <span>
                            Менеджер: {rep.manager.lastName} {rep.manager.firstName} {rep.manager.middleName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Блок действий убран: редактирование и активности не нужны */}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}