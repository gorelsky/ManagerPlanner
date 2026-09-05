import type { PublicUser } from "@shared/schema";

interface UserProfileProps {
  user: PublicUser;
}

export default function UserProfile({ user }: UserProfileProps) {
  return (
    <div className="flex items-center space-x-3 mb-4 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm" data-testid="user-profile">
      <img 
        src={user.profileImage || "/employees-photos/Little_logo.jpg"}
        alt="Профиль пользователя" 
        className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30 shadow-lg"
        data-testid="user-avatar"
      />
      <div>
        <h2 className="text-lg font-semibold text-white" data-testid="user-name">
          {user.lastName} {user.firstName}
        </h2>
        <p className="text-blue-100 text-sm" data-testid="user-middle-name">
          {user.middleName}
        </p>
      </div>
    </div>
  );
}
