import { Link, useLocation } from "wouter";
import { PenTool, BarChart3, Users, MessageCircle, Settings, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [];

  if (user?.role === "hr_director") {
    navItems.push({
      path: "/",
      icon: PenTool,
      label: "Планы",
      testId: "nav-plans",
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
  } else if (user?.role === "director") {
    // Директор: Планы → Админ → Отчёты → Чат
    navItems.push({
      path: "/",
      icon: PenTool,
      label: "Планы",
      testId: "nav-plans",
    });

    navItems.push({
      path: "/admin",
      icon: Settings,
      label: "Админ",
      testId: "nav-admin",
    });

    navItems.push({
      path: "/reports",
      icon: BarChart2, // или другой значок, можно BarChart3
      label: "Отчёты",
      testId: "nav-reports",
    });

    navItems.push({
      path: "/chat",
      icon: MessageCircle,
      label: "Чат",
      testId: "nav-chat",
    });
  } else {
    // Менеджер и администратор: Внесение, Аналитика, Чат.
    // Персональный список МП доступен только менеджеру.
    navItems.push({
      path: "/",
      icon: PenTool,
      label: "Внесение",
      testId: "nav-entry",
    });

    if (user?.role === "manager") {
      navItems.push({
        path: "/reps",
        icon: Users,
        label: "МП",
        testId: "nav-reps",
      });
    }

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

    if (user?.role === "admin") {
      navItems.push({
        path: "/admin",
        icon: Settings,
        label: "Админ",
        testId: "nav-admin",
      });

      navItems.push({
        path: "/reports",
        icon: BarChart2,
        label: "Отчёты",
        testId: "nav-reports",
      });
    }
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
