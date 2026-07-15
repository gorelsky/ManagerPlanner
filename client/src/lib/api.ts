import { apiRequest } from "./queryClient";
import type {
  User,
  InsertUser,
  City,
  InsertCity,
  Employee,
  InsertEmployee,
  ActivityType,
  InsertActivityType,
  Activity,
  InsertActivity,
  ActivityWithDetails,
  EmployeeWithDetails,
} from "@shared/schema";

// Если у тебя есть эти типы — оставь, если нет, убери или скорректируй импорт
export type ChatMessageWithUser = any;

// Вспомогательные типы для календарной статистики
type ActivityCalendarItem = {
  date: string;
  planned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  rescheduled: number;
};

type ActivityCalendarStats = {
  items: ActivityCalendarItem[];
};

// Users
export const userApi = {
  getUser: (id: string): Promise<User> =>
    apiRequest("GET", `/api/users/${id}`).then((res) => res.json()),

  createUser: (user: InsertUser): Promise<User> =>
    apiRequest("POST", "/api/users", user).then((res) => res.json()),

  getManagersList: (): Promise<User[]> =>
    apiRequest("GET", "/api/users/managers").then((res) => res.json()),

  importUsers: (
    csvData: string,
    role: "manager" | "admin",
  ): Promise<{ imported: number }> =>
    apiRequest("POST", "/api/users/import", { csvData, role }).then((res) =>
      res.json(),
    ),

  deleteUser: (id: string): Promise<void> =>
    apiRequest("DELETE", `/api/users/${id}`).then(() => {}),
};

// Cities
export const cityApi = {
  getCities: (): Promise<City[]> =>
    apiRequest("GET", "/api/cities").then((res) => res.json()),

  createCity: (city: InsertCity): Promise<City> =>
    apiRequest("POST", "/api/cities", city).then((res) => res.json()),

  importCities: (csvData: string): Promise<{ imported: number }> =>
    apiRequest("POST", "/api/cities/import", { csvData }).then((res) =>
      res.json(),
    ),

  // Города зоны конкретного менеджера
  getCitiesByManager: (managerId: string): Promise<City[]> =>
    apiRequest("GET", `/api/cities/manager/${managerId}`).then((res) =>
      res.json(),
    ),

  // НОВОЕ: импорт связей менеджер ↔ город
  importManagerCities: (csvData: string): Promise<{ imported: number }> =>
    apiRequest("POST", "/api/manager-cities/import", { csvData }).then((res) =>
      res.json(),
    ),
};

// Employees
export const employeeApi = {
  getEmployeesByManager: (
    managerId: string,
  ): Promise<EmployeeWithDetails[]> =>
    apiRequest("GET", `/api/employees/manager/${managerId}`).then((res) =>
      res.json(),
    ),

  getAllEmployees: (): Promise<EmployeeWithDetails[]> =>
    apiRequest("GET", "/api/employees/all").then((res) => res.json()),

  createEmployee: (employee: InsertEmployee): Promise<Employee> =>
    apiRequest("POST", "/api/employees", employee).then((res) => res.json()),

  importEmployees: (csvData: string): Promise<{ imported: number }> =>
    apiRequest("POST", "/api/employees/import", { csvData }).then((res) =>
      res.json(),
    ),
};

// Activity Types
export const activityTypeApi = {
  getActivityTypes: (): Promise<ActivityType[]> =>
    apiRequest("GET", "/api/activity-types").then((res) => res.json()),

  createActivityType: (
    activityType: InsertActivityType,
  ): Promise<ActivityType> =>
    apiRequest("POST", "/api/activity-types", activityType).then((res) =>
      res.json(),
    ),
};

// Activities
export const activityApi = {
  getAllActivities: (
    startDate?: Date,
    endDate?: Date,
  ): Promise<ActivityWithDetails[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate.toISOString());
    if (endDate) params.append("endDate", endDate.toISOString());

    const url = `/api/activities/all${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    return apiRequest("GET", url).then((res) => res.json());
  },

getActivitiesByUser: async (
  userId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<ActivityWithDetails[]> => {
  const search = new URLSearchParams();
  if (params?.startDate) search.set("startDate", params.startDate);
  if (params?.endDate) search.set("endDate", params.endDate);

  const url =
    search.toString().length > 0
      ? `/api/activities/user/${userId}?${search.toString()}`
      : `/api/activities/user/${userId}`;

  const res = await apiRequest("GET", url);
  return res.json();
},

  getActivity: (id: string): Promise<ActivityWithDetails> =>
    apiRequest("GET", `/api/activities/${id}`).then((res) => res.json()),

  createActivity: async (activity: InsertActivity): Promise<Activity> => {
    const res = await apiRequest("POST", "/api/activities", activity);

    if (!res.ok) {
      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      const serverMessage = data?.message;
      throw new Error(serverMessage || "Не удалось создать активность");
    }

    return res.json();
  },

// Обновление активности (редактирование)
updateActivity: async (
  id: string,
  activity: Partial<InsertActivity>,
): Promise<Activity> => {
  const {
    userId,
    typeId,
    cityId,
    employeeId,
    title,
    description,
    startDate,
    endDate,
    status,
  } = activity;

  const payload: Record<string, unknown> = {};

  if (userId) payload.userId = userId;
  if (typeId) payload.typeId = typeId;
  if (cityId) payload.cityId = cityId;
  if (employeeId !== undefined) payload.employeeId = employeeId;
  if (title) payload.title = title;
  if (description !== undefined) payload.description = description;
  if (startDate) payload.startDate = startDate;
  if (endDate) payload.endDate = endDate;
  if (status) payload.status = status;

  const res = await apiRequest("PATCH", `/api/activities/${id}`, payload);

  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {}

    const serverMessage = data?.message;
    throw new Error(serverMessage || "Не удалось обновить активность");
  }

  return res.json();
},

  // Обновление статуса активности (выполнено / отменено и т.п.)
  updateActivityStatus: async (
    id: string,
    status: string,
  ): Promise<Activity> => {
    const res = await apiRequest("PATCH", `/api/activities/${id}/status`, {
      status,
    });

    if (!res.ok) {
      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      const serverMessage = data?.message;
      throw new Error(serverMessage || "Не удалось обновить статус активности");
    }

    return res.json();
  },

  // Календарная статистика активностей пользователя
  getActivityCalendarStatsByUser: (
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ActivityCalendarStats> => {
    const params = new URLSearchParams();
    params.append("startDate", startDate.toISOString());
    params.append("endDate", endDate.toISOString());

    const url = `/api/activities/calendar/user/${userId}?${params.toString()}`;
    return apiRequest("GET", url).then((res) => res.json());
  },
};

export const holidaysApi = {
  importHolidays(csvData: string) {
    return apiRequest("POST", "/api/holidays/import", { csvData }).then((res) =>
      res.json(),
    );
  },

  getHolidaysForYear(year: number) {
    return apiRequest("GET", `/api/holidays?year=${year}`).then((res) =>
      res.json(),
    );
  },
};

// Chat
export const chatApi = {
  getMessages: (): Promise<ChatMessageWithUser[]> =>
    apiRequest("GET", "/api/chat/messages").then((res) => res.json()),

  sendMessage: (text: string): Promise<ChatMessageWithUser> =>
    apiRequest("POST", "/api/chat/messages", { text }).then((res) =>
      res.json(),
    ),
};