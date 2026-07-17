import type { User } from "@shared/schema";

interface UserProfileProps {
  user: User;
}

export default function UserProfile({ user }: UserProfileProps) {
  return (
    <div className="flex items-center space-x-3 mb-4" data-testid="user-profile">
      <img 
        src={user.profileImage || "/employees-photos/Little_logo.jpg"}
        alt="Профиль пользователя" 
        className="w-16 h-16 rounded-xl object-cover border-2 border-white/20"
        data-testid="user-avatar"
      />
      <div>
        <h2 className="text-lg font-medium text-white" data-testid="user-name">
          {user.lastName} {user.firstName}
        </h2>
        <p className="text-blue-100 text-sm" data-testid="user-middle-name">
          {user.middleName}
        </p>
      </div>
    </div>
  );
}
