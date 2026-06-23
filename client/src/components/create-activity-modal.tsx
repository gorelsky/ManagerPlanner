import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { insertActivitySchema } from "@shared/schema";
import { activityApi, cityApi, employeeApi, activityTypeApi } from "@/lib/api";
import type { InsertActivity } from "@shared/schema";
import { z } from "zod";

const formSchema = insertActivitySchema.omit({ title: true }).extend({
  startDate: z.date({ required_error: "Дата начала обязательна" }),
  endDate: z.date({ required_error: "Дата окончания обязательна" }),
  startTime: z.string().min(1, "Время начала обязательно"),
  endTime: z.string().min(1, "Время окончания обязательно"),
  typeId: z.string().min(1, "Тип активности обязателен"),
  cityId: z.string().min(1, "Город обязателен"),
});

type FormData = z.infer<typeof formSchema>;

interface CreateActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export default function CreateActivityModal({ 
  open, 
  onOpenChange, 
  userId 
}: CreateActivityModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId,
      description: "",
      status: "planned",
      startDate: new Date(), // Сегодняшняя дата
      endDate: new Date(),   // Сегодняшняя дата
      startTime: "09:00", // Время по умолчанию
      endTime: "18:00",   // Время по умолчанию
      typeId: "",
      cityId: "",
      employeeId: "",
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["/api/cities"],
    queryFn: cityApi.getCities,
  });

  const { data: activityTypes = [] } = useQuery({
    queryKey: ["/api/activity-types"],
    queryFn: activityTypeApi.getActivityTypes,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees/manager", userId],
    queryFn: () => employeeApi.getEmployeesByManager(userId),
  });

  const selectedTypeId = form.watch("typeId");
  const selectedType = activityTypes.find(type => type.id === selectedTypeId);

  const createActivityMutation = useMutation({
    mutationFn: activityApi.createActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities/user", userId] });
      toast({
        title: "Успешно",
        description: "Активность создана",
      });
      onOpenChange(false);
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
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать активность",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Объединяем дату и время в один объект Date
    const [startHour, startMinute] = data.startTime.split(':').map(Number);
    const [endHour, endMinute] = data.endTime.split(':').map(Number);
    
    const startDateTime = new Date(data.startDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);
    
    const endDateTime = new Date(data.endDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    // Используем название типа активности как title
    const selectedType = activityTypes.find(type => type.id === data.typeId);
    const activityTitle = selectedType?.name || "Активность";

    const activityData: InsertActivity = {
      userId: data.userId,
      typeId: data.typeId,
      cityId: data.cityId,
      employeeId: data.employeeId ? data.employeeId : undefined,
      title: activityTitle,
      description: data.description,
      startDate: startDateTime,
      endDate: endDateTime,
      status: data.status,
    };

    createActivityMutation.mutate(activityData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto" data-testid="create-activity-modal">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Новая активность</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="typeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип активности</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Время начала</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value || ""} data-testid="input-start-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Время окончания</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value || ""} data-testid="input-end-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Город</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            {selectedType?.requiresEmployee && (
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Прикрепленный сотрудник</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-employee">
                          <SelectValue placeholder="Выберите сотрудника" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((employee) => (
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
                disabled={createActivityMutation.isPending}
                data-testid="button-create"
              >
                {createActivityMutation.isPending ? "Создание..." : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
