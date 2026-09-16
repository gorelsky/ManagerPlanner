import { Link, useLocation } from "wouter";
import { PenTool, BarChart3, Users, MessageCircle, Settings, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/messages/unread-count")).json(),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

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
      className="fixed bottom-2 left-1/2 z-40 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-white/70 bg-card/95 px-1 shadow-xl shadow-primary/10 backdrop-blur-xl"
      data-testid="bottom-navigation"
    >
      <div className="flex items-center justify-around py-1.5">
        {navItems.map(({ path, icon: Icon, label, testId }) => (
          <Link key={path} href={path} className="min-w-0 flex-1">
            <button
              className={cn(
                "mx-auto flex min-h-12 w-full min-w-0 flex-col items-center justify-center space-y-0.5 rounded-xl px-1.5 py-1.5 transition-all duration-200",
                location === path
                  ? "bg-primary/10 text-primary shadow-inner"
                  : "text-muted-foreground hover:bg-accent hover:text-primary",
              )}
              data-testid={testId}
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                {path === "/chat" && (unread?.count ?? 0) > 0 && (
                  <span className="absolute -right-3 -top-2 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white"
                    role="status" aria-label={`Непрочитанных сообщений: ${unread!.count}`}>
                    {unread!.count > 99 ? "99+" : unread!.count}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate text-[11px] font-semibold">{label}</span>
            </button>
          </Link>
        ))}
      </div>
    </nav>
  );
}
