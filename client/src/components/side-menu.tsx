import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut, User, Shield, BookOpen } from "lucide-react";
import { Link } from "wouter";

export default function SideMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogout = () => {
    setOpen(false);
    logout();
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
      <SheetContent side="left" className="w-3/4 sm:max-w-xs bg-blue-header text-white border-blue-500">
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
          <div className="px-4 py-3 rounded-lg bg-white/10">
            <p className="text-xs text-white/60">Логин</p>
            <p className="text-sm font-medium">@{user.username}</p>
          </div>

          {user.role === "admin" && (
            <div className="px-4 py-3 rounded-lg bg-white/10 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-yellow-200" />
              <span className="text-sm">Права администратора</span>
            </div>
          )}

          <Link href="/instructions" onClick={() => setOpen(false)}>
            <div
              className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center space-x-2 cursor-pointer"
              data-testid="link-instructions"
            >
              <BookOpen className="w-4 h-4 text-green-100" />
              <span className="text-sm font-medium">Инструкция по работе</span>
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
