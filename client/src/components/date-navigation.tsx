import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface DateNavigationProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export default function DateNavigation({ 
  currentDate, 
  onPreviousMonth, 
  onNextMonth 
}: DateNavigationProps) {
  return (
    <div className="flex items-center justify-between mb-6" data-testid="date-navigation">
      <h4 className="text-sm font-medium text-muted-foreground" data-testid="current-month">
        {format(currentDate, "LLL yyyy", { locale: ru })}
      </h4>
      <div className="flex items-center space-x-6">
        <span className="text-sm font-medium text-foreground" data-testid="selected-date">
          Сегодня
        </span>
        <div className="flex space-x-2">
          <button 
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={onPreviousMonth}
            data-testid="button-previous-month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={onNextMonth}
            data-testid="button-next-month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
