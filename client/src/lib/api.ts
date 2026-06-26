import { apiRequest } from "./queryClient";
import type { 
  User, InsertUser,
  City, InsertCity,
  Employee, InsertEmployee,
  ActivityType, InsertActivityType,
  Activity, InsertActivity,
  ActivityWithDetails,
  EmployeeWithDetails
} from "@shared/schema";

// Users
export const userApi = {
  getUser: (id: string): Promise<User> =>
    apiRequest("GET", `/api/users/${id}`).then(res => res.json()),
  
  createUser: (user: InsertUser): Promise<User> =>
    apiRequest("POST", "/api/users", user).then(res => res.json()),

  getManagersList: (): Promise<User[]> =>
    apiRequest("GET", "/api/users/managers").then(res => res.json()),

  importUsers: (csvData: string, role: "manager" | "admin"): Promise<{ imported: number }> =>
    apiRequest("POST", "/api/users/import", { csvData, role }).then(res => res.json()),

  deleteUser: (id: string): Promise<void> =>
    apiRequest("DELETE", `/api/users/${id}`).then(() => {}),
};

// Cities
export const cityApi = {
  getCities: (): Promise<City[]> =>
    apiRequest("GET", "/api/cities").then(res => res.json()),
  
  createCity: (city: InsertCity): Promise<City> =>
    apiRequest("POST", "/api/cities", city).then(res => res.json()),

  importCities: (csvData: string): Promise<{ imported: number }> =>
    apiRequest("POST", "/api/cities/import", { csvData }).then(res => res.json()),

  // НОВОЕ: города зоны конкретного менеджера
  getCitiesByManager: (managerId: string): Promise<City[]> =>
    apiRequest("GET", `/api/cities/manager/${managerId}`).then(res => res.json()),
};

// Employees
export const employeeApi = {
  getEmployeesByManager: (managerId: string): Promise<EmployeeWithDetails[]> =>
    apiRequest("GET", `/api/employees/manager/${managerId}`).then(res => res.json()),
  
  getAllEmployees: (): Promise<EmployeeWithDetails[]> =>
    apiRequest("GET", "/api/employees/all").then(res => res.json()),
  
  createEmployee: (employee: InsertEmployee): Promise<Employee> =>
    apiRequest("POST", "/api/employees", employee).then(res => res.json()),

  importEmployees: (csvData: string): Promise<{ imported: number }> =>
    apiRequest("POST", "/api/employees/import", { csvData }).then(res => res.json()),
};

// Activity Types
export const activityTypeApi = {
  getActivityTypes: (): Promise<ActivityType[]> =>
    apiRequest("GET", "/api/activity-types").then(res => res.json()),
  
  createActivityType: (activityType: InsertActivityType): Promise<ActivityType> =>
    apiRequest("POST", "/api/activity-types", activityType).then(res => res.json()),
};

// Activities
export const activityApi = {
  getAllActivities: (startDate?: Date, endDate?: Date): Promise<ActivityWithDetails[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate.toISOString());
    if (endDate) params.append("endDate", endDate.toISOString());
    
    const url = `/api/activities/all${params.toString() ? `?${params.toString()}` : ""}`;
    return apiRequest("GET", url).then(res => res.json());
  },

  getActivitiesByUser: (userId: string, startDate?: Date, endDate?: Date): Promise<ActivityWithDetails[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate.toISOString());
    if (endDate) params.append("endDate", endDate.toISOString());
    
    const url = `/api/activities/user/${userId}${params.toString() ? `?${params.toString()}` : ""}`;
    return apiRequest("GET", url).then(res => res.json());
  },
  
  getActivity: (id: string): Promise<ActivityWithDetails> =>
    apiRequest("GET", `/api/activities/${id}`).then(res => res.json()),
  
  createActivity: (activity: InsertActivity): Promise<Activity> =>
    apiRequest("POST", "/api/activities", activity).then(res => res.json()),
  
  updateActivity: (id: string, activity: Partial<InsertActivity>): Promise<Activity> =>
    apiRequest("PATCH", `/api/activities/${id}`, activity).then(res => res.json()),
  
  updateActivityStatus: (id: string, status: string): Promise<Activity> =>
    apiRequest("PATCH", `/api/activities/${id}/status`, { status }).then(res => res.json()),
  
  deleteActivity: (id: string): Promise<void> =>
    apiRequest("DELETE", `/api/activities/${id}`).then(() => {}),
};