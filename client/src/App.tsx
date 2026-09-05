import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { StatusBar } from "@/components/status-bar";
import Dashboard from "@/pages/dashboard";
import Representatives from "@/pages/representatives";
import Analytics from "@/pages/analytics";
import Chat from "@/pages/chat";
import Admin from "@/pages/admin";
import Reports from "@/pages/reports";
import Instructions from "@/pages/instructions";
import Profile from "@/pages/profile";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return null;
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (user.mustChangePassword && location !== "/profile") {
    return <Redirect to="/profile" />;
  }

  const RepresentativesRoute = () =>
    user.role === "manager" ? <Representatives /> : <Redirect to="/" />;

  // Все маршруты объявлены прямо здесь, без условий.
  // Проверка прав теперь внутри компонентов Admin и Reports.
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/reps" component={RepresentativesRoute} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/chat" component={Chat} />
      <Route path="/admin" component={Admin} />
      <Route path="/reports" component={Reports} />
      <Route path="/instructions" component={Instructions} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ScrollToTop />
          <div className="min-h-screen bg-background flex">
            <div className="flex-1">
              <Toaster />
              <StatusBar />
              <Router />
            </div>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
