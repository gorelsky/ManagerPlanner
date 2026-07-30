import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings } from "lucide-react";

export default function UserMenu() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const firstInitial = user.firstName?.[0] ?? "";
  const lastInitial = user.lastName?.[0] ?? "";
  const initials = `${firstInitial}${lastInitial}` || "U";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Пользователь";

  const handleLogout = () => {
    logout();
  };

  const roleLabel =
    user.role === "admin"
      ? "Администратор"
      : user.role === "director"
      ? "Директор"
      : "Менеджер";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full"
          data-testid="button-user-menu"
        >
          <Avatar className="h-10 w-10">
            {user.profileImage ? (
              <AvatarImage src={user.profileImage} alt={fullName} />
            ) : null}
            <AvatarFallback className="bg-blue-100 text-blue-600">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{fullName}</p>
            {user.username && (
              <p className="text-xs leading-none text-muted-foreground">
                @{user.username}
              </p>
            )}
            <p className="text-xs leading-none text-muted-foreground capitalize">
              {roleLabel}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <User className="mr-2 h-4 w-4" />
          <span>Профиль</span>
        </DropdownMenuItem>

        <DropdownMenuItem disabled>
          <Settings className="mr-2 h-4 w-4" />
          <span>Настройки</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Выйти</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}