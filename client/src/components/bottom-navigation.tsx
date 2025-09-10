import { Link, useLocation } from "wouter";
import { PenTool, BarChart3, Users, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNavigation() {
  const [location] = useLocation();

  const navItems = [
    { 
      path: "/", 
      icon: PenTool, 
      label: "Внесение",
      testId: "nav-entry"
    },
    { 
      path: "/analytics", 
      icon: BarChart3, 
      label: "МП",
      testId: "nav-analytics"
    },
    { 
      path: "/visits", 
      icon: Users, 
      label: "Визит Эквивалент",
      testId: "nav-visits"
    },
    { 
      path: "/chat", 
      icon: MessageCircle, 
      label: "Чат",
      testId: "nav-chat"
    },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-sm bg-card border-t border-border" data-testid="bottom-navigation">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ path, icon: Icon, label, testId }) => (
          <Link key={path} href={path}>
            <button 
              className={cn(
                "flex flex-col items-center space-y-1 p-2 transition-colors",
                location === path 
                  ? "text-blue-600" 
                  : "text-muted-foreground hover:text-foreground"
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
