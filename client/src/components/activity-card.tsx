import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MapPin, Clock, Check, Edit, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityWithDetails } from "@shared/schema";

interface ActivityCardProps {
  activity: ActivityWithDetails;
  onMarkComplete: (id: string) => void;
  onEdit: (activity: ActivityWithDetails) => void;
  onCancel: (id: string) => void;
}

const statusConfig = {
  planned: { label: "Запланировано", className: "status-planned" },
  in_progress: { label: "В процессе", className: "status-in-progress" },
  completed: { label: "Выполнено", className: "status-completed" },
  cancelled: { label: "Отменено", className: "status-cancelled" },
  rescheduled: { label: "Перенесено", className: "status-cancelled" },
};

export default function ActivityCard({
  activity,
  onMarkComplete,
  onEdit,
  onCancel,
}: ActivityCardProps) {
  const status =
    statusConfig[activity.status as keyof typeof statusConfig] || statusConfig.planned;

  const now = new Date();
  const endDateTime = new Date(activity.endDate);
  const canComplete = now.getTime() >= endDateTime.getTime();

  const cityName = activity.city?.name || "—";
  const employeeFirst = activity.employee?.firstName || "";
  const employeeLast = activity.employee?.lastName || "";
  const employeeMiddle = activity.employee?.middleName || "";

  return (
    <div
      className="bg-card border border-border rounded-lg p-4 mb-3 shadow-sm"
      data-testid={`activity-card-${activity.id}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span
              className="text-xs font-medium text-muted-foreground"
              data-testid="activity-time"
            >
              {format(new Date(activity.startDate), "dd.MMM.yyyy, HH:mm", { locale: ru })} -{" "}
              {format(new Date(activity.endDate), "dd.MMM.yyyy, HH:mm", { locale: ru })}
            </span>
            <span
              className={cn("px-2 py-1 rounded text-xs font-medium", status.className)}
              data-testid="activity-status"
            >
              {status.label}
            </span>
          </div>
          <h6 className="font-medium text-foreground mb-1" data-testid="activity-title">
            {activity.title}
          </h6>
          {activity.description && (
            <p
              className="text-sm text-muted-foreground mb-2"
              data-testid="activity-description"
            >
              {activity.description}
            </p>
          )}
          <div className="flex items-center space-x-4 text-xs text-muted-foreground mb-2">
            <span data-testid="activity-location">
              <MapPin className="w-3 h-3 inline mr-1" />
              {cityName}
            </span>
            <span data-testid="activity-duration">
              <Clock className="w-3 h-3 inline mr-1" />
              {format(new Date(activity.startDate), "HH:mm", { locale: ru })} -{" "}
              {format(new Date(activity.endDate), "HH:mm", { locale: ru })}
            </span>
          </div>
          {activity.employee && (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-muted-foreground">Прикрепленный сотрудник:</span>
              <span
                className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium"
                data-testid="activity-employee"
              >
                {employeeLast} {employeeFirst ? `${employeeFirst.charAt(0)}.` : ""}
                {employeeMiddle ? `${employeeMiddle.charAt(0)}.` : ""}
              </span>
            </div>
          )}
        </div>
        <div className="flex space-x-2 ml-2">
          <button
            className={cn(
              "transition-colors",
              canComplete
                ? "text-green-600 hover:text-green-700"
                : "text-slate-300 cursor-not-allowed",
            )}
            onClick={() => {
              if (!canComplete) {
                alert(
                  `Нельзя завершить активность раньше времени окончания. ` +
                    `Можно после ${format(endDateTime, "dd.MMM.yyyy HH:mm", { locale: ru })}`,
                );
                return;
              }

              onMarkComplete(activity.id);
            }}
            disabled={activity.status === "completed"}
            data-testid="button-mark-complete"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            className="text-blue-600 hover:text-blue-700 transition-colors"
            onClick={() => onEdit(activity)}
            data-testid="button-edit-activity"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            className="text-red-600 hover:text-red-700 transition-colors"
            onClick={() => onCancel(activity.id)}
            data-testid="button-cancel-activity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}