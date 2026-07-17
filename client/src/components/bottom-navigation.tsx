import { Link, useLocation } from "wouter";
import { PenTool, BarChart3, Users, MessageCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [];

  if (user?.role === "director") {
    // Директор: сначала Админ, потом Чат
    navItems.push({
      path: "/admin",
      icon: Settings,
      label: "Админ",
      testId: "nav-admin",
    });
    navItems.push({
      path: "/chat",
      icon: MessageCircle,
      label: "Чат",
      testId: "nav-chat",
    });
  } else {
    // Все остальные: пользовательские панели + чат
    navItems.push({
      path: "/",
      icon: PenTool,
      label: "Внесение",
      testId: "nav-entry",
    });
    navItems.push({
      path: "/reps",
      icon: Users,
      label: "МП",
      testId: "nav-reps",
    });
    navItems.push({
      path: "/analytics",
      icon: BarChart3,
      label: "Аналитика",
      testId: "nav-analytics",
    });
    navItems.push({
      path: "/chat",
      icon: MessageCircle,
      label: "Чат",
      testId: "nav-chat",
    });

    // Админ — только админу (у директора уже выше обработано отдельно)
    if (user?.role === "admin") {
      navItems.push({
        path: "/admin",
        icon: Settings,
        label: "Админ",
        testId: "nav-admin",
      });
    }
  }
  
  //Для директора и админа добавлены Отчеты
if (user?.role === "admin" || user?.role === "director") {
  navItems.push({
    path: "/reports",
    icon: BarChart3, // или другой
    label: "Отчёты",
    testId: "nav-reports",
  });
}
  return (
    <nav
      className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-sm bg-card border-t border-border"
      data-testid="bottom-navigation"
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ path, icon: Icon, label, testId }) => (
          <Link key={path} href={path}>
            <button
              className={cn(
                "flex flex-col items-center space-y-1 p-2 transition-colors",
                location === path
                  ? "text-blue-600"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={testId}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          </Link>
        ))}
      </div>
    </nav>
  );
}