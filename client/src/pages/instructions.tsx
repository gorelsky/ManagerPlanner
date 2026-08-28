import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import { useAuth } from "@/contexts/auth-context";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

const roleNames: Record<string, string> = {
  manager: "Менеджер",
  director: "Директор по продажам",
  hr_director: "HR-директор",
  admin: "Администратор",
};

export default function Instructions() {
  const { user } = useAuth();
  const role = user?.role || "manager";
  const canCreate = role === "manager" || role === "admin" || role === "director";
  const canApprove = role === "director" || role === "admin";
  const canAdminister = role === "admin";

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-blue-header text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <SideMenu />
          <h1 className="text-lg font-semibold">Инструкция по работе</h1>
          <Badge variant="outline" className="bg-white/10 text-white border-white/20">
            {roleNames[role] || "Пользователь"}
          </Badge>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              Быстрый старт
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Используйте нижнее меню для перехода между планами, аналитикой, отчётами и чатом.</p>
            <p>Боковое меню открывает профиль, эту инструкцию и выход из приложения.</p>
            <p>При переходе в новый раздел страница автоматически открывается сверху.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="w-5 h-5 text-emerald-600" />
              Планы и календарь
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {canCreate ? (
              <p>Для создания плана откройте раздел планов, нажмите кнопку добавления и заполните тип активности, даты, город и остальные обязательные поля.</p>
            ) : (
              <p>Ваша роль предназначена для просмотра планов всех менеджеров без создания и редактирования.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <Badge variant="secondary">Создан</Badge>
                <p className="mt-2 text-muted-foreground">План отправлен и ожидает решения директора.</p>
              </div>
              <div className="rounded-md border border-emerald-300 p-3">
                <Badge className="bg-emerald-600">Утверждён</Badge>
                <p className="mt-2 text-muted-foreground">План согласован и готов к выполнению.</p>
              </div>
              <div className="rounded-md border border-red-300 bg-red-50 p-3">
                <Badge variant="destructive">Отклонён</Badge>
                <p className="mt-2 text-muted-foreground">План необходимо исправить и отправить повторно.</p>
              </div>
            </div>
            <p className="rounded-md bg-yellow-100 p-3 text-yellow-900">
              Жёлтая заливка означает, что утверждённый завершившийся план ещё не отмечен менеджером как выполненный.
            </p>
          </CardContent>
        </Card>

        {canApprove && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
                Согласование планов
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>В разделе планов доступны активности всех менеджеров и фильтры по сотруднику, статусу, типу и городу.</p>
              <p>Проверьте данные плана и выберите «Утвердить» или «Отклонить». После решения статус сразу станет виден менеджеру.</p>
            </CardContent>
          </Card>
        )}

        {role === "manager" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Завершение плана
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>После окончания утверждённого плана откройте его карточку и отметьте как выполненный.</p>
              <p>Список закреплённых медицинских представителей доступен в разделе «МП».</p>
            </CardContent>
          </Card>
        )}

        {canAdminister && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-orange-600" />
                Администрирование
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>В админ-панели доступны импорт и просмотр менеджеров, медицинских представителей, городов, закреплений городов и праздничных дней.</p>
              <p>Перед удалением пользователя или МП внимательно проверьте выбранную запись и подтвердите действие.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-5 h-5 text-blue-600" />Аналитика
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Выберите неделю, месяц или квартал. Многодневные активности учитываются в каждом дне своего интервала.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="w-5 h-5 text-emerald-600" />Чат
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Откройте раздел «Чат», выберите собеседника и отправьте сообщение внутри приложения.
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
}
