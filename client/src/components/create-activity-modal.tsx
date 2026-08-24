import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Clock } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { activityApi, cityApi, employeeApi, activityTypeApi } from "@/lib/api";
import type { InsertActivity, ActivityWithDetails } from "@shared/schema";
import { z } from "zod";

const formSchema = z.object({
  userId: z.string().optional(),
  typeId: z.string({ required_error: "Тип активности обязателен" }),
  cityId: z.string({ required_error: "Город обязателен" }),
  employeeId: z.string().optional(),
  description: z.string().optional(),
  startDate: z.date({ required_error: "Дата начала обязательна" }),
  endDate: z.date({ required_error: "Дата окончания обязательна" }),
  startTime: z.string().min(1, "Время начала обязательно"),
  endTime: z.string().min(1, "Время окончания обязательно"),
  status: z.enum(["planned", "in_progress", "completed", "cancelled", "rescheduled"]).default("planned"),
});

type FormData = z.infer<typeof formSchema>;

interface CreateActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  activityToEdit?: ActivityWithDetails | null;
}

export default function CreateActivityModal({
  open,
  onOpenChange,
  userId,
  activityToEdit,
}: CreateActivityModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId,
      description: "",
      status: "planned",
      startDate: new Date(),
      endDate: new Date(),
      startTime: "09:00",
      endTime: "18:00",
      typeId: "",
      cityId: "",
      employeeId: "",
    },
  });

  const startDate = form.watch("startDate");
  const selectedTypeId = form.watch("typeId");
  const selectedCityId = form.watch("cityId");

  const { data: cities = [] } = useQuery({
    queryKey: ["/api/cities/manager", userId],
    queryFn: () => cityApi.getCitiesByManager(userId),
    enabled: !!userId,
  });

  const { data: activityTypes = [] } = useQuery({
    queryKey: ["/api/activity-types"],
    queryFn: activityTypeApi.getActivityTypes,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees/manager", userId],
    queryFn: () => employeeApi.getEmployeesByManager(userId),
    enabled: !!userId,
  });

  const selectedType = activityTypes.find((type) => type.id === selectedTypeId);
  const filteredEmployees = employees.filter(
    (employee) => employee.cityId === selectedCityId,
  );

  const createActivityMutation = useMutation({
    mutationFn: activityApi.createActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/calendar/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/all"] });
      toast({
        title: "Успешно",
        description: "Активность создана",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось создать активность",
        variant: "destructive",
      });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertActivity> }) =>
      activityApi.updateActivity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/calendar/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/all"] });
      toast({
        title: "Успешно",
        description: "Активность обновлена",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить активность",
        variant: "destructive",
      });
    },
  });

  // Заполнение формы при редактировании – безопасная обработка дат
  useEffect(() => {
    if (activityToEdit) {
      // Преобразуем даты в объекты Date, если они ещё не Date
      const start = activityToEdit.startDate instanceof Date
        ? activityToEdit.startDate
        : new Date(activityToEdit.startDate);
      const end = activityToEdit.endDate instanceof Date
        ? activityToEdit.endDate
        : new Date(activityToEdit.endDate);

      // Проверка на валидность – если дата невалидная, используем сегодня
      const safeStart = isNaN(start.getTime()) ? new Date() : start;
      const safeEnd = isNaN(end.getTime()) ? new Date() : end;

      const startTime = `${String(safeStart.getHours()).padStart(2, "0")}:${String(safeStart.getMinutes()).padStart(2, "0")}`;
      const endTime = `${String(safeEnd.getHours()).padStart(2, "0")}:${String(safeEnd.getMinutes()).padStart(2, "0")}`;

      form.reset({
        userId: activityToEdit.userId,
        description: activityToEdit.description || "",
        status: activityToEdit.status,
        startDate: safeStart,
        endDate: safeEnd,
        startTime,
        endTime,
        typeId: activityToEdit.typeId,
        cityId: activityToEdit.cityId,
        employeeId: activityToEdit.employeeId || "",
      });
    } else {
      form.reset({
        userId,
        description: "",
        status: "planned",
        startDate: new Date(),
        endDate: new Date(),
        startTime: "09:00",
        endTime: "18:00",
        typeId: "",
        cityId: "",
        employeeId: "",
      });
    }
  }, [activityToEdit, userId, form]);

  const onSubmit = (data: FormData) => {
    const [startHour, startMinute] = data.startTime.split(":").map(Number);
    const [endHour, endMinute] = data.endTime.split(":").map(Number);

    const startDateTime = new Date(data.startDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    const endDateTime = new Date(data.endDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    if (endDateTime.getTime() < startDateTime.getTime()) {
      toast({
        title: "Ошибка",
        description: "Время окончания не может быть раньше времени начала",
        variant: "destructive",
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedStart = new Date(data.startDate);
    selectedStart.setHours(0, 0, 0, 0);

    if (activityToEdit && selectedStart < today) {
      toast({
        title: "Нельзя изменить",
        description: "Нельзя изменять активности прошлых дней",
        variant: "destructive",
      });
      return;
    }

    const selectedType = activityTypes.find((type) => type.id === data.typeId);
    const activityTitle = selectedType?.name || "Активность";

    const activityData: InsertActivity = {
      userId: data.userId!,
      typeId: data.typeId,
      cityId: data.cityId,
      employeeId: data.employeeId || undefined,
      title: activityTitle,
      description: data.description,
      startDate: startDateTime,
      endDate: endDateTime,
      status: data.status,
    };

    if (activityToEdit) {
      updateActivityMutation.mutate({
        id: activityToEdit.id,
        data: activityData,
      });
    } else {
      createActivityMutation.mutate(activityData);
    }
  };

  const isSubmitting =
    createActivityMutation.isPending || updateActivityMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto"
        data-testid="create-activity-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {activityToEdit ? "Редактировать активность" : "Новая активность"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Тип активности */}
            <FormField
              control={form.control}
              name="typeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип активности</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-activity-type">
                        <SelectValue placeholder="Выберите тип активности" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activityTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Дата начала */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата начала</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Выберите дату начала"
                      data-testid="input-start-date"
                      minDate={new Date()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Дата окончания */}
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата окончания</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Выберите дату окончания"
                      data-testid="input-end-date"
                      minDate={startDate || new Date()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Время начала / окончания */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Время начала</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 pointer-events-none" />
                        <Input
                          type="time"
                          {...field}
                          value={field.value || ""}
                          className="w-[84%] pl-10 bg-emerald-50 focus:bg-emerald-100 focus:ring-2 focus:ring-emerald-300"
                          data-testid="input-start-time"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Время окончания</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 pointer-events-none" />
                        <Input
                          type="time"
                          {...field}
                          value={field.value || ""}
                          className="w-[84%] pl-10 bg-emerald-50 focus:bg-emerald-100 focus:ring-2 focus:ring-emerald-300"
                          data-testid="input-end-time"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Город */}
            <FormField
              control={form.control}
              name="cityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Город</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-city">
                        <SelectValue placeholder="Выберите город" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Сотрудник (если требуется) */}
            {selectedType?.requiresEmployee && (
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Прикрепленный сотрудник</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || ""}
                      disabled={!selectedCityId}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-employee">
                          <SelectValue
                            placeholder={
                              selectedCityId
                                ? "Выберите сотрудника"
                                : "Сначала выберите город"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredEmployees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.lastName} {employee.firstName} {employee.middleName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Описание */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Подробное описание активности"
                      {...field}
                      value={field.value || ""}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
                data-testid="button-create"
              >
                {isSubmitting
                  ? "Сохранение..."
                  : activityToEdit
                  ? "Сохранить"
                  : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}