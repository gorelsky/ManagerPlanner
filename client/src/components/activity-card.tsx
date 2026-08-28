import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MapPin, Clock, Check, Edit, X, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityWithDetails, ApprovalStatus } from "@shared/schema";

interface ActivityCardProps {
  activity: ActivityWithDetails;
  currentUserId?: string;
  canReview?: boolean;
  onMarkComplete: (id: string) => void;
  onEdit: (activity: ActivityWithDetails) => void;
  onCancel: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const statusConfig = {
  planned: { label: "Запланировано", className: "status-planned" },
  in_progress: { label: "В процессе", className: "status-in-progress" },
  completed: { label: "Выполнено", className: "status-completed" },
  cancelled: { label: "Отменено", className: "status-cancelled" },
  rescheduled: { label: "Перенесено", className: "status-cancelled" },
};

const approvalConfig: Record<ApprovalStatus, { label: string; className: string }> = {
  created: { label: "Создан", className: "bg-slate-100 text-slate-700 border-slate-300" },
  approved: { label: "Утверждён", className: "bg-emerald-100 text-emerald-800 border-emerald-400" },
  rejected: { label: "Отклонён", className: "bg-red-200 text-red-900 border-red-500" },
};

export default function ActivityCard({
  activity,
  currentUserId,
  canReview = false,
  onMarkComplete,
  onEdit,
  onCancel,
  onApprove,
  onReject,
}: ActivityCardProps) {
  const status = statusConfig[activity.status as keyof typeof statusConfig] || statusConfig.planned;
  const approvalStatus = activity.approvalStatus || "created";
  const approval = approvalConfig[approvalStatus];
  const isOwner = currentUserId === activity.userId;
  const isCompleted = activity.status === "completed";
  const isApprovedAwaitingCompletion = approvalStatus === "approved" && !isCompleted;
  const endDateTime = new Date(activity.endDate);
  const canComplete =
    isOwner &&
    approvalStatus === "approved" &&
    !isCompleted &&
    Date.now() >= endDateTime.getTime();

  return (
    <div
      className={cn(
        "border rounded-lg p-4 mb-3 shadow-sm transition-colors",
        approvalStatus === "rejected" && "bg-red-100 border-red-500 text-red-950",
        isApprovedAwaitingCompletion && "bg-amber-100 border-amber-400 text-slate-950",
        approvalStatus === "approved" && isCompleted && "bg-white border-emerald-500 shadow-md text-slate-950",
        approvalStatus === "created" && "bg-card border-border",
      )}
      data-testid={`activity-card-${activity.id}`}
    >
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={cn(
                "text-xs",
                approvalStatus === "approved" ? "font-semibold text-slate-800" : "font-medium text-muted-foreground",
              )}
              data-testid="activity-time"
            >
              {format(new Date(activity.startDate), "dd.MMM.yyyy, HH:mm", { locale: ru })} -{" "}
              {format(new Date(activity.endDate), "dd.MMM.yyyy, HH:mm", { locale: ru })}
            </span>
            <span className={cn("px-2 py-1 rounded text-xs font-medium", status.className)} data-testid="activity-status">
              {status.label}
            </span>
            <span className={cn("px-2 py-1 rounded border text-xs font-bold", approval.className)} data-testid="activity-approval-status">
              {approval.label}
            </span>
          </div>

          {activity.managerName && <p className="text-xs font-semibold mb-1">Менеджер: {activity.managerName}</p>}
          <h6
            className={cn("mb-1", approvalStatus === "approved" ? "font-bold text-slate-950" : "font-medium")}
            data-testid="activity-title"
          >
            {activity.title}
          </h6>
          {activity.description && (
            <p
              className={cn("text-sm mb-2", approvalStatus === "approved" ? "font-medium text-slate-800" : "text-muted-foreground")}
              data-testid="activity-description"
            >
              {activity.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2">
            <span data-testid="activity-location"><MapPin className="w-3 h-3 inline mr-1" />{activity.city.name}</span>
            <span data-testid="activity-duration">
              <Clock className="w-3 h-3 inline mr-1" />
              {format(new Date(activity.startDate), "HH:mm", { locale: ru })} - {format(new Date(activity.endDate), "HH:mm", { locale: ru })}
            </span>
          </div>
          {activity.employee && (
            <div className="flex items-center space-x-2 text-xs">
              <span>Прикрепленный сотрудник:</span>
              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
                {activity.employee.lastName} {activity.employee.firstName.charAt(0)}.{activity.employee.middleName?.charAt(0)}.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {canReview && !isCompleted && (
            <div className="flex gap-1">
              <button
                className="inline-flex items-center gap-1 rounded border border-emerald-500 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                onClick={() => onApprove(activity.id)}
                disabled={approvalStatus === "approved"}
                title="Утвердить план"
              >
                <CheckCircle2 className="w-4 h-4" /> Утвердить
              </button>
              <button
                className="inline-flex items-center gap-1 rounded border border-red-500 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                onClick={() => onReject(activity.id)}
                disabled={approvalStatus === "rejected"}
                title="Отклонить план"
              >
                <XCircle className="w-4 h-4" /> Отклонить
              </button>
            </div>
          )}

          {isOwner && !isCompleted && (
            <div className="flex gap-2">
              {approvalStatus === "approved" && (
                <button
                  className={cn(
                    "rounded p-1 transition-colors",
                    canComplete ? "text-green-700 hover:bg-green-100" : "text-slate-400 cursor-not-allowed",
                  )}
                  onClick={() => canComplete && onMarkComplete(activity.id)}
                  disabled={!canComplete}
                  title={canComplete ? "Отметить план выполненным" : `Можно выполнить после ${format(endDateTime, "dd.MMM.yyyy HH:mm", { locale: ru })}`}
                  data-testid="button-mark-complete"
                >
                  <Check className="w-5 h-5" />
                </button>
              )}
              <button
                className="rounded-lg p-1.5 text-primary hover:bg-primary/10"
                onClick={() => onEdit(activity)}
                title="Редактировать план (потребуется повторное согласование)"
                data-testid="button-edit-activity"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                className="rounded p-1 text-red-600 hover:bg-red-100"
                onClick={() => onCancel(activity.id)}
                title="Отменить план"
                data-testid="button-cancel-activity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
