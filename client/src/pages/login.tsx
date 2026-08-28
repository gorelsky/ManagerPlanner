import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/logo.jpg";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Вход выполняется через сервер приложения и таблицу users.
      const localResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!localResponse.ok) {
        const error = await localResponse.json().catch(() => null);
        throw new Error(error?.message || "Неверный логин или пароль");
      }
      const serverUser = await localResponse.json();

      await login(serverUser);

      toast({
        title: "Вход выполнен успешно",
        description: `Добро пожаловать, ${serverUser.firstName || serverUser.email}!`,
      });

      // Очищаем поля
      setUsername("");
      setPassword("");
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось выполнить вход. Попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f7f7ff] via-white to-[#e8e7ff] p-4 flex items-center justify-center">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="relative w-full max-w-md mx-auto">
        <div className="text-center mb-7">
          <div className="mx-auto w-44 h-28 mb-4 flex items-center justify-center rounded-3xl bg-white shadow-xl shadow-primary/10 border border-white">
            <img
              src={logo}
              alt="Логотип"
              className="h-24 w-40 rounded-2xl object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            Планировщик для ТМ
          </h1>
          <p className="text-muted-foreground">
            Система управления активностями
          </p>
        </div>

        <Card className="border-white/80 bg-white/90 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Вход в систему
            </CardTitle>
            <p className="text-sm text-muted-foreground text-center">
              Введите ваши учетные данные для входа
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Email</Label>
                <Input
                  id="username"
                  type="email"
                  placeholder="Введите email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  data-testid="input-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !username || !password}
                data-testid="button-login"
              >
                {isLoading ? "Вход..." : "Войти"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
