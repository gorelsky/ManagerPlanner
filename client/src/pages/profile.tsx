import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, UserRound } from "lucide-react";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Не удалось изменить пароль";
  try {
    const payload = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
    return payload.message || "Не удалось изменить пароль";
  } catch {
    return "Не удалось изменить пароль";
  }
}

export default function Profile() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({ title: "Пароли не совпадают", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      toast({
        title: "Пароль изменён",
        description: "Войдите в приложение с новым паролем.",
      });
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      logout();
    } catch (error) {
      toast({ title: "Ошибка", description: errorMessage(error), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-blue-header text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <SideMenu />
          <h1 className="text-lg font-semibold">Личный кабинет</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl p-4 space-y-4">
        {user?.mustChangePassword && (
          <Card className="border-amber-300 bg-amber-50 text-amber-950">
            <CardContent className="flex gap-3 pt-6">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Необходимо сменить временный пароль</p>
                <p className="mt-1 text-sm">
                  До смены пароля остальные разделы приложения будут недоступны.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              {user?.firstName} {user?.middleName} {user?.lastName}
            </CardTitle>
            <CardDescription>Логин для входа: {user?.username}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Смена пароля
            </CardTitle>
            <CardDescription>
              Новый пароль должен содержать не менее 10 символов, хотя бы одну букву и одну цифру.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Текущий пароль</Label>
                <Input
                  id="current-password"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Новый пароль</Label>
                <Input
                  id="new-password"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Повторите новый пароль</Label>
                <Input
                  id="confirm-password"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  required
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                className="px-0 text-muted-foreground hover:bg-transparent"
                onClick={() => setShowPasswords((value) => !value)}
              >
                {showPasswords ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {showPasswords ? "Скрыть пароли" : "Показать пароли"}
              </Button>

              <Button type="submit" className="w-full" disabled={isSaving}>
                {!isSaving && <CheckCircle2 className="mr-2 h-4 w-4" />}
                {isSaving ? "Сохраняем..." : "Изменить пароль"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
}
