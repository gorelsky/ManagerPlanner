import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut, User, Shield, BookOpen, KeyRound, Undo2 } from "lucide-react";
import { Link } from "wouter";
import { userApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function SideMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isReturning, setIsReturning] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    logout();
    window.location.assign("/");
  };

  const handleStopTestLogin = async () => {
    setIsReturning(true);
    try {
      await userApi.stopTestLogin();
      window.location.assign("/");
    } catch (error) {
      toast({
        title: "Не удалось вернуться",
        description: error instanceof Error ? error.message : "Повторите попытку",
        variant: "destructive",
      });
    } finally {
      setIsReturning(false);
    }
  };

  const roleLabel =
    user.role === "admin"
      ? "Администратор"
      : user.role === "director"
      ? "Директор"
      : user.role === "hr_director"
      ? "HR-директор"
      : "Менеджер";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="text-white" data-testid="button-menu">
          <Menu className="w-6 h-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[86%] sm:max-w-sm bg-blue-header text-white border-white/10 shadow-2xl">
        <SheetHeader>
          <SheetTitle className="text-white text-left">
            <div className="flex items-center space-x-2">
              {user.profileImage ? (
                <img
                  src={user.profileImage}
                  alt="Фото пользователя"
                  className="w-10 h-10 rounded-full object-cover bg-white/20"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">
                  {user.firstName} {user.middleName} {user.lastName}
                </p>
                <p className="text-xs text-white/70">{roleLabel}</p>
                {user.username && (
                  <p className="text-xs text-green-50">
                    Отправить письмо с адреса{" "}
                    <a
                      href={`mailto:${user.username}`}
                      className="underline"
                      data-testid="user-email-link"
                    >
                      {user.username}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-8 flex flex-col space-y-2">
          <div className="px-4 py-3 rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm">
            <p className="text-xs text-white/60">Логин</p>
            <p className="text-sm font-medium">@{user.username}</p>
          </div>

          {user.isImpersonating && (
            <div className="rounded-xl border border-amber-200/40 bg-amber-300/20 p-4">
              <p className="text-sm font-semibold text-amber-50">Тестовый вход администратора</p>
              <p className="mt-1 text-xs text-amber-50/80">
                Сейчас отображается приложение с правами этого пользователя.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-white/30 bg-white/10 text-white hover:bg-white/25 hover:text-white"
                onClick={handleStopTestLogin}
                disabled={isReturning}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                {isReturning ? "Возвращаемся..." : "Вернуться администратором"}
              </Button>
            </div>
          )}

          {user.role === "admin" && (
            <div className="px-4 py-3 rounded-xl border border-white/10 bg-white/10 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-yellow-200" />
              <span className="text-sm">Права администратора</span>
            </div>
          )}

          <Link href="/instructions" onClick={() => setOpen(false)}>
            <div
              className="px-4 py-3 rounded-xl border border-white/10 bg-white/10 hover:bg-white/20 transition-colors flex items-center space-x-2 cursor-pointer"
              data-testid="link-instructions"
            >
              <BookOpen className="w-4 h-4 text-green-100" />
              <span className="text-sm font-medium">Инструкция по работе</span>
            </div>
          </Link>

          <Link href="/profile" onClick={() => setOpen(false)}>
            <div
              className="px-4 py-3 rounded-xl border border-white/10 bg-white/10 hover:bg-white/20 transition-colors flex items-center space-x-2 cursor-pointer"
              data-testid="link-profile"
            >
              <KeyRound className="w-4 h-4 text-yellow-100" />
              <span className="text-sm font-medium">Личный кабинет и пароль</span>
            </div>
          </Link>

          <div className="mt-auto pt-8">
            <Button
              variant="outline"
              className="w-full bg-white/10 text-white border-white/20 hover:bg-white/40 hover:text-white"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Выйти из кабинета
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
