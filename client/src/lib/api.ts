// client/src/lib/api.ts
import { supabase } from "../supabase";
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

// Общие хелперы для обработки Supabase-ответов

function handleSupabaseError(error: any, context: string) {
  if (error) {
    console.error(`Supabase ${context} error`, error);
    throw new Error(error.message || `Supabase error in ${context}`);
  }
}

type SupabaseListResult<T> = T[];

// ─────────────────────────────────────────────────────────────
// Users (профиль менеджера / пользователя)
// ─────────────────────────────────────────────────────────────

export const userApi = {
  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    handleSupabaseError(error, "getCurrentUser");

    if (!user) return null;

    const { data, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    handleSupabaseError(profileError, "getUserProfile");

    return data as User;
  },

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User> {
    const { data: updated, error } = await supabase
      .from("users")
      .update(data)
      .eq("id", id)
      .select("*")
      .single();

    handleSupabaseError(error, "updateUser");
    return updated as User;
  },
};

// ─────────────────────────────────────────────────────────────
// Cities (города: id, name, region)
// ─────────────────────────────────────────────────────────────

export const cityApi = {
  async getCities(): Promise<City[]> {
    const { data, error } = await supabase
      .from("cities")
      .select("id, name, region")
      .order("name", { ascending: true });

    handleSupabaseError(error, "getCities");
    return (data ?? []) as City[];
  },

  // Вариант для "города зоны менеджера". Пока берём все города,
  // при наличии связей можно сузить выборку.
  async getCitiesByManager(managerId: string): Promise<City[]> {
    const { data, error } = await supabase
      .from("cities")
      .select("id, name, region")
      .order("name", { ascending: true });

    handleSupabaseError(error, "getCitiesByManager");
    return (data ?? []) as City[];
  },

  async createCity(city: InsertCity): Promise<City> {
    const { data, error } = await supabase
      .from("cities")
      .insert(city)
      .select("*")
      .single();

    handleSupabaseError(error, "createCity");
    return data as City;
  },

  async updateCity(id: string, data: Partial<InsertCity>): Promise<City> {
    const { data: updated, error } = await supabase
      .from("cities")
      .update(data)
      .eq("id", id)
      .select("*")
      .single();

    handleSupabaseError(error, "updateCity");
    return updated as City;
  },

  async deleteCity(id: string): Promise<void> {
    const { error } = await supabase.from("cities").delete().eq("id", id);
    handleSupabaseError(error, "deleteCity");
  },
};

// ─────────────────────────────────────────────────────────────
// Employees (МП: id, first_name, last_name, middle_name, manager_id, city_id, ...)
// ─────────────────────────────────────────────────────────────

export const employeeApi = {
  async getEmployeesByManager(managerId: string): Promise<EmployeeWithDetails[]> {
    const { data, error } = await supabase
      .from("employees")
      .select(
        `
        id,
        first_name,
        last_name,
        middle_name,
        manager_id,
        city_id,
        profile_image,
        position,
        phone,
        email,
        cities!inner(id, name, region)
      `,
      )
      .eq("manager_id", managerId)
      .order("last_name", { ascending: true });

    handleSupabaseError(error, "getEmployeesByManager");

    return (data ?? []).map((e: any) => ({
      id: e.id,
      firstName: e.first_name,
      lastName: e.last_name,
      middleName: e.middle_name ?? "",
      managerId: e.manager_id,
      cityId: e.city_id,
      position: e.position,
      phone: e.phone,
      email: e.email,
      profileImage: e.profile_image,
      city: e.cities
        ? {
            id: e.cities.id,
            name: e.cities.name,
            region: e.cities.region,
          }
        : undefined,
    })) as EmployeeWithDetails[];
  },

  async getAllEmployees(): Promise<EmployeeWithDetails[]> {
    const { data, error } = await supabase
      .from("employees")
      .select(
        `
        id,
        first_name,
        last_name,
        middle_name,
        manager_id,
        city_id,
        profile_image,
        position,
        phone,
        email,
        cities(id, name, region)
      `,
      )
      .order("last_name", { ascending: true });

    handleSupabaseError(error, "getAllEmployees");

    return (data ?? []).map((e: any) => ({
      id: e.id,
      firstName: e.first_name,
      lastName: e.last_name,
      middleName: e.middle_name ?? "",
      managerId: e.manager_id,
      cityId: e.city_id,
      position: e.position,
      phone: e.phone,
      email: e.email,
      profileImage: e.profile_image,
      city: e.cities
        ? {
            id: e.cities.id,
            name: e.cities.name,
            region: e.cities.region,
          }
        : undefined,
    })) as EmployeeWithDetails[];
  },

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const { data, error } = await supabase
      .from("employees")
      .insert({
        first_name: employee.firstName,
        last_name: employee.lastName,
        middle_name: employee.middleName,
        manager_id: employee.managerId,
        city_id: employee.cityId,
        profile_image: employee.profileImage,
        position: employee.position,
        phone: employee.phone,
        email: employee.email,
      })
      .select("*")
      .single();

    handleSupabaseError(error, "createEmployee");
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      middleName: data.middle_name,
      managerId: data.manager_id,
      cityId: data.city_id,
      profileImage: data.profile_image,
      position: data.position,
      phone: data.phone,
      email: data.email,
    } as Employee;
  },

  async updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee> {
    const payload: any = {
      ...(data.firstName && { first_name: data.firstName }),
      ...(data.lastName && { last_name: data.lastName }),
      ...(data.middleName && { middle_name: data.middleName }),
      ...(data.managerId && { manager_id: data.managerId }),
      ...(data.cityId && { city_id: data.cityId }),
      ...(data.profileImage && { profile_image: data.profileImage }),
      ...(data.position && { position: data.position }),
      ...(data.phone && { phone: data.phone }),
      ...(data.email && { email: data.email }),
    };

    const { data: updated, error } = await supabase
      .from("employees")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    handleSupabaseError(error, "updateEmployee");

    return {
      id: updated.id,
      firstName: updated.first_name,
      lastName: updated.last_name,
      middleName: updated.middle_name,
      managerId: updated.manager_id,
      cityId: updated.city_id,
      profileImage: updated.profile_image,
      position: updated.position,
      phone: updated.phone,
      email: updated.email,
    } as Employee;
  },

  async deleteEmployee(id: string): Promise<void> {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    handleSupabaseError(error, "deleteEmployee");
  },
};

// ─────────────────────────────────────────────────────────────
// Activity types
// ─────────────────────────────────────────────────────────────

export const activityTypeApi = {
  async getActivityTypes(): Promise<ActivityType[]> {
    const { data, error } = await supabase
      .from("activity_types")
      .select("*")
      .order("name", { ascending: true });

    handleSupabaseError(error, "getActivityTypes");
    return (data ?? []) as ActivityType[];
  },

  async createActivityType(type: InsertActivityType): Promise<ActivityType> {
    const { data, error } = await supabase
      .from("activity_types")
      .insert(type)
      .select("*")
      .single();

    handleSupabaseError(error, "createActivityType");
    return data as ActivityType;
  },

  async updateActivityType(id: string, data: Partial<InsertActivityType>): Promise<ActivityType> {
    const { data: updated, error } = await supabase
      .from("activity_types")
      .update(data)
      .eq("id", id)
      .select("*")
      .single();

    handleSupabaseError(error, "updateActivityType");
    return updated as ActivityType;
  },

  async deleteActivityType(id: string): Promise<void> {
    const { error } = await supabase.from("activity_types").delete().eq("id", id);
    handleSupabaseError(error, "deleteActivityType");
  },
};

// ─────────────────────────────────────────────────────────────
// Activities + календарь
// ─────────────────────────────────────────────────────────────

export const activityApi = {
  async getActivitiesByUser(
    userId: string,
    opts: { startDate: string; endDate: string },
  ): Promise<ActivityWithDetails[]> {
    const { data, error } = await supabase
      .from("activities")
      .select(
        `
        id,
        user_id,
        type_id,
        city_id,
        employee_id,
        title,
        description,
        start_date,
        end_date,
        status,
        activity_types(id, name, requires_employee),
        cities(id, name, region),
        employees(id, first_name, last_name, middle_name)
      `,
      )
      .eq("user_id", userId)
      .gte("start_date", opts.startDate)
      .lte("end_date", opts.endDate)
      .order("start_date", { ascending: true });

    handleSupabaseError(error, "getActivitiesByUser");

    return (data ?? []).map((a: any) => ({
      id: a.id,
      userId: a.user_id,
      typeId: a.type_id,
      cityId: a.city_id,
      employeeId: a.employee_id,
      title: a.title,
      description: a.description,
      startDate: a.start_date,
      endDate: a.end_date,
      status: a.status,
      type: a.activity_types
        ? {
            id: a.activity_types.id,
            name: a.activity_types.name,
            requiresEmployee: a.activity_types.requires_employee,
          }
        : undefined,
      city: a.cities
        ? {
            id: a.cities.id,
            name: a.cities.name,
            region: a.cities.region,
          }
        : undefined,
      employee: a.employees
        ? {
            id: a.employees.id,
            firstName: a.employees.first_name,
            lastName: a.employees.last_name,
            middleName: a.employees.middle_name ?? "",
          }
        : undefined,
      managerName: "", // при необходимости заполняется на основе user/employee
    })) as ActivityWithDetails[];
  },

  async getAllActivities(startDate: Date, endDate: Date): Promise<ActivityWithDetails[]> {
    const { data, error } = await supabase
      .from("activities")
      .select(
        `
        id,
        user_id,
        type_id,
        city_id,
        employee_id,
        title,
        description,
        start_date,
        end_date,
        status,
        activity_types(id, name, requires_employee),
        cities(id, name, region),
        employees(id, first_name, last_name, middle_name),
        users(id, first_name, last_name, middle_name)
      `,
      )
      .gte("start_date", startDate.toISOString())
      .lte("end_date", endDate.toISOString())
      .order("start_date", { ascending: true });

    handleSupabaseError(error, "getAllActivities");

    return (data ?? []).map((a: any) => ({
      id: a.id,
      userId: a.user_id,
      typeId: a.type_id,
      cityId: a.city_id,
      employeeId: a.employee_id,
      title: a.title,
      description: a.description,
      startDate: a.start_date,
      endDate: a.end_date,
      status: a.status,
      type: a.activity_types
        ? {
            id: a.activity_types.id,
            name: a.activity_types.name,
            requiresEmployee: a.activity_types.requires_employee,
          }
        : undefined,
      city: a.cities
        ? {
            id: a.cities.id,
            name: a.cities.name,
            region: a.cities.region,
          }
        : undefined,
      employee: a.employees
        ? {
            id: a.employees.id,
            firstName: a.employees.first_name,
            lastName: a.employees.last_name,
            middleName: a.employees.middle_name ?? "",
          }
        : undefined,
      managerName: a.users
        ? `${a.users.last_name} ${a.users.first_name} ${a.users.middle_name ?? ""}`
        : "",
    })) as ActivityWithDetails[];
  },

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const payload = {
      user_id: activity.userId,
      type_id: activity.typeId,
      city_id: activity.cityId,
      employee_id: activity.employeeId ?? null,
      title: activity.title,
      description: activity.description,
      start_date: activity.startDate,
      end_date: activity.endDate,
      status: activity.status,
    };

    const { data, error } = await supabase
      .from("activities")
      .insert(payload)
      .select("*")
      .single();

    handleSupabaseError(error, "createActivity");

    return {
      id: data.id,
      userId: data.user_id,
      typeId: data.type_id,
      cityId: data.city_id,
      employeeId: data.employee_id,
      title: data.title,
      description: data.description,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
    } as Activity;
  },

  async updateActivity(id: string, data: Partial<InsertActivity>): Promise<Activity> {
    const payload: any = {
      ...(data.userId && { user_id: data.userId }),
      ...(data.typeId && { type_id: data.typeId }),
      ...(data.cityId && { city_id: data.cityId }),
      ...(data.employeeId !== undefined && { employee_id: data.employeeId }),
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.startDate && { start_date: data.startDate }),
      ...(data.endDate && { end_date: data.endDate }),
      ...(data.status && { status: data.status }),
    };

    const { data: updated, error } = await supabase
      .from("activities")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    handleSupabaseError(error, "updateActivity");

    return {
      id: updated.id,
      userId: updated.user_id,
      typeId: updated.type_id,
      cityId: updated.city_id,
      employeeId: updated.employee_id,
      title: updated.title,
      description: updated.description,
      startDate: updated.start_date,
      endDate: updated.end_date,
      status: updated.status,
    } as Activity;
  },

  async deleteActivity(id: string): Promise<void> {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    handleSupabaseError(error, "deleteActivity");
  },

  async updateActivityStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from("activities")
      .update({ status })
      .eq("id", id);

    handleSupabaseError(error, "updateActivityStatus");
  },

  // Календарная статистика для менеджера — через RPC-функцию в Supabase
  async getActivityCalendarStatsByUser(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ items: any[] }> {
    const { data, error } = await supabase.rpc(
      "get_activity_calendar_stats_by_user",
      {
        user_id: userId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
    );

    handleSupabaseError(error, "getActivityCalendarStatsByUser");

    return { items: data ?? [] };
  },
};

// ─────────────────────────────────────────────────────────────
// Holidays (id, date, name)
// ─────────────────────────────────────────────────────────────

export const holidaysApi = {
  async getHolidaysForYear(year: number): Promise<{ date: string; name: string }[]> {
    const { data, error } = await supabase
      .from("holidays")
      .select("date, name")
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .order("date", { ascending: true });

    handleSupabaseError(error, "getHolidaysForYear");
    return data ?? [];
  },
};

// ─────────────────────────────────────────────────────────────
// Chat (если есть таблица messages)
// ─────────────────────────────────────────────────────────────

export const chatApi = {
  async getMessages(threadId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    handleSupabaseError(error, "getMessages");
    return data ?? [];
  },

  async sendMessage(payload: {
    threadId: string;
    userId: string;
    content: string;
  }): Promise<void> {
    const { error } = await supabase.from("messages").insert({
      thread_id: payload.threadId,
      user_id: payload.userId,
      content: payload.content,
    });
    handleSupabaseError(error, "sendMessage");
  },
};