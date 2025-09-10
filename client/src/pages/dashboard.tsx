import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu, Search, Plus } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import UserProfile from "@/components/user-profile";
import UserMenu from "@/components/user-menu";
import DateNavigation from "@/components/date-navigation";
import ActivityCard from "@/components/activity-card";
import CreateActivityModal from "@/components/create-activity-modal";
import BottomNavigation from "@/components/bottom-navigation";
import { useAuth } from "@/contexts/auth-context";
import { userApi, activityApi } from "@/lib/api";
import type { ActivityWithDetails } from "@shared/schema";

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["/api/activities/user", user?.id, startDate, endDate],
    queryFn: () => activityApi.getActivitiesByUser(user?.id!, startDate, endDate),
    enabled: !!user?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      activityApi.updateActivityStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/user", user?.id] });
      toast({
        title: "Успешно",
        description: "Статус активности обновлен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive",
      });
    },
  });

  const handlePreviousMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleMarkComplete = (id: string) => {
    updateStatusMutation.mutate({ id, status: "completed" });
  };

  const handleEdit = (id: string) => {
    // TODO: Implement edit functionality
    toast({
      title: "В разработке",
      description: "Функция редактирования будет добавлена",
    });
  };

  const handleCancel = (id: string) => {
    updateStatusMutation.mutate({ id, status: "cancelled" });
  };

  // Filter activities by search term
  const filteredActivities = activities.filter(activity =>
    activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.city.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const dateKey = format(new Date(activity.startDate), "yyyy-MM-dd");
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
    return groups;
  }, {} as Record<string, ActivityWithDetails[]>);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Status Bar */}
      <div className="flex justify-between items-center px-4 py-2 text-white text-sm bg-blue-header">
        <span>3:44</span>
        <div className="flex space-x-1">
          <div className="w-4 h-3 bg-white/60 rounded-sm"></div>
          <div className="w-4 h-3 bg-white/60 rounded-sm"></div>
          <div className="w-4 h-3 bg-white rounded-sm"></div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-blue-header text-white px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <button className="text-white" data-testid="button-menu">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">План-факт активностей</h1>
          <div></div>
        </div>

        <UserProfile user={user} />

        <div className="flex justify-between items-center">
          <h3 className="text-white font-medium">План-факт активностей</h3>
          <Button 
            className="bg-white text-blue-600 hover:bg-blue-50" 
            onClick={() => setCreateModalOpen(true)}
            data-testid="button-add-activity"
          >
            <Plus className="w-4 h-4 mr-1" /> Добавь
          </Button>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="px-4 py-4 bg-card">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            type="text" 
            placeholder="Поиск" 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>

        <DateNavigation
          currentDate={currentDate}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
        />
      </div>

      {/* Activities List */}
      <div className="px-4">
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Загрузка активностей...</p>
          </div>
        ) : Object.keys(groupedActivities).length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Нет активностей для отображения</p>
          </div>
        ) : (
          Object.entries(groupedActivities)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateKey, dayActivities]) => (
              <div key={dateKey} className="mb-6">
                <h5 className="text-sm font-medium text-muted-foreground mb-3" data-testid="day-header">
                  {format(new Date(dateKey), "d MMMM, EEEEEE", { locale: ru })}
                </h5>
                {dayActivities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onMarkComplete={handleMarkComplete}
                    onEdit={handleEdit}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            ))
        )}
      </div>

      {/* Floating Action Button */}
      <button 
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-header text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
        onClick={() => setCreateModalOpen(true)}
        data-testid="button-floating-add"
      >
        <Plus className="w-6 h-6" />
      </button>

      <BottomNavigation />

      <CreateActivityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        userId={user?.id || ""}
      />
    </div>
  );
}
